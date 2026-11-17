#!/usr/bin/env sh
# Atualizar para a última versão da main: código novo, imagens novas, migrações Flyway aplicadas no arranque da API.
# Atualização rolante: uma réplica da API de cada vez, à espera de que fique saudável; o Caddy tira da rotação a que
# está a reiniciar, por isso o site não pára. Ver docs/DEPLOY_VPS.md (§6).
set -eu
cd "$(dirname "$0")"
DC="docker compose --env-file .env"

# Espera que o health check do contentor (GET /actuator/health) fique "healthy" (até ~4 min)
wait_healthy() {
  id=$($DC ps -q "$1")
  i=0
  while [ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" != "healthy" ]; do
    i=$((i + 1))
    if [ "$i" -gt 48 ]; then
      echo "$1 não ficou saudável. Ver: $DC logs --tail 200 $1" >&2
      exit 1
    fi
    sleep 5
  done
  echo "$1 saudável"
}

./backup.sh
git -C ../.. pull --ff-only
$DC build

# api-1 primeiro: aplica as migrações (o Flyway bloqueia a BD enquanto as aplica). Durante uns segundos api-2 ainda
# corre o código antigo com o schema novo: as migrações têm de ser compatíveis com a versão anterior (só acrescentar).
$DC up -d --no-deps api-1
wait_healthy api-1
$DC up -d --no-deps api-2
wait_healthy api-2

# O resto (web, caddy, postgres, garage) só reinicia se a imagem ou a configuração mudou
$DC up -d
docker image prune -f >/dev/null
$DC ps
