# Roadmap de alojamento — Neon, Render e Vercel

Como montar o Beeznoo do zero, à mão, com as contas novas `@beeznoo.ao`. Começa-se por **staging**; a produção repete os
mesmos passos com os valores da [Fase 9](#fase-9--produção). Regras gerais das contas em `docs/SERVICOS_EXTERNOS.md`.

Os nomes dos menus podem mudar nos painéis. Preços e limites dos planos: confirmar no site de cada serviço.

## Arquitetura

```
Browser ──> beeznoo.ao (Vercel / Next) ──proxy──> API no Render (Spring) ──> Neon (Postgres)
                                                       ├──> Backblaze B2 (ficheiros privados)
                                                       ├──> Resend (email)
                                                       └──> Ombala (SMS)
```

O browser só fala com o Next, que faz proxy de `/api/v1`, `/oauth2/authorization` e `/login/oauth2`. Por isso **não há CORS**
e o cookie do refresh é do nosso domínio (`SameSite=Strict`).

| | Staging | Produção |
|---|---|---|
| Branch Git | `staging` | `main` |
| Site | `https://staging.beeznoo.ao` | `https://beeznoo.ao` |
| Serviço Render | `beeznoo-api-staging` | `beeznoo-api` |
| Branch Neon | `staging` | `production` |
| Bucket B2 | `beeznoo-staging` | `beeznoo-prod` |
| Cliente Google | `Beeznoo Staging` | `Beeznoo Produção` |

## Ordem de trabalho

| Fase | O quê | Depende de |
|---|---|---|
| 0 | Decisões, contas e acesso ao repo | — |
| 1 | Neon | 0 |
| 2 | Backblaze B2 | 0 |
| 3 | Google OAuth | 0 |
| 4 | Ombala e Resend | 0 |
| 5 | Render (API) | 1, 2, 3, 4 |
| 6 | Vercel (frontend) | 5 |
| 7 | DNS | 6 |
| 8 | Testes de staging e primeiro admin | 7 |
| 9 | Produção | 8 validada |
| 10 | Desligar o alojamento antigo | 9 validada |

A API **não arranca** sem Neon, B2, Google e Ombala: não vale a pena criar o Render antes das fases 1 a 4.

---

## Fase 0 — Preparação

### Decisões

| Decisão | Recomendação | Porquê |
|---|---|---|
| Região | **Frankfurt em tudo** (Neon `eu-central-1`, Render Frankfurt, Vercel Functions `fra1`) | Mais perto de Luanda do que Ohio. Neon e Render têm de ficar na mesma região |
| Plano Vercel | **Pro** para a produção | O Hobby é só para uso pessoal, não comercial, e tem restrições em repos privados com vários autores |
| Plano Render | Free em staging; **Starter** em produção | O Free adormece ao fim de 15 min e o primeiro pedido demora cerca de 1 min, o que pode dar timeout no proxy |
| Dados antigos | Começar com BD vazia, salvo se houver dados reais | Se houver, ver [Migrar dados antigos](#migrar-dados-antigos) |

### Contas

1. Criar as contas Neon, Render, Vercel, Backblaze, Resend e Google Cloud com o email `@beeznoo.ao` do projeto.
2. Ligar 2FA em todas e dar acesso de administração a uma segunda pessoa.
3. O repo `parcidio/kubiko` é privado: **o André tem de autorizar as apps da Vercel e do Render** no GitHub, com acesso a esse repo.

### Gerar segredos

Um valor diferente por ambiente. Guardar num gestor de passwords, nunca em Git, Slack ou WhatsApp.

```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -hex 24      # password da role beeznoo_app no Neon
```

Os ficheiros locais `.env.render` e `.env.prod` têm credenciais antigas: não os reutilizes como estão.

---

## Fase 1 — Neon

1. **New Project:** nome `beeznoo`, região `AWS Europe Central 1 (Frankfurt)`. O branch principal chama-se `production`.
2. No **SQL Editor**, branch `production`, criar a role da aplicação. As tabelas ficam do dono (`neondb_owner`), que só o Flyway
   usa; a app não pode alterar o schema. Criar a role por SQL, e não pelo painel, para não herdar `neon_superuser`:

   ```sql
   CREATE ROLE beeznoo_app LOGIN PASSWORD '<password gerada>';
   GRANT CONNECT ON DATABASE neondb TO beeznoo_app;
   GRANT USAGE ON SCHEMA public TO beeznoo_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beeznoo_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO beeznoo_app;
   ```

   Confirma no painel o nome real da BD e do dono; se forem outros, ajusta o SQL.

3. **Branches → New branch:** `staging`, a partir de `production`. Herda a role; muda-lhe a password nesse branch:

   ```sql
   ALTER ROLE beeznoo_app PASSWORD '<outra password gerada>';
   ```

4. Em **Connect**, com o branch `staging` selecionado, anotar as duas ligações:

   | Ligação | Host | Role | Para quê |
   |---|---|---|---|
   | *Pooled* | `ep-…-pooler.….neon.tech` | `beeznoo_app` | `DB_HOST`, `DB_USER`, `DB_PASSWORD` |
   | Direta | `ep-….neon.tech` (sem `-pooler`) | `neondb_owner` | `SPRING_FLYWAY_*` |

**Não correr migrações à mão:** o Flyway aplica V1–V18 no primeiro arranque da API.

---

## Fase 2 — Backblaze B2

1. Ao criar a conta, escolher a região **EU Central**. A região fica fixa na conta e define o endpoint.
2. **Buckets → Create:** `beeznoo-staging`, **privado**, com encriptação do lado do servidor (SSE-B2). Se o nome estiver ocupado, escolhe outro.
3. **Application Keys → Add:** restrita a este bucket, Read and Write.
4. Anotar:

   | Variável | Valor |
   |---|---|
   | `B2_ENDPOINT` | Endpoint S3 do bucket, **com `https://`**. Ex.: `https://s3.eu-central-003.backblazeb2.com` |
   | `B2_REGION` | Parte do meio do endpoint. Ex.: `eu-central-003` |
   | `B2_BUCKET` | `beeznoo-staging` |
   | `B2_ACCESS_KEY` | `keyID` |
   | `B2_SECRET_KEY` | `applicationKey` (só é mostrada uma vez) |

---

## Fase 3 — Google OAuth

1. **Google Cloud → New Project:** `Beeznoo`, com a conta do projeto.
2. **Ecrã de consentimento:** externo, domínio autorizado `beeznoo.ao`, âmbitos `openid`, `profile`, `email`. Em modo de teste,
   só entram as contas adicionadas como *test users*; publicar antes da produção.
3. **Credenciais → OAuth client ID → Web application:** `Beeznoo Staging`, com os *redirect URIs*:

   ```
   https://staging.beeznoo.ao/login/oauth2/code/google
   http://localhost:3000/login/oauth2/code/google
   ```

O callback é **no domínio do site**, não no `onrender.com`: passa pelo proxy do Next. Tem de ser igual a `GOOGLE_REDIRECT_URI`.
O login Google não funciona nos URLs de preview dos PRs, porque não estão registados.

---

## Fase 4 — Ombala e Resend

**Ombala (SMS, obrigatório):** criar um token por ambiente e confirmar que o remetente `Beeznoo` está aprovado. Sem saldo não há
OTP nem login de admin: ligar o alerta de saldo baixo.

**Resend (email, pode ficar para depois):**

1. **Domains → Add:** `beeznoo.ao`, e criar os registos SPF e DKIM indicados.
2. **Cuidado com o email do domínio:** o `beeznoo.ao` já recebe email. Não alteres os registos MX e, se o `_dmarc` já existir, mantém-no.
3. **API Keys:** uma por ambiente, só com permissão de envio.
4. Só com o domínio verificado: `NOTIFICATIONS_EMAIL_ENABLED=true` no Render. Até lá fica `false` e as notificações aparecem só na app.

---

## Fase 5 — Render (API)

Serviço criado à mão, sem Blueprint: as variáveis ficam só no painel.

**New → Web Service**, repo `parcidio/kubiko`:

| Campo | Valor |
|---|---|
| Name | `beeznoo-api-staging` |
| Language | Docker |
| Branch | `staging` |
| Region | Frankfurt |
| Root Directory | `api` (só faz deploy quando a API muda) |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Instance Type | Free |
| Health Check Path | `/actuator/health` |
| Auto-Deploy | On Commit |

**Environment → Add from .env:** colar o bloco abaixo e preencher os `<…>`.

```bash
# Base de dados: ligação pooled, role da app
DB_HOST=<host pooled do branch staging>
DB_PORT=5432
DB_NAME=neondb
DB_USER=beeznoo_app
DB_PASSWORD=<password da beeznoo_app em staging>
DB_SSLMODE=require
DB_POOL_SIZE=5

# Migrações: ligação direta, dono da BD
SPRING_FLYWAY_URL=jdbc:postgresql://<host direto>/neondb?sslmode=require
SPRING_FLYWAY_USER=neondb_owner
SPRING_FLYWAY_PASSWORD=<password do dono em staging>

# Autenticação
JWT_SECRET=<openssl rand -base64 64>
JWT_EXPIRATION_MINUTES=15
GOOGLE_CLIENT_ID=<cliente Beeznoo Staging>
GOOGLE_CLIENT_SECRET=<cliente Beeznoo Staging>
GOOGLE_REDIRECT_URI=https://staging.beeznoo.ao/login/oauth2/code/google
FRONTEND_URL=https://staging.beeznoo.ao
OMBALA_TOKEN=<token de staging>
OMBALA_SENDER=Beeznoo

# Storage privado
B2_ENDPOINT=<https://s3.….backblazeb2.com>
B2_REGION=<região>
B2_BUCKET=beeznoo-staging
B2_ACCESS_KEY=<keyID>
B2_SECRET_KEY=<applicationKey>

# Email
NOTIFICATIONS_EMAIL_ENABLED=false
RESEND_API_KEY=<chave de staging>
RESEND_FROM=Beeznoo <noreply@beeznoo.ao>

# Pagamentos: nunca auto-confirm fora de demo, o admin valida
PAYMENTS_PROVIDER=simulated
PAYMENTS_AUTO_CONFIRM=false

# KYC: false em staging enquanto o KYC não é testável; true em produção
KYC_REQUIRED=false

# Emitente do comprovativo de pagamento (PDF não fiscal)
COMPANY_LEGAL_NAME=Beeznoo
COMPANY_NIF=
COMPANY_ADDRESS=Luanda, Angola
COMPANY_EMAIL=ajuda@beeznoo.ao

# Segurança
API_DOCS_ENABLED=false
SESSION_COOKIE_SECURE=true
ADMIN_MFA_ENABLED=true
RATE_LIMITS_ENABLED=true
RATE_LIMIT_STORE=memory
RATE_LIMIT_TRUSTED_PROXIES=2
```

**Não definir:**

- `PORT`: o Render define-a.
- `RABBITMQ_*`: já não são precisas (a API deixou de incluir RabbitMQ a 2026-11-11).
- **Não definir `JAVA_OPTS` no painel do Render**: substitui o do `api/Dockerfile`, que está medido para 512 MB.
- `CORS_ALLOWED_ORIGINS`, `REFRESH_COOKIE_SAME_SITE`, `NEXT_PUBLIC_*`: não existem no backend da `main`.
- O perfil `seed` (`SPRING_PROFILES_ACTIVE`): só para desenvolvimento.

**Verificar:**

1. Os logs mostram o Flyway a aplicar V1–V18 e a API a arrancar.
2. `curl https://<url-do-render>/actuator/health` devolve `{"status":"UP"}`.
3. No Neon, as tabelas existem e `beeznoo_app` consegue ler: `SET ROLE beeznoo_app; SELECT count(*) FROM profiles;`

Anotar o URL real do serviço (`https://….onrender.com`): é o `API_URL` da fase seguinte.

| Erro nos logs | Causa provável |
|---|---|
| `Could not resolve placeholder` | Falta `OMBALA_*` ou `GOOGLE_CLIENT_*` |
| Falha no arranque com `JWT` ou `B2` | `JWT_SECRET` curto, ou `B2_*` em falta |
| `permission denied for table` | `ALTER DEFAULT PRIVILEGES` não correu antes das migrações, ou o dono tem outro nome |
| Flyway bloqueado ou com erro no pooler | `SPRING_FLYWAY_URL` com `-pooler` no host |
| "exceeded its memory limit" / reinícios | O contentor passou os 512 MB (Free **e** Starter têm 512 MB; o Standard tem 2 GB — confirmar no site). A imagem já vem dimensionada para 512 MB (`JAVA_OPTS` no `api/Dockerfile`, `TOMCAT_MAX_THREADS=40`). Nos logs: `OutOfMemoryError` = um teto da JVM (heap/metaspace) foi atingido; reinício **sem** esse erro = memória fora da JVM. Com mais memória no plano, subir `-XX:MaxRAMPercentage` |

---

## Fase 6 — Vercel (frontend)

**Add New → Project**, repo `parcidio/kubiko`:

| Campo | Valor |
|---|---|
| Framework | Next.js |
| Root Directory | `frontend` |
| Build / Install | Por omissão |
| Production Branch (Settings → Environments) | `main` |
| Functions Region (Settings → Functions) | `fra1` |

**Settings → Environment Variables:**

| Variável | Production | Preview | Nota |
|---|---|---|---|
| `API_URL` | URL do Render de produção | URL do Render de staging | Sem `/` no fim |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número da equipa | Número da equipa | Só dígitos, ex.: `244923000000` |

**Não criar `NEXT_PUBLIC_API_URL`:** vazio é o que ativa o proxy na mesma origem.

**Estas variáveis são lidas no build.** Depois de alterar uma, faz **Redeploy** sem cache; sem isso, o site continua com o valor antigo.

Enquanto a API de produção não existir, faz deploy só da branch `staging`.

---

## Fase 7 — DNS

**Mantém os nameservers atuais** do `beeznoo.ao`: mudá-los para a Vercel pode cortar o email do domínio. Acrescenta só os registos em falta.

1. **Se os domínios ainda estiverem no projeto antigo da Vercel, remove-os de lá primeiro.**
2. **Vercel → Settings → Domains → Add:** `staging.beeznoo.ao`, atribuído à branch `staging`.
3. Criar no DNS o registo que a Vercel indicar (`CNAME` para `staging`).
4. Quando a produção estiver pronta (Fase 9): adicionar `beeznoo.ao` com o registo `A` indicado, e `www.beeznoo.ao` a redirecionar para `beeznoo.ao`.

Não apagar registos `MX` nem `TXT` de email. Se a Vercel pedir login ao abrir o staging, ver **Settings → Deployment Protection**.

---

## Fase 8 — Testes de staging e primeiro admin

### Primeiro admin

Ninguém se regista como admin. Regista a conta pelo site, confirma o telefone e promove-a no **SQL Editor** do branch certo:

```sql
UPDATE profiles SET role = 'ADMIN' WHERE phone = '+244XXXXXXXXX';
```

Sai e volta a entrar. O login de admin pede um código por SMS.

### Checklist

- [ ] `https://staging.beeznoo.ao` abre, com fontes e imagens
- [ ] `https://staging.beeznoo.ao/api/v1/categories` devolve JSON (proxy a funcionar)
- [ ] Registo com telefone: o SMS chega e a conta é confirmada
- [ ] Login por telefone; depois de 15 min a sessão continua (refresh)
- [ ] Login Google volta a `staging.beeznoo.ao/oauth2/callback`
- [ ] Login de admin pede o código SMS
- [ ] Foto de equipamento: envia, abre por URL assinada e, ao apagar, desaparece do B2
- [ ] KYC: documento privado, sem acesso sem URL assinada
- [ ] Reserva completa: pedido → aceite → pagamento validado pelo admin → entrega → devolução → concluída
- [ ] Email chega (só com o Resend ligado)
- [ ] Sem erros de CSP na consola do browser
- [ ] O IP em `security_events` é o teu, e não o da Vercel. Se não for, ajustar `RATE_LIMIT_TRUSTED_PROXIES`

---

## Fase 9 — Produção

Repetir as fases 2 a 8 com estes valores. Só muda o que está na tabela; o resto é igual a staging.

| Onde | Variável ou campo | Produção |
|---|---|---|
| Render | Name / Branch | `beeznoo-api` / `main` |
| Render | Instance Type | Starter (recomendado) |
| Render | `DB_*`, `SPRING_FLYWAY_*` | Branch Neon `production`, credenciais próprias |
| Render | `JWT_SECRET` | **Novo**, nunca o de staging |
| Render | `GOOGLE_CLIENT_*` | Cliente `Beeznoo Produção` |
| Render | `GOOGLE_REDIRECT_URI` | `https://beeznoo.ao/login/oauth2/code/google` |
| Render | `FRONTEND_URL` | `https://beeznoo.ao` |
| Render | `B2_*` | Bucket `beeznoo-prod` com chave própria |
| Render | `OMBALA_TOKEN`, `RESEND_API_KEY` | Próprios de produção |
| Render | `NOTIFICATIONS_EMAIL_ENABLED` | `true` |
| Render | `KYC_REQUIRED` | `true` (é a omissão; nunca `false` em produção) |
| Render | `COMPANY_LEGAL_NAME`, `COMPANY_NIF`, `COMPANY_ADDRESS` | Dados legais da empresa (aparecem no comprovativo) |
| Vercel | `API_URL` (Production) | URL do Render de produção |
| Google | Cliente e consentimento | *Redirect URI* só de `beeznoo.ao`; ecrã publicado |
| DNS | Domínio | `beeznoo.ao` e `www` (Fase 7, ponto 4) |

Na `main`, o merge passa pelo CI e pelo PR; o deploy é automático nos dois serviços.

---

## Fase 10 — Desligar o alojamento antigo

Só com a produção validada:

1. Se houver dados a guardar, fazer `pg_dump` do Neon antigo.
2. Apagar o serviço antigo do Render, o projeto antigo da Vercel e o projeto antigo do Neon.
3. **Revogar as credenciais antigas:** Google, B2, Resend, Ombala.
4. Apagar os `.env.render`, `.env.prod` e `.env.backup` locais, se já não forem precisos.

---

## Migrar dados antigos

Só se houver dados reais a manter. Usar a ligação **direta** e a versão de `pg_dump` igual ou superior à do Postgres de origem.

```bash
pg_dump "<ligação direta antiga>" -Fc --no-owner --no-privileges -f beeznoo.dump
pg_restore -d "<ligação direta nova>" --no-owner --no-privileges beeznoo.dump
```

Fazê-lo **antes do primeiro arranque da API** nesse ambiente: a tabela `flyway_schema_history` vem no dump, por isso o Flyway não volta a aplicar
o que já correu. Restaurar com o dono (`neondb_owner`) e depois dar acesso à app, porque tabelas restauradas podem não ter os privilégios:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beeznoo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beeznoo_app;
```

Os dumps têm dados pessoais: guardar fora do repo e apagar no fim. Os ficheiros também têm de passar para o bucket novo, com as mesmas chaves,
senão as fotos e os documentos deixam de abrir (`rclone` faz cópia entre buckets).
