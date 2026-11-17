# Alojamento numa VPS: tudo no mesmo servidor

Como pôr o Beeznoo a correr numa VPS (ex.: Contabo) com Docker Compose: site, API, base de dados e ficheiros no mesmo
servidor. Ficheiros em `deploy/vps/`. Há uma variante para o **Coolify** em `deploy/coolify/` (ver [Coolify](#variante-coolify)).

> **Decisão em aberto:** o `docs/DEPLOY.md` descreve outra opção (Neon + Render + Vercel + Backblaze B2). O André escolhe
> qual das duas é a produção e regista-o em `claude/decisoes-produto.md` antes do primeiro deploy.

| | VPS (este guia) | Neon + Render + Vercel (`DEPLOY.md`) |
|---|---|---|
| Custo | Um servidor com preço fixo | Vários planos; o Render e o Vercel Pro custam por mês |
| Operação | **Somos nós** que tratamos de atualizações do SO, backups, disco e segurança do servidor | Os serviços tratam disso |
| Backups | Script próprio (`backup.sh`), cópia para fora do servidor à nossa conta | Neon com histórico e branching; B2 com versões |
| Falhas | Um ponto único: se o servidor cair, cai tudo | Serviços separados |
| Memória da API | 4 GB partilhados no servidor, folga suficiente | 512 MB no Render, afinado no `api/Dockerfile` |

## Arquitetura

Decisão em `claude/decisoes-produto.md` (2026-11-17, ponto 8): **o Caddy é a única porta de entrada**; a API corre em
2 réplicas atrás de um balanceador interno e nenhuma porta da API, da BD ou do Garage é publicada no host.

```
                      Internet
                         │ 80 / 443 (as únicas portas publicadas; ufw: 22, 80, 443)
┌────────────────────────┼──────────────────────────────────────── VPS ─┐
│                        ▼                                               │
│   caddy  (HTTPS, cabeçalhos de segurança, /actuator → 404)             │
│     ├── beeznoo.ao ─────────► web  (Next.js :3000)                     │
│     │                           │  /api/v1, /oauth2/authorization, /login/oauth2
│     │                           ▼                                      │
│     ├── :8080 "api-lb" ◄────────┘   balanceador interno, sem porta no host
│     │     │  least_conn + afinidade por cookie (bz_lb), health check   │
│     │     ├──────► api-1 (Spring :8080, agendadores ligados) ──┐       │
│     │     └──────► api-2 (Spring :8080, agendadores desligados) ┤      │
│     │                                                           ▼      │
│     │                                  postgres :5432 (rede "data", internal)
│     └── s3.beeznoo.ao ──────► garage (S3 :3900, rede "storage", internal)
│                                                                        │
│   api-1/2 ──► https://s3.beeznoo.ao = alias do caddy na rede "backend" │
└────────────────────────────────────────────────────────────────────────┘
```

| Rede Docker | Quem | Saída para a Internet | Para quê |
|---|---|---|---|
| `public` | caddy, web | sim | Caddy → Next; Next → `api-lb`; Let's Encrypt; o Next lê fotos para as imagens de partilha |
| `backend` | caddy, api-1, api-2 | sim | `api-lb` → réplicas; a API fala com Losambo, Ombala, Resend, Google e com o Garage pelo URL público |
| `data` | api-1, api-2, postgres | **não** (`internal: true`) | Só as réplicas da API veem o Postgres |
| `storage` | caddy, garage | **não** (`internal: true`) | Só o Caddy vê o Garage |

- **Só o Caddy publica portas** (80 e 443). A API, o `api-lb` (8080), o Postgres e o Garage só têm `expose:`. O Next
  não chega às réplicas diretamente (não está na rede `backend`), só ao balanceador.
- O browser só fala com o Next, que faz proxy de `/api/v1`, `/oauth2/authorization` e `/login/oauth2` para
  `http://api-lb:8080`. Sem CORS. O `api-lb` só deixa passar esses caminhos (o resto, incluindo `/actuator`, dá 404),
  e a borda responde 404 a `/actuator`, `/v3/api-docs` e `/swagger-ui`.
- **Balanceamento:** `least_conn` na primeira visita e depois **afinidade por cookie** (`bz_lb`). É precisa para o
  login Google: o Spring guarda o pedido OAuth2 (e a intenção "associar Google") na sessão HTTP da réplica que o
  iniciou, e o regresso do Google tem de cair na mesma. O cookie só escolhe a réplica (não tem dados); se a réplica
  estiver em baixo, o Caddy usa a outra.
- **Health check:** o Caddy pergunta `/actuator/health` a cada réplica a cada 10 s e tira da rotação a que falhar
  (também durante 30 s depois de um pedido falhado). Uma réplica a reiniciar (deploy, falta de memória) não corta o site.
- **Agendadores** (expirar pedidos e pagamentos) só correm na `api-1` (`SCHEDULER_ENABLED=true`); na `api-2` estão
  desligados. Mesmo a correr nas duas o resultado seria igual (cada expiração bloqueia a linha e volta a verificar),
  mas haveria notificações e logs repetidos. Se a `api-1` estiver em baixo, as expirações esperam que volte.
- **Limites de pedidos partilhados:** com 2 réplicas os contadores ficam no Postgres (`RATE_LIMIT_STORE=database`,
  fixado no compose). Com `memory`, cada réplica contava à parte e um atacante tinha o dobro das tentativas de OTP.
  O Caddy oficial não tem limite de pedidos (precisaria de um plugin e de uma imagem própria): os limites são os da API.
- **IP do cliente:** o Caddy da borda ignora o `X-Forwarded-For` que vem da Internet e escreve o IP real; o Next
  mantém-no; o `api-lb` acrescenta o IP do Next. A API recebe `cliente, next` e usa
  `RATE_LIMIT_TRUSTED_PROXIES=2`. O Spring não usa `X-Forwarded-*` para mais nada (`forward-headers-strategy: none`).
- O Garage serve **apenas URLs assinadas**: sem assinatura válida responde 403. O bucket é privado. A porta de
  administração do Garage (3903) só escuta em `127.0.0.1` dentro do contentor; a RPC (3901) não sai da rede `storage`.
- A API chega ao Garage pelo URL público (`s3.beeznoo.ao`, que faz parte da assinatura): na rede `backend` esse nome é
  um alias do Caddy, por isso o pedido não sai do Docker e o certificado é o mesmo.
- As migrações Flyway correm no arranque da API. As duas réplicas podem arrancar juntas: o Flyway bloqueia a BD
  enquanto aplica e a segunda espera.

| Serviço | Imagem | Dados persistentes (volume) | Memória (teto) |
|---|---|---|---|
| `caddy` | `caddy:2.8-alpine` | `caddy_data`, `caddy_config` (certificados) | ~50 MB |
| `web` | `frontend/Dockerfile` (Next standalone) | — | `WEB_MEM_LIMIT` (512 MB) |
| `api-1`, `api-2` | `api/Dockerfile` (mesma imagem, `beeznoo-api:local`) | — | `API_MEM_LIMIT` (768 MB cada) |
| `postgres` | `postgres:16-alpine` | `postgres_data` | ~300–500 MB |
| `garage` | `dxflrs/garage:v1.1.0` | `garage_meta`, `garage_data` (fotos, KYC, checklists) | ~100 MB |

### Memória: 2 réplicas numa VPS de 4 GB

Cada réplica tem um teto (`mem_limit`). Sem ele, `-XX:MaxRAMPercentage=50` media a RAM **da VPS inteira**: duas JVMs
podiam pedir 2 GB de heap cada e o kernel matava processos ao acaso (incluindo o Postgres).

| | Por réplica | 2 réplicas |
|---|---|---|
| Teto do contentor (`API_MEM_LIMIT`) | 768 MB | 1,5 GB |
| Heap (`MaxRAMPercentage=50`) | ~384 MB | ~768 MB |
| Fora do heap (metaspace ≤ 160, código ≤ 64, threads, buffers) | ~250 MB | ~500 MB |

Total previsto: API 1,5 GB + Next 0,5 GB + Postgres ~0,5 GB + Garage/Caddy ~0,15 GB + SO ~0,4 GB ≈ **3 GB de 4 GB**.
A API no Render já corria com ~400 MB (`api/Dockerfile`, medido), por isso 768 MB por réplica tem folga.

**Trade-off.** Duas réplicas custam ~700 MB a mais do que uma. Em troca: atualizações sem cortar a API (uma réplica de
cada vez), uma réplica que morre por falta de memória não derruba o serviço, e os 2 vCPU ficam melhor aproveitados.
**Não é alta disponibilidade:** continua a haver um só servidor e um só Postgres — se a VPS cair, cai tudo. Se a
memória apertar (`docker stats`), as opções são, por esta ordem: subir a VPS para 8 GB; ou voltar a uma réplica
(apagar `api-2` do compose e do `Caddyfile`). Os limites de pedidos no Postgres fazem uma escrita por pedido; com o
tráfego do MVP é irrelevante.

---

## 1. Antes de começar

### Servidor

- Ubuntu 24.04 LTS, **4 GB de RAM** no mínimo, 2 vCPU, disco SSD com folga para fotos e backups (80 GB ou mais).
- Acesso por SSH com chave; login por password desligado.
- Região: a mais próxima de Luanda que o fornecedor tiver (Europa).

### Contas e chaves (fora do servidor)

| O quê | Para quê | Onde |
|---|---|---|
| DNS de `beeznoo.ao` | Registos A para o site e para o armazenamento | Registo do domínio |
| Google Cloud: cliente OAuth `Beeznoo Produção` | Login Google | `DEPLOY.md`, Fase 3 |
| Losambo: chave `PRD` (e `TST` para testes) | OTP por WhatsApp | `docs/WHATSAPP_OTP_INTEGRATION.md` |
| Ombala (opcional) | SMS como alternativa ao WhatsApp | `OMBALA_SMS_INTEGRATION.md` |
| Resend (opcional) | Emails de notificação | `DEPLOY.md`, Fase 4 |
| Destino dos backups **fora do servidor** | Cópia dos backups (ver [§8](#8-backups)) | A decidir |

### DNS

Criar dois registos **A** a apontar para o IP da VPS, **antes** de arrancar o Caddy (senão o Let's Encrypt falha):

| Nome | Tipo | Valor |
|---|---|---|
| `beeznoo.ao` | A | IP da VPS |
| `s3.beeznoo.ao` | A | IP da VPS |

Confirmar com `dig +short beeznoo.ao` e `dig +short s3.beeznoo.ao`.

---

## 2. Preparar o servidor

Como `root` (ou com `sudo`):

```bash
apt update && apt upgrade -y
apt install -y git ufw unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades     # atualizações de segurança automáticas

# Firewall: só SSH e HTTP/HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable

# Docker (repositório oficial) com o plugin compose
curl -fsSL https://get.docker.com | sh
docker compose version
```

> O Docker abre as portas publicadas por fora do `ufw`. Aqui só o Caddy publica portas, por isso não há problema, mas
> **não acrescentes `ports:` à API, ao Postgres nem ao Garage** no `docker-compose.yml` — usa `expose:`. Para
> consultar a BD, `docker compose exec postgres psql …` no servidor; nunca uma porta publicada.

Desligar o login por password no SSH (`/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`)
e `systemctl restart ssh`. Testar noutra janela antes de fechar a sessão atual.

### Código

O repo `parcidio/kubiko` é privado. Usar uma **deploy key só de leitura** (não a chave pessoal de ninguém):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/beeznoo_deploy -N ""
cat ~/.ssh/beeznoo_deploy.pub
# GitHub › parcidio/kubiko › Settings › Deploy keys › Add (sem "Allow write access")

cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/beeznoo_deploy
  IdentitiesOnly yes
EOF

git clone git@github.com:parcidio/kubiko.git /opt/beeznoo
cd /opt/beeznoo/deploy/vps
```

O `update.sh` faz `git pull` da branch que estiver ativa: em produção, `main`.

---

## 3. Configurar o `.env`

```bash
cp .env.example .env
chmod 600 .env
./generate-secrets.sh
```

O `generate-secrets.sh` imprime `DB_PASSWORD`, `JWT_SECRET`, `GARAGE_RPC_SECRET`, `S3_ACCESS_KEY` e `S3_SECRET_KEY`.
Copia esses valores para as linhas correspondentes do `.env` (não deixes linhas repetidas) e guarda uma cópia do `.env`
num gestor de passwords. **Nunca** em Git, Slack ou WhatsApp.

Preencher o resto:

| Variável | Valor em produção | Notas |
|---|---|---|
| `WEB_DOMAIN`, `PUBLIC_WEB_URL` | `beeznoo.ao`, `https://beeznoo.ao` | |
| `S3_DOMAIN`, `S3_DOMAIN_HOST`, `PUBLIC_S3_URL` | `s3.beeznoo.ao`, `s3.beeznoo.ao`, `https://s3.beeznoo.ao` | O host entra na assinatura dos URLs |
| `ACME_EMAIL` | `tech@beeznoo.ao` | Avisos do Let's Encrypt |
| `GARAGE_CAPACITY` | Ex.: `50G` | Menos do que o disco livre; deixar espaço para backups |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente `Beeznoo Produção` | Redirect URI registado: `https://beeznoo.ao/login/oauth2/code/google` |
| `WHATSAPP_API_KEY_PRD`, `WHATSAPP_ENV` | Chave PRD, `prd` | Em staging: `WHATSAPP_API_KEY_TST` e `tst` |
| `OMBALA_TOKEN` | Opcional | Sem WhatsApp nem SMS, ninguém recebe OTP (a API regista o erro `OTP sem canal`) |
| `NOTIFICATIONS_EMAIL_ENABLED`, `RESEND_API_KEY` | `true` + chave, ou `false` | Com `false` as notificações ficam só na app |
| `KYC_REQUIRED` | `true` | **Nunca `false` em produção** |
| `PAYMENTS_MODE` | `direct` | Paga-se ao dono na entrega (decisoes-produto.md 2026-11-15) |
| `ADMIN_MFA_ENABLED` | `true` | O login de admin pede um código (WhatsApp ou SMS) |
| `COMPANY_NIF`, `COMPANY_LEGAL_NAME` | Dados reais da empresa | Saem no comprovativo em PDF |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número da equipa | Entra **no build** do frontend |

Variáveis que o `docker-compose.yml` já fixa e **não vão no `.env`**: `DB_HOST`, `DB_SSLMODE`, `FRONTEND_URL`,
`GOOGLE_REDIRECT_URI`, `B2_*`, `SESSION_COOKIE_SECURE=true`, `RATE_LIMIT_STORE=database`,
`RATE_LIMIT_TRUSTED_PROXIES=2` (Caddy da borda + `api-lb`), `SCHEDULER_ENABLED` (só `api-1`), `API_DOCS_ENABLED=false`.
Opcionais: `API_MEM_LIMIT` (768m), `WEB_MEM_LIMIT` (512m), `API_JAVA_OPTS`.

`PAYMENTS_AUTO_CONFIRM` e `API_DOCS_ENABLED` não devem aparecer no `.env` de produção: a omissão (`false`) é a certa.

> `API_URL`, `STORAGE_PUBLIC_ORIGIN` e `NEXT_PUBLIC_WHATSAPP_NUMBER` ficam gravados na imagem do frontend no build
> (rewrites e CSP). Se mudares algum, volta a fazer `docker compose up -d --build web`.

---

## 4. Primeiro arranque

Na pasta `deploy/vps`:

```bash
# 1. Postgres e Garage primeiro
docker compose --env-file .env up -d postgres garage

# 2. Layout do Garage, chave da API e bucket privado (pode correr-se outra vez sem estragar)
./setup-garage.sh

# 3. O resto (o build demora alguns minutos na primeira vez)
docker compose --env-file .env up -d --build

# 4. Estado e logs
docker compose ps
docker compose logs -f api-1 api-2   # esperar "Started ...Application"; as migrações Flyway aparecem antes
```

O `web` só arranca quando a `api-1` estiver saudável (`/actuator/health`). O Caddy pede os certificados no primeiro pedido
a cada domínio; se falhar, ver `docker compose logs caddy` (quase sempre DNS ainda a propagar ou porta 80 fechada).

### Primeiro admin

Ninguém se regista como admin. Regista a conta pelo site, confirma o telefone e promove-a:

```bash
docker compose exec postgres psql -U beeznoo -d beeznoo \
  -c "UPDATE profiles SET role = 'ADMIN' WHERE phone = '+244XXXXXXXXX';"
```

(Ajusta `-U` e `-d` se mudaste `DB_USER` ou `DB_NAME`.) Sai e volta a entrar: o login de admin pede um código.

---

## 5. Verificação

- [ ] `https://beeznoo.ao` abre com fontes e imagens; o cadeado mostra um certificado válido
- [ ] `https://beeznoo.ao/api/v1/categories` devolve JSON (proxy do Next a funcionar)
- [ ] `https://s3.beeznoo.ao/beeznoo/qualquer-coisa` responde **403** (bucket privado)
- [ ] Registo com telefone: o código chega por WhatsApp (ou SMS) e a conta fica confirmada
- [ ] Login por telefone; passados 15 min a sessão continua (refresh)
- [ ] Login Google volta a `https://beeznoo.ao/oauth2/callback`
- [ ] Login de admin pede o código
- [ ] Foto de equipamento: envia, abre por URL assinada e, ao apagar, deixa de abrir
- [ ] KYC: o documento só abre pelo URL assinado do admin, que expira em 5 min
- [ ] Reserva completa no modo `direct`: pedido → aceite → contrato aceite → dono confirma o pagamento → entrega →
      devolução → dono regista a caução → concluída
- [ ] Comprovativo e contrato em PDF descarregam
- [ ] Sem erros de CSP na consola do browser (imagens de `s3.beeznoo.ao` têm de carregar)
- [ ] O IP em `security_events` é o teu e não o de um contentor (`172.x`). Se não for, ajustar
      `RATE_LIMIT_TRUSTED_PROXIES` no `docker-compose.yml`
- [ ] **Isolamento:** a partir de **outra máquina**, `nc -zv <IP da VPS> 8080`, `5432`, `3900` e `3903` falham
      (só 80 e 443 respondem). No servidor, `docker compose ps` mostra portas publicadas só no `caddy`
- [ ] `https://beeznoo.ao/actuator/health` responde **404**
- [ ] **Balanceador:** `docker compose stop api-2`; o site e o login continuam; `docker compose start api-2`.
      Repetir com `api-1`
- [ ] Login Google funciona várias vezes seguidas (afinidade por cookie `bz_lb`)
- [ ] Na `api-2` os agendadores estão desligados: `docker compose logs api-2 | grep -i expirad` não mostra nada

Só há eventos depois de algo os gerar: tenta entrar com a password errada e depois:

```bash
docker compose exec postgres psql -U beeznoo -d beeznoo \
  -c "SELECT created_at, type, ip FROM security_events ORDER BY created_at DESC LIMIT 5;"
```

---

## 6. Atualizar

```bash
cd /opt/beeznoo/deploy/vps
./update.sh
```

O `update.sh` faz backup, `git pull --ff-only` e reconstrói as imagens; depois reinicia a `api-1`, espera que fique
saudável, faz o mesmo à `api-2` e só então o resto (Next, Caddy, …). O Caddy tira da rotação a réplica que está a
reiniciar, por isso **a API não para**; o Next reinicia em poucos segundos no fim.

As migrações novas aplicam-se quando a `api-1` arranca. **Durante uns segundos a `api-2` corre o código antigo com o
schema novo**, por isso as migrações têm de ser compatíveis com a versão anterior: acrescentar colunas (nulas ou com
omissão) e tabelas, sim; apagar ou renomear o que o código antigo usa, só numa versão seguinte. Se uma migração não
puder ser compatível, para as duas réplicas antes (`docker compose stop api-1 api-2`) e aceita o corte.

Antes de atualizar a produção: CI verde na `main` e a migração nova testada noutra BD (staging ou cópia local do backup).

### Voltar atrás

As migrações Flyway só andam para a frente. Se a versão nova tiver migrações:

1. Volta ao commit anterior: `git -C ../.. checkout <commit>` e `docker compose --env-file .env up -d --build`.
2. Se a API não arrancar porque o schema já está à frente, **restaura o backup da BD** feito pelo `update.sh` antes da
   atualização ([§9](#9-restaurar)). Os dados criados entretanto perdem-se: avisa a equipa.

Depois de resolvido, volta à `main` (`git -C ../.. checkout main`).

---

## 7. Operação do dia a dia

| Tarefa | Comando |
|---|---|
| Estado dos serviços | `docker compose ps` |
| Logs da API | `docker compose logs -f --tail 200 api-1 api-2` |
| Reiniciar uma réplica | `docker compose restart api-2` (o Caddy manda o tráfego para a outra) |
| Memória por contentor | `docker stats --no-stream` |
| Portas publicadas | `docker compose ps` (só o `caddy` pode ter `0.0.0.0:80/443`) |
| Espaço em disco | `df -h` e `docker system df` |
| Ocupação do Garage | `docker compose exec garage /garage bucket info beeznoo` |
| Consola SQL | `docker compose exec postgres psql -U beeznoo -d beeznoo` |

Cada linha de log da API traz o `X-Request-Id`. Os logs não contêm BI, NIF, códigos nem `storage_key`; não os copies
para fora do servidor sem necessidade.

### Monitorização (mínimo)

Configurar um monitor externo de disponibilidade (ex.: UptimeRobot ou Better Stack, plano gratuito) com alerta por
email/WhatsApp a pelo menos duas pessoas:

- `https://beeznoo.ao/` — o site
- `https://beeznoo.ao/api/v1/categories` — a API através do proxy

E um alerta de disco acima de 80% (o painel do fornecedor da VPS costuma ter).

---

## 8. Backups

O `backup.sh` cria, em `deploy/vps/backups/`, um `pg_dump` da BD e um `tar` dos volumes do Garage, e apaga os que têm
mais de 14 dias. O Garage pára alguns segundos durante a cópia.

```bash
# cron do root: todos os dias às 03:00
crontab -e
0 3 * * * /opt/beeznoo/deploy/vps/backup.sh >> /var/log/beeznoo-backup.log 2>&1
```

> ⚠️ **Isto ainda não chega para produção.** Os backups ficam no mesmo disco e **sem encriptação**, e incluem documentos
> de identidade (KYC). Se o servidor se perder, perdem-se com ele. Antes do primeiro aluguer real:
>
> 1. **Cópia diária para fora do servidor**, por exemplo com `rclone` para um bucket privado noutro fornecedor.
> 2. **Encriptar antes de enviar** (ex.: `age` ou `gpg`, ou a encriptação do `rclone crypt`). A chave fica no gestor
>    de passwords, não no servidor de destino.
> 3. **Testar um restauro** ([§9](#9-restaurar)) numa máquina à parte e anotar a data do teste aqui.
>
> O destino e a ferramenta são decisão a registar em `claude/decisoes-produto.md`.

Último teste de restauro: _(por fazer)_

---

## 9. Restaurar

Na pasta `deploy/vps`, com o `.env` do ambiente certo. Substitui `<STAMP>` pelo nome do backup.

### Base de dados

```bash
set -a; . ./.env; set +a
docker compose stop api-1 api-2 web
docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE \"$DB_NAME\";"
docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
gunzip -c backups/db-<STAMP>.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
docker compose start api-1 api-2 web
```

### Ficheiros (Garage)

```bash
docker compose stop garage
docker run --rm -v beeznoo_garage_meta:/meta -v beeznoo_garage_data:/data -v "$(pwd)/backups":/in alpine \
  sh -c 'rm -rf /meta/* /data/* && tar xzf /in/files-<STAMP>.tar.gz -C /'
docker compose start garage
```

Restaura a BD e os ficheiros **do mesmo dia**: a BD guarda as `storage_key` dos ficheiros, e uma não serve sem a outra.

---

## 10. Segurança: o que é nosso numa VPS

Num alojamento gerido isto era do fornecedor; aqui é da equipa.

- **Atualizações:** `unattended-upgrades` para o SO; imagens Docker reconstruídas a cada `update.sh`. Uma vez por mês,
  `docker compose pull caddy postgres garage` e reiniciar (as versões estão fixadas no `docker-compose.yml`; subir de
  versão é uma mudança revista em PR).
- **Acessos:** SSH só com chave, no mínimo duas pessoas com acesso, chaves pessoais (não partilhadas). Remover a chave de
  quem sair da equipa.
- **Segredos:** o `.env` tem `chmod 600` e só existe no servidor e no gestor de passwords. Um `.env` por ambiente;
  **nunca** reutilizar o `JWT_SECRET` nem as chaves de staging.
- **Base de dados:** a API liga-se ao Postgres com o mesmo utilizador que é dono das tabelas (o Flyway precisa dele).
  No Neon (`DEPLOY.md`) há uma role só para a app; aqui não. Aceitável para o MVP porque o Postgres não está exposto,
  mas é um ponto a melhorar.
- **Credenciais antigas:** os ficheiros locais `.env.render` e `.env.prod` têm credenciais antigas. Não os copies para a
  VPS; roda essas credenciais se ainda forem válidas.

Mapa completo de controlos em `docs/SEGURANCA.md`.

---

## Variante: Coolify

`deploy/coolify/` tem os mesmos serviços para o [Coolify](https://coolify.io) num servidor próprio. Diferenças:

- O Coolify (Traefik) trata do HTTPS e dos domínios; não há portas publicadas no compose. O balanceador interno é
  um Caddy à parte (`deploy/coolify/api-lb/`, com o `Caddyfile` dentro da imagem), igual ao site `:8080` da VPS:
  2 réplicas (`api-1`, `api-2`), health check, afinidade por cookie. **Só `web` e `garage` têm domínio**; `api-1`,
  `api-2`, `api-lb` e `postgres` não.
- As redes `internal` da VPS não estão no compose do Coolify: o Coolify liga todos os serviços do recurso à sua
  própria rede. O isolamento vem de nenhum serviço interno ter domínio nem porta publicada.
- No Coolify: **New Resource › Repository › Build Pack "Docker Compose"**, `Docker Compose Location:
  /deploy/coolify/docker-compose.yml`. Domínios por serviço: `web` → `https://beeznoo.ao:3000`,
  `garage` → `https://s3.beeznoo.ao:3900`.
- As variáveis do compose aparecem no separador **Environment Variables**; os valores são os da [§3](#3-configurar-o-env).
- Garage e backups: `deploy/coolify/setup-garage.sh` e `deploy/coolify/backup.sh`. Os avisos da [§8](#8-backups)
  aplicam-se igualmente.
- **Backup no Coolify** — o script precisa do UUID do recurso (`RESOURCE`, o que aparece nos nomes dos contentores,
  ex. `postgres-<uuid>-…`), para nunca copiar a base de dados de outro ambiente. Instalar uma vez, como root:
  ```bash
  install -m 700 deploy/coolify/backup.sh /opt/beeznoo-backups/backup.sh
  RESOURCE=<uuid> /opt/beeznoo-backups/backup.sh          # testa já (o Garage pára uns segundos)
  (crontab -l 2>/dev/null; echo "0 3 * * * RESOURCE=<uuid> /opt/beeznoo-backups/backup.sh >> /var/log/beeznoo-backup.log 2>&1") | crontab -
  ```
  As cópias ficam em `/opt/beeznoo-backups/<uuid>/` (só root, 14 dias). Continua a faltar a cópia encriptada fora do
  servidor (§8).

Passo a passo com capturas: PDF `docs/Beeznoo - Guia da plataforma e instalacao (Contabo + Coolify).pdf`, secção 11.
