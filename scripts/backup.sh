#!/usr/bin/env bash
# Backs up PostgreSQL + uploaded files to S3. Safe to run by hand or from cron.
# Uses the EC2 instance role: no AWS keys needed on the server.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${S3_BUCKET:?S3_BUCKET missing in .env}"
export AWS_DEFAULT_REGION="${AWS_REGION:-us-east-1}"

TS=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
VOLUME=upskill_uploads

echo "[backup] dumping database..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$TMP/db-$TS.dump"
[ -s "$TMP/db-$TS.dump" ] || { echo "[backup] database dump is empty, aborting" >&2; exit 1; }

echo "[backup] archiving uploads..."
docker run --rm -v "$VOLUME":/data:ro alpine tar czf - -C /data . > "$TMP/uploads-$TS.tar.gz"

echo "[backup] uploading to s3://$S3_BUCKET ..."
aws s3 cp "$TMP/db-$TS.dump" "s3://$S3_BUCKET/db/db-$TS.dump" --only-show-errors
aws s3 cp "$TMP/uploads-$TS.tar.gz" "s3://$S3_BUCKET/uploads/uploads-$TS.tar.gz" --only-show-errors
echo "[backup] done: $TS"
