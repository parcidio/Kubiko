#!/usr/bin/env sh
# Backup diário no servidor do Coolify: base de dados + ficheiros do Garage, 14 dias em /opt/beeznoo-backups.
# cron (root):  0 3 * * *  /opt/beeznoo-backups/backup.sh >> /var/log/beeznoo-backup.log 2>&1
# Copia /opt/beeznoo-backups para FORA do servidor (outro servidor, bucket noutra empresa).
set -eu
DIR=/opt/beeznoo-backups; STAMP=$(date +%Y%m%d-%H%M); mkdir -p "$DIR"
PG=$(docker ps -qf name='^postgres-' | head -1); GA=$(docker ps -qf name='^garage-' | head -1)
[ -n "$PG" ] && [ -n "$GA" ] || { echo "contentores não encontrados"; exit 1; }

docker exec "$PG" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$DIR/db-$STAMP.sql.gz"

META=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/garage/meta"}}{{.Name}}{{end}}{{end}}' "$GA")
DATA=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/garage/data"}}{{.Name}}{{end}}{{end}}' "$GA")
docker stop "$GA" >/dev/null
docker run --rm -v "$META":/meta:ro -v "$DATA":/data:ro -v "$DIR":/out alpine tar czf "/out/files-$STAMP.tar.gz" -C / meta data
docker start "$GA" >/dev/null

find "$DIR" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DIR" -name 'files-*.tar.gz' -mtime +14 -delete
echo "$(date) backup ok: db-$STAMP.sql.gz files-$STAMP.tar.gz"
