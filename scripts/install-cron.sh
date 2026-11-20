#!/usr/bin/env bash
# Installs a nightly backup at 02:00 server time (UTC by default).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LINE="0 2 * * * cd $DIR && ./scripts/backup.sh >> /var/log/upskill-backup.log 2>&1"
sudo touch /var/log/upskill-backup.log && sudo chown "$USER" /var/log/upskill-backup.log
( crontab -l 2>/dev/null | grep -v 'scripts/backup.sh' ; echo "$LINE" ) | crontab -
echo "Installed. Current crontab:"; crontab -l
