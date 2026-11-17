# Balanceador interno da API (Caddy) com a configuração lá dentro: o Coolify constrói a partir do repositório e
# não monta ficheiros soltos. Ver deploy/coolify/docker-compose.yml.
FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8080
