# Serviços externos — contas e configuração

Estado a 2026-10-23. Como passar cada serviço das contas pessoais da equipa para contas do projeto, e o que tem de
estar configurado em staging e produção. Variáveis em `.env.example`; controlos de segurança em `docs/SEGURANCA.md`.

## Regras comuns

- Conta do **projeto** (email `@beeznoo.ao` partilhado pelo André), nunca a conta pessoal de quem a criou.
- 2FA ligado em todas as contas; pelo menos **duas pessoas** com acesso de administração (o André + uma).
- Uma chave/credencial **por ambiente** (local, staging, produção), com o mínimo de permissões. Nunca reutilizar.
- Segredos só nas variáveis do Render/Vercel e nos `.env` locais — nunca no Git, Slack ou WhatsApp.
- Ao passar de uma conta pessoal para a do projeto: criar credenciais novas, trocar no Render/Vercel, **apagar as antigas**.

## Serviços

| Serviço | Para quê | Variáveis | Configuração obrigatória |
|---|---|---|---|
| **Neon** | Postgres | `DB_*` | Connection string *pooled*; um branch por ambiente; utilizador da app sem permissões de dono da BD em produção |
| **Render** | API Spring (`render.yaml`) | todas as do backend | `DB_SSLMODE=require`, `SPRING_FLYWAY_URL` direto, `GOOGLE_REDIRECT_URI` em https, `SESSION_COOKIE_SECURE=true`, `API_DOCS_ENABLED=false`, `PAYMENTS_AUTO_CONFIRM=false`, `ADMIN_MFA_ENABLED=true`, `RATE_LIMIT_TRUSTED_PROXIES=2`; `JWT_SECRET` com `openssl rand -base64 64`, diferente por ambiente |
| **Vercel** | Frontend Next | `API_URL` | Previews por PR apontam para staging, nunca para produção |
| **Backblaze B2** | KYC, fotos, checklists, problemas | `B2_*` | Bucket **privado** por ambiente; chave de aplicação restrita a esse bucket; encriptação do lado do servidor ligada |
| **Resend** | Email | `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATIONS_EMAIL_ENABLED` | Domínio `beeznoo.ao` verificado (SPF, DKIM, DMARC); chave só com permissão de envio |
| **Google Cloud** | Login Google | `GOOGLE_CLIENT_*` | Projeto do Beeznoo; *redirect URIs* só dos domínios reais (`…/login/oauth2/code/google`); ecrã de consentimento publicado |
| **Ombala** | SMS (OTP e 2FA de admin) | `OMBALA_TOKEN`, `OMBALA_SENDER` | Remetente `Beeznoo`; alerta de saldo baixo (sem saldo não há login de admin) |
| **GitHub** | Repo e CI | — | Proteção de `main` com os checks `build`, `frontend`, `secrets`, `deps` e 1 review obrigatórios; Dependabot alerts ligados |

## Deploy da API no Render

A configuração está em `render.yaml` (Blueprint) e a imagem em `api/Dockerfile`.

1. **Neon:** o projeto está em `us-east-2` (Ohio) — o serviço do Render tem de estar na região **Ohio**. Anotar duas ligações: a *pooled*
   (`…-pooler.…neon.tech`, para a app) e a direta (para as migrações Flyway).
2. **Render → New → Blueprint** e escolher o repo (ou, num serviço já criado, Environment → **Add from .env** com o `.env.render` local, que o Git ignora). O Render pede os valores com `sync: false`:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: os da ligação *pooled*;
   - `SPRING_FLYWAY_URL` (`jdbc:postgresql://<host direto>/<db>?sslmode=require`), `SPRING_FLYWAY_USER`, `SPRING_FLYWAY_PASSWORD`;
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OMBALA_TOKEN`, `B2_*`, `RESEND_API_KEY`.
   O `JWT_SECRET` é gerado pelo Render; `FRONTEND_URL` e `GOOGLE_REDIRECT_URI` já vêm com `https://staging.beeznoo.ao`
   (este serviço é o de **staging**; a produção terá o seu, com `https://beeznoo.ao`).
3. **Vercel:** `API_URL=https://beeznoo.onrender.com` (ambiente **Preview**, branch `staging`, e Production) e `NEXT_PUBLIC_API_URL` **vazio**.
   Domínios: `staging.beeznoo.ao` → branch `staging`; `beeznoo.ao` → `main`.
   O Next faz proxy de `/api/v1`, `/oauth2/authorization` e `/login/oauth2` para a API: o browser só vê `beeznoo.ao`.
4. **Google Cloud → Credenciais → cliente OAuth:** *redirect URIs* autorizados `https://staging.beeznoo.ao/login/oauth2/code/google`,
   `https://beeznoo.ao/login/oauth2/code/google`
   (e `http://localhost:3000/login/oauth2/code/google` para desenvolvimento).
5. Primeiro deploy: o Flyway aplica V1–V18. Confirmar `https://beeznoo.onrender.com/actuator/health` → `{"status":"UP"}`.

O build da imagem não corre testes (precisam de Docker); quem bloqueia o merge é o CI.

**Plano grátis do Render:** 512 MB e CPU partilhada; o serviço **adormece ao fim de 15 min sem pedidos** e o primeiro
pedido a seguir espera o arranque do Spring (~1 min). Consequências: o primeiro login/OTP do dia é lento e pode dar
timeout no proxy da Vercel — tenta outra vez. Passar a `starter` é mudar uma linha no `render.yaml`.

## Teste manual do bucket (antes de fazer merge de uma atualização do AWS SDK)

O B2 não suporta tudo o que o SDK envia por omissão (ver `B2StorageService`). Em staging, depois do deploy do PR:

1. Enviar uma foto de equipamento e um documento KYC (PDF).
2. Abrir os dois pelas URLs assinadas (têm de abrir e expirar ao fim de `APP_STORAGE_SIGNED_URL_TTL`).
3. Apagar a foto e confirmar no painel do B2 que o ficheiro desapareceu.

Se algum passo falhar, não fazer merge.
