#!/usr/bin/env bash
# Restores database + uploads from S3 onto this server.
# Usage:  ./scripts/restore.sh            (latest backup)
#         ./scripts/restore.sh 20261120T020001Z   (specific timestamp, see: aws s3 ls s3://BUCKET/db/)
# WARNING: replaces the current database and uploads.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${S3_BUCKET:?S3_BUCKET missing in .env}"
export AWS_DEFAULT_REGION="${AWS_REGION:-us-east-1}"
VOLUME=upskill_uploads

if [ "${1:-latest}" = "latest" ]; then
  DB_KEY=$(aws s3 ls "s3://$S3_BUCKET/db/" | awk '{print $4}' | grep '^db-.*\.dump$' | sort | tail -1)
  [ -n "$DB_KEY" ] || { echo "No database backups found in s3://$S3_BUCKET/db/" >&2; exit 1; }
  TS=${DB_KEY#db-}; TS=${TS%.dump}
else
  TS="$1"
fi
echo "[restore] using backup $TS"

read -r -p "This REPLACES the current data on this server. Type 'yes' to continue: " OK
[ "$OK" = "yes" ] || { echo "Cancelled."; exit 1; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
aws s3 cp "s3://$S3_BUCKET/db/db-$TS.dump" "$TMP/db.dump" --only-show-errors
aws s3 cp "s3://$S3_BUCKET/uploads/uploads-$TS.tar.gz" "$TMP/uploads.tar.gz" --only-show-errors

echo "[restore] stopping app, starting database..."
docker compose stop web api 2>/dev/null || true
docker compose up -d db
for i in $(seq 1 30); do
  docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break
  sleep 2
done

echo "[restore] restoring database..."
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE);" -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error < "$TMP/db.dump"

echo "[restore] restoring uploads..."
docker volume create "$VOLUME" >/dev/null
docker run --rm -v "$VOLUME":/data alpine sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null || true'
docker run --rm -i -v "$VOLUME":/data alpine tar xzf - -C /data < "$TMP/uploads.tar.gz"

echo "[restore] starting everything..."
docker compose up -d --build
echo "[restore] done. Check: docker compose ps"
