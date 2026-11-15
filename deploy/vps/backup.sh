#!/usr/bin/env sh
# Cópia de segurança diária: base de dados (pg_dump) e ficheiros (volumes do Garage). Guarda 14 dias.
# cron (root):  0 3 * * *  /opt/beeznoo/deploy/vps/backup.sh >> /var/log/beeznoo-backup.log 2>&1
# Copia a pasta backups/ para FORA da VPS (outro servidor, disco externo) — uma cópia no mesmo disco não chega.
set -eu
cd "$(dirname "$0")"
set -a; . ./.env; set +a
DIR=./backups; STAMP=$(date +%Y%m%d-%H%M); mkdir -p "$DIR"

docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip > "$DIR/db-$STAMP.sql.gz"

# o Garage pára uns segundos para a cópia dos ficheiros ser consistente
docker compose stop garage
docker run --rm -v beeznoo_garage_meta:/meta:ro -v beeznoo_garage_data:/data:ro -v "$(pwd)/$DIR":/out alpine \
  tar czf "/out/files-$STAMP.tar.gz" -C / meta data
docker compose start garage

find "$DIR" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DIR" -name 'files-*.tar.gz' -mtime +14 -delete
echo "$(date) backup ok: $DIR/db-$STAMP.sql.gz $DIR/files-$STAMP.tar.gz"
