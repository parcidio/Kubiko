#!/usr/bin/env sh
# Gera os segredos da VPS. Uso: ./generate-secrets.sh  (copia as linhas para o .env)
set -eu
hex() { openssl rand -hex "$1"; }
echo "DB_PASSWORD=$(hex 24)"
echo "JWT_SECRET=$(hex 48)"
echo "GARAGE_RPC_SECRET=$(hex 32)"
echo "S3_ACCESS_KEY=GK$(hex 12)"
echo "S3_SECRET_KEY=$(hex 32)"
