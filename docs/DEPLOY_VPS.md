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

```
Browser ──443──> Caddy (HTTPS, Let's Encrypt)
                   ├── beeznoo.ao     ──> web (Next.js :3000) ──rede interna──> api (Spring :8080) ──> postgres (:5432)
                   └── s3.beeznoo.ao  ──> garage (S3 :3900)  <── URLs assinadas pedidas pela api
```

- Só o Caddy publica portas (80 e 443). A API, o Postgres e o Garage ficam na rede interna do Docker.
- O browser só fala com o Next, que faz proxy de `/api/v1`, `/oauth2/authorization` e `/login/oauth2` para a API. Sem CORS.
- O Garage serve **apenas URLs assinadas**: sem assinatura válida responde 403. O bucket é privado.
- A API chega ao Garage pelo URL público (`s3.beeznoo.ao`), resolvido para o próprio servidor (`extra_hosts`), porque o
  host faz parte da assinatura do URL.
- As migrações Flyway correm sozinhas no arranque da API.

| Serviço | Imagem | Dados persistentes (volume) |
|---|---|---|
| `caddy` | `caddy:2.8-alpine` | `caddy_data`, `caddy_config` (certificados) |
| `web` | `frontend/Dockerfile` (Next standalone) | — |
| `api` | `api/Dockerfile` | — |
| `postgres` | `postgres:16-alpine` | `postgres_data` |
| `garage` | `dxflrs/garage:v1.1.0` | `garage_meta`, `garage_data` (fotos, KYC, checklists) |

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
> **não acrescentes `ports:` ao Postgres nem ao Garage** no `docker-compose.yml`.

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
`GOOGLE_REDIRECT_URI`, `B2_*`, `SESSION_COOKIE_SECURE=true`, `RATE_LIMIT_TRUSTED_PROXIES=2` (Caddy + Next).

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
docker compose logs -f api      # esperar "Started ...Application"; as migrações Flyway aparecem antes
```

O `web` só arranca quando a API estiver saudável (`/actuator/health`). O Caddy pede os certificados no primeiro pedido
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

O `update.sh` faz backup, `git pull --ff-only`, reconstrói as imagens e reinicia o que mudou. As migrações novas
aplicam-se quando a API arranca. Durante o rebuild há alguns segundos sem serviço.

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
| Logs da API | `docker compose logs -f --tail 200 api` |
| Reiniciar um serviço | `docker compose restart api` |
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
docker compose stop api web
docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE \"$DB_NAME\";"
docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
gunzip -c backups/db-<STAMP>.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
docker compose start api web
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

- O Coolify (Traefik) trata do HTTPS e dos domínios; não há Caddy nem portas publicadas no compose.
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
