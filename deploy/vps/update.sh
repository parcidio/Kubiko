#!/usr/bin/env sh
# Atualizar para a última versão da main: código novo, imagens novas, migrações Flyway aplicadas no arranque da API.
set -eu
cd "$(dirname "$0")"
./backup.sh
git -C ../.. pull --ff-only
docker compose --env-file .env up -d --build
docker image prune -f >/dev/null
docker compose ps
