#!/usr/bin/env sh
# Prepara o Garage no Coolify (correr UMA vez no servidor, por SSH, depois do primeiro deploy).
# Uso: S3_ACCESS_KEY=GK... S3_SECRET_KEY=... ./setup-garage.sh   (os mesmos valores das variáveis do Coolify)
set -eu
: "${S3_ACCESS_KEY:?define S3_ACCESS_KEY}"; : "${S3_SECRET_KEY:?define S3_SECRET_KEY}"
BUCKET="${S3_BUCKET:-beeznoo}"; CAP="${GARAGE_CAPACITY:-50G}"
C=$(docker ps -qf name='^garage-' | head -1)
[ -n "$C" ] || { echo "Não encontrei o contentor do Garage (deploy feito no Coolify?)"; exit 1; }
g() { docker exec "$C" /garage "$@"; }
NODE=$(g status 2>/dev/null | awk '/^[0-9a-f]{16}/ {print $1; exit}')
if g layout show 2>/dev/null | grep -q "No nodes currently have a role"; then
  g layout assign -z dc1 -c "$CAP" "$NODE"
  g layout apply --version 1
fi
g key info beeznoo-api >/dev/null 2>&1 || g key import --yes -n beeznoo-api "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
g bucket info "$BUCKET" >/dev/null 2>&1 || g bucket create "$BUCKET"
g bucket allow --read --write --owner "$BUCKET" --key beeznoo-api
echo "Garage pronto: bucket $BUCKET (privado, só URLs assinadas)."
