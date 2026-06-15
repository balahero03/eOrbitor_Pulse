#!/bin/bash
# eOrbitor Pulse - PostgreSQL backup
# Dumps the database from the running Docker container to a timestamped,
# gzipped file, and prunes backups older than RETENTION_DAYS.
set -euo pipefail

# --- config ---
BACKUP_DIR="${BACKUP_DIR:-$HOME/eorbitor-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_CONTAINER="eorbitor-db"
DB_USER="eorbitor"
DB_NAME="eorbitor_pulse"
# --------------

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="$BACKUP_DIR/eorbitor_pulse_$TS.sql.gz"

echo "[backup] Dumping $DB_NAME from container $DB_CONTAINER ..."
# pg_dump runs inside the container (no host psql needed). -Fc would be custom
# format; we use plain SQL gzipped so it's portable and inspectable.
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] Wrote $OUT ($SIZE)"

echo "[backup] Pruning backups older than $RETENTION_DAYS days ..."
find "$BACKUP_DIR" -name 'eorbitor_pulse_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete || true

echo "[backup] Done. Current backups:"
ls -lh "$BACKUP_DIR"/eorbitor_pulse_*.sql.gz 2>/dev/null | tail -10
