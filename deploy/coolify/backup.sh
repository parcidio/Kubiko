#!/usr/bin/env sh
# Backup diário no servidor do Coolify: base de dados + ficheiros do Garage, 14 dias em /opt/beeznoo-backups/<recurso>.
# RESOURCE = UUID do recurso no Coolify (aparece nos nomes dos contentores: postgres-<RESOURCE>-…). Obrigatório quando
# o servidor tem mais do que um ambiente (staging e produção), para nunca copiar a base de dados errada.
# cron (root):  0 3 * * *  RESOURCE=<uuid> /opt/beeznoo-backups/backup.sh >> /var/log/beeznoo-backup.log 2>&1
# ⚠ As cópias têm documentos de KYC: ficam só legíveis pelo root. Copia-as ENCRIPTADAS para FORA do servidor
#   (docs/DEPLOY_VPS.md §8) — uma cópia no mesmo disco não protege contra a perda do servidor.
set -eu
umask 077
RES="${RESOURCE:-}"
DIR=/opt/beeznoo-backups/${RES:-default}; STAMP=$(date +%Y%m%d-%H%M); mkdir -p "$DIR"; chmod 700 "$DIR"

one() { # um só contentor com este prefixo, senão pára
  n=$(docker ps -qf name="^$1-$RES" | wc -l | tr -d ' ')
  [ "$n" = 1 ] || { echo "esperava 1 contentor '$1-$RES*', encontrei $n (define RESOURCE)"; exit 1; }
  docker ps -qf name="^$1-$RES"
}
PG=$(one postgres); GA=$(one garage)

docker exec "$PG" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$DIR/db-$STAMP.sql.gz"
gzip -t "$DIR/db-$STAMP.sql.gz"   # a cópia da BD tem de se poder ler

META=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/garage/meta"}}{{.Name}}{{end}}{{end}}' "$GA")
DATA=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/garage/data"}}{{.Name}}{{end}}{{end}}' "$GA")
# o Garage pára uns segundos para a cópia dos ficheiros ser consistente; volta a arrancar mesmo se o tar falhar
docker stop "$GA" >/dev/null
trap 'docker start "$GA" >/dev/null' EXIT
docker run --rm -v "$META":/meta:ro -v "$DATA":/data:ro -v "$DIR":/out alpine tar czf "/out/files-$STAMP.tar.gz" -C / meta data
docker start "$GA" >/dev/null; trap - EXIT

find "$DIR" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DIR" -name 'files-*.tar.gz' -mtime +14 -delete
echo "$(date) backup ok: $DIR/db-$STAMP.sql.gz ($(du -h "$DIR/db-$STAMP.sql.gz" | cut -f1)) files-$STAMP.tar.gz ($(du -h "$DIR/files-$STAMP.tar.gz" | cut -f1))"
