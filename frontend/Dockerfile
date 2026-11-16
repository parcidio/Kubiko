# Frontend Beeznoo (Next.js) — imagem para a VPS (deploy/vps). No Vercel não é usada.
# API_URL e STORAGE_PUBLIC_ORIGIN entram no BUILD: o Next grava as rewrites e os cabeçalhos (CSP) na compilação.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG API_URL=http://api:8080
ARG STORAGE_PUBLIC_ORIGIN=
ARG NEXT_PUBLIC_WHATSAPP_NUMBER=
# URL público do site (pré-visualização dos links no WhatsApp: og:image com endereço absoluto)
ARG SITE_URL=https://beeznoo.ao
ENV API_URL=$API_URL \
    SITE_URL=$SITE_URL \
    STORAGE_PUBLIC_ORIGIN=$STORAGE_PUBLIC_ORIGIN \
    NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
# API_URL e SITE_URL também em execução: a imagem de partilha de cada equipamento lê a API no servidor
ARG API_URL=http://api:8080
ARG SITE_URL=https://beeznoo.ao
ENV API_URL=$API_URL SITE_URL=$SITE_URL
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S next && adduser -S next -G next
COPY --from=build --chown=next:next /app/.next/standalone ./
COPY --from=build --chown=next:next /app/.next/static ./.next/static
COPY --from=build --chown=next:next /app/public ./public
USER next
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD wget -q --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
