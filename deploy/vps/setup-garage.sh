#!/usr/bin/env sh
# Prepara o Garage na primeira vez: layout do nó, chave da API e bucket privado. Pode correr-se outra vez sem estragar.
# Uso (na pasta deploy/vps, com o .env preenchido e o garage a correr):  ./setup-garage.sh
set -eu
cd "$(dirname "$0")"
set -a; . ./.env; set +a
# COMPOSE_ARGS: ficheiros compose extra (ex. "-f docker-compose.yml -f outro.yml"); normalmente vazio
g() { docker compose ${COMPOSE_ARGS:-} exec -T garage /garage "$@"; }

NODE=$(g status 2>/dev/null | awk '/^[0-9a-f]{16}/ {print $1; exit}')
[ -n "$NODE" ] || { echo "Garage não respondeu: está a correr? (docker compose up -d garage)"; exit 1; }

if g layout show 2>/dev/null | grep -q "No nodes currently have a role"; then
  g layout assign -z dc1 -c "${GARAGE_CAPACITY:-50G}" "$NODE"
  g layout apply --version 1
fi

g key info beeznoo-api >/dev/null 2>&1 || g key import --yes -n beeznoo-api "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
g bucket info "$S3_BUCKET" >/dev/null 2>&1 || g bucket create "$S3_BUCKET"
g bucket allow --read --write --owner "$S3_BUCKET" --key beeznoo-api
echo "Garage pronto: bucket $S3_BUCKET com a chave beeznoo-api (privado: só URLs assinadas)."
