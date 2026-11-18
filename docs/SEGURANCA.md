# Segurança do backend — OWASP Top 10:2025

Estado a 2026-11-17 (2.ª ronda e [revisão de 2026-11-17](#revisão-2026-11-17) incluídas). Decisões e valores em `claude/decisoes-produto.md` ("Segurança do backend" e
"Segurança, 2.ª ronda"). Contas e configuração dos serviços externos em `docs/SERVICOS_EXTERNOS.md`. Testes em
`api/src/test/java/com/beeznoo/api/security/SecurityIntegrationTest.java` (+ testes de cada módulo).
Regra geral: **o backend nunca confia no frontend** — cada pedido é autenticado, autorizado por recurso e validado.

## Mapa OWASP → controlos

| OWASP 2025 | Risco na Beeznoo | Controlo | Onde |
|---|---|---|---|
| **A01 Broken Access Control** | Ver/alterar reserva, pagamento, KYC ou ficheiro de outra pessoa | Autorização por recurso em cada serviço (dono / arrendatário / admin); `/admin/**` só `ROLE_ADMIN` (+ `@PreAuthorize`); documentos só por URL assinada curta; páginas ≤ 100; itens apagados escondidos | `SecurityConfig`, serviços de domínio, `common.storage` |
| **A02 Security Misconfiguration** | Segredos por omissão, Swagger público, cabeçalhos em falta | Sem segredo por omissão (`JWT_SECRET` ≥ 32 bytes obrigatório, `B2_*` obrigatórios); Swagger só com `API_DOCS_ENABLED=true`; CSP `default-src 'none'`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, `Permissions-Policy`, COOP/CORP; erros sem stack nem mensagem interna; só `/actuator/health` exposto. **Frontend:** CSP, HSTS, `nosniff`, `X-Frame-Options: DENY`, sem `X-Powered-By` | `SecurityConfig`, `JwtProperties`, `application.yaml`, `frontend/next.config.ts` |
| **A03 Software Supply Chain Failures** | Dependência vulnerável | Dependabot semanal (Maven, npm, Actions); versões fixas no `pom.xml`; CI corre testes da API, lint/typecheck/build do frontend, **gitleaks** (segredos) e **OSV-Scanner** (dependências vulneráveis) em cada PR | `.github/dependabot.yml`, `.github/workflows/ci.yml` |
| **A04 Cryptographic Failures** | Tokens previsíveis ou expostos | JWT HS256 com `iss`/`aud`/`typ` verificados; refresh de 256 bits guardado só como SHA-256; OTP com `SecureRandom`, guardado com bcrypt; passwords bcrypt (máx. 72 bytes); tokens nunca na URL (login Google usa código de uso único); bucket B2 privado com encriptação | `JwtService`, `AuthService`, `OAuth2SuccessHandler` |
| **A05 Injection** | SQL, HTML em emails, ficheiros maliciosos | Só JPA/JPQL com parâmetros (sem SQL concatenado); Thymeleaf `th:text` escapa tudo; uploads validados pelos bytes (JPEG/PNG/PDF), 5 MB, nome gerado pelo servidor; **imagens recodificadas** (sem EXIF/GPS, sem "poliglotas", ≤ 40 megapíxeis); DTOs com `@Valid` e limites de tamanho | repositórios, `EmailTemplateRenderer`, `UploadedFiles` |
| **A06 Insecure Design** | Força bruta, abuso de SMS, enumeração | Limites por IP e por identificador (tabela abaixo); OTP com 5 tentativas por código; mesma mensagem e mesmo tempo no login com ou sem conta; pedido de recuperação responde igual exista ou não o número; aceitar reserva bloqueia a linha do item (sem datas sobrepostas) | `RateLimiter`, `RateLimitFilter`, `AuthService` |
| **A07 Authentication Failures** | Sequestro de conta | Access token de 15 min; rotação do refresh e **revogação de todas as sessões se um refresh já usado reaparecer**; logout e mudança de password revogam sessões; **2FA por SMS para ADMIN** (password e Google); refresh em cookie `httpOnly` `bz_refresh` (`SameSite=Strict`, `Path=/api/v1/auth`); política de passwords (8–72 bytes, sem as comuns, sem telefone/nome); login Google só associa por email com email **verificado dos dois lados** | `AuthService`, `OAuth2SuccessHandler` |
| **A08 Software or Data Integrity Failures** | Alteração de registos financeiros ou de decisões | Ledger, decisões de KYC e auditoria append-only (trigger na BD); texto do contrato imutável com SHA-256; valores calculados no servidor (taxa, caução, total) | migrações V5, V8, V10, V12 |
| **A09 Security Logging & Alerting Failures** | Ataque sem rasto | `audit_logs` para ações de admin, incl. **leitura de documentos KYC**; `security_events` append-only (sem dados pessoais em claro) + `GET /admin/security-events`; **alerta aos admins** (notificação + email) em refresh roubado ou 2FA de admin falhado; `X-Request-Id` em cada pedido e linha de log; log de login falhado, OTP bloqueado, limite atingido e refresh reutilizado — com identificadores mascarados, nunca códigos, tokens, BI/NIF, referências ou storage keys | `AuditService`, `AuthService`, `RateLimiter` |
| **A10 Mishandling of Exceptional Conditions** | 500 com detalhes, estados inconsistentes | Erros do cliente com 4xx (JSON inválido, campo em falta, método, tipo); tudo o resto 500 genérico; transações com rollback e limpeza do storage; email depois do commit; filtro JWT falha fechado | `GlobalExceptionHandler`, `StorageTransactions`, `NotificationEmailListener` |

## Limites de pedidos

`RATE_LIMIT_STORE=memory` (por instância, suficiente para uma instância no Render) ou `database` (contadores no Postgres,
chaves em SHA-256 — para várias instâncias). Resposta `429` com `Retry-After`.

| O quê | Limite | Chave |
|---|---|---|
| Qualquer pedido | 300 / min | IP |
| Login | 30 / 15 min · 10 / 15 min | IP · telefone ou email |
| Envio de OTP (registo, recuperação, Google) | 10 / hora · 5 / hora · 1 / 60 s | IP · telefone · telefone + finalidade |
| Verificação de OTP | 10 / 15 min · 5 erros por código | telefone · código |
| Login com 2FA de admin (`/auth/login/mfa`) | conta como login · 5 erros por código | IP · código |
| Mudar password com sessão | 5 / 15 min | pessoa |
| Código de verificação de email | 1 / 60 s · 5 / hora · 5 erros por código | pessoa · pessoa · código |
| Refresh | 30 / min | IP |
| Troca do código Google | 20 / min | IP |
| Uploads (multipart) | 30 / hora | pessoa |
| Foto de perfil (`/me/avatar`) | 10 / hora | pessoa |
| Escrita autenticada | 120 / min | pessoa |
| Corpo JSON | 1 MB (413) · ficheiros 5 MB, pedido multipart 26 MB | — |

**IP do cliente:** `RATE_LIMIT_TRUSTED_PROXIES` = nº de proxies à frente da API que acrescentam ao `X-Forwarded-For`
(0 em local; browser → Vercel → Render → API = **2**; VPS: Caddy da borda escreve o IP do cliente, o Next mantém-no e
o balanceador `api-lb` acrescenta o do Next = **2**). Com o valor errado, ou se limita toda a gente pelo IP do proxy
(valor baixo) ou um atacante escolhe o IP (valor alto). Fora disto o Spring ignora `X-Forwarded-*`
(`server.forward-headers-strategy: none`): não mudam o esquema, o host nem `getRemoteAddr()`.

## Configuração por ambiente

| Variável | Local | Staging / produção |
|---|---|---|
| `JWT_SECRET` | qualquer valor ≥ 32 bytes | `openssl rand -base64 64`, diferente por ambiente |
| `JWT_EXPIRATION_MINUTES` | 15 | 15 |
| `API_DOCS_ENABLED` | `true` | `false` |
| `SESSION_COOKIE_SECURE` | `false` (http://localhost) | `true` |
| `RATE_LIMITS_ENABLED` | `true` | `true` |
| `RATE_LIMIT_TRUSTED_PROXIES` | `0` | `2` (confirmar a cadeia de proxies) |
| `RATE_LIMIT_STORE` | `memory` | `memory` (uma instância) · `database` (várias — a VPS com 2 réplicas fixa-o) |
| `SCHEDULER_ENABLED` | `true` | `true` numa só réplica, `false` nas outras |
| `ADMIN_MFA_ENABLED` | `false` permitido | `true` |
| `PAYMENTS_AUTO_CONFIRM` | `true` (demo) | `false` |
| `B2_*` | bucket de desenvolvimento | bucket e chave por ambiente, só esse bucket |

## Para o frontend

- Login Google: o redirect traz `status=success&code=…` → `POST /auth/google/exchange { code }` (uso único, 60 s).
  Outros estados: `pending_phone`, `email_in_use`, `error`.
- Tratar `429` (mostrar a mensagem e respeitar `Retry-After`) e renovar o token com `/auth/refresh` ao receber `401`.
- Refresh token em cookie `httpOnly` (o browser envia-o sozinho para `/api/v1/auth/*`); só o access token (15 min) fica no browser.
- Login de ADMIN: a resposta traz `mfaRequired` + `mfaToken` → `POST /auth/login/mfa { mfaToken, code }` (`AdminMfaStep`).

## Revisão 2026-11-17

Revisão do código existente (OWASP Top 10:2025) e da rede na VPS, a pedido da equipa (`claude/decisoes-produto.md`,
2026-11-17, ponto 8). ⚑ Validar com o André.

### Rede e balanceador (feito)

Arquitetura e passos em `docs/DEPLOY_VPS.md` ("Arquitetura"). Resumo:

- **Uma só porta de entrada:** o Caddy publica 80/443; API, balanceador (`api-lb:8080`), Postgres e Garage só com
  `expose:`. Postgres numa rede `internal: true` só com as réplicas da API; Garage numa rede `internal: true` só com o
  Caddy. O Next só chega ao balanceador, não às réplicas.
- **2 réplicas da API** atrás do `api-lb` (Caddy): `least_conn`, afinidade por cookie `bz_lb` (o fluxo OAuth2 usa a
  sessão HTTP da réplica), health check ativo em `/actuator/health` e passivo (30 s fora após falha).
- O `api-lb` só encaminha `/api/v1/*`, `/oauth2/authorization/*` e `/login/oauth2/*`; a borda responde 404 a
  `/actuator*`, `/v3/api-docs*` e `/swagger-ui*`.
- Cabeçalhos na borda (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `frame-ancestors`) só **se faltarem**
  (`?` no Caddy): a CSP do `next.config.ts` mantém-se. No `s3.` também `Referrer-Policy: no-referrer`; sem CSP lá
  para não partir o visualizador de PDF.
- Limites de pedidos partilhados entre réplicas (`RATE_LIMIT_STORE=database`). O Caddy oficial não limita pedidos.
- Agendadores só numa réplica (`SCHEDULER_ENABLED`, `@ConditionalOnProperty`).
- Teto de memória por réplica (768 MB), `JAVA_OPTS` ajustados. Coolify: mesmo balanceador (`deploy/coolify/api-lb`).
- `docker-compose.yml` local: portas só em `127.0.0.1`.
- Testado: `docker compose config` dos dois compose, `caddy validate` dos dois Caddyfile, e o `api-lb` num stack de
  teste com 2 réplicas falsas (alternância, afinidade, `X-Forwarded-For = cliente, next`, 404 em `/actuator`, réplica
  parada sai da rotação).

### Achados

| # | Sev. | Achado | Estado |
|---|---|---|---|
| 1 | Alta | Com 2 réplicas e `RATE_LIMIT_STORE=memory`, cada réplica contava à parte: o dobro das tentativas de OTP/login | **Corrigido**: o compose da VPS e do Coolify fixam `database` |
| 2 | Alta | Sem `mem_limit`, `MaxRAMPercentage=50` media a RAM da VPS: 2 JVMs podiam pedir 4 GB e o kernel matar o Postgres | **Corrigido**: `API_MEM_LIMIT` 768 MB por réplica |
| 3 | Média | Login Google com 2 réplicas: o pedido OAuth2 fica na sessão HTTP de uma réplica; o regresso noutra falhava | **Corrigido**: afinidade por cookie no `api-lb` |
| 4 | Média | OTP por WhatsApp aceitava um 2xx com `{"error": …}` no corpo como código válido (falha aberta) | **Corrigido** (`WhatsAppOtpClient.isVerified` + teste). Continua a aceitar um 2xx sem corpo reconhecido: confirmar com o Losambo o formato da resposta e fechar de vez |
| 5 | Média | Erro da Ombala registado com `e.getMessage()`: numa resposta de erro inclui o corpo, que pode repetir a mensagem com o **código OTP** | **Corrigido**: só o código HTTP ou a classe |
| 6 | Média | Docker local publicava a API (8081) e o Postgres (5432) em todas as interfaces (Wi-Fi partilhado) | **Corrigido**: `127.0.0.1` |
| 7 | Baixa | `next` 16.4.3 (GHSA-mfr8-8qww-v76h, só com `unstable_cache`, que não usamos) e `source-map-js` 1.2.1 (DoS, só no build) | **Corrigido**: `next` 16.4.6, `source-map-js` 1.2.2. `npm audit --omit=dev`: 0 |
| 8 | Baixa | `forward-headers-strategy` implícito: ligava-se sozinho em Kubernetes e confiaria em `X-Forwarded-*` de qualquer origem | **Corrigido**: `none` explícito |
| 9 | Média | Mudança de papel (`PATCH /admin/users/{id}/role`, em curso): o JWT traz o papel e vale 15 min; quem perde o admin continua admin até lá | **Reportado** a quem está no `AdminUserService`: revogar as sessões (`revokedAllForProfile`) ao mudar o papel, como já se faz ao suspender |
| 10 | Baixa | `GET /items/{id}` (público) devolve equipamento `SUSPENDED`/`INACTIVE` (com fotos assinadas) a quem souber o id; só `DELETED` é escondido | **Reportado** (`ItemService.getById`, em edição): suspensos só para o dono e admin |
| 11 | Baixa | `GlobalExceptionHandler` devolve a mensagem de qualquer `IllegalArgumentException`/`IllegalStateException`, incluindo as lançadas por bibliotecas (podem trazer nomes internos) | **Reportado**: usar exceções próprias para mensagens ao cliente e mensagem genérica no resto |
| 12 | Baixa | `RATE_LIMIT_STORE=database` usa uma 2.ª ligação (`REQUIRES_NEW`) dentro das transações do `AuthService`; com o pool cheio pode esperar até ao `connection-timeout` | **Aceite**: pool de 10 por réplica para 40 threads; rever se houver timeouts |
| 13 | Info | Mensagens da equipa por WhatsApp (decisão 2026-11-17, ponto 2): enviar para números arbitrários custa dinheiro | **Reportado**: limite de destinatários e de envios por admin/hora no serviço, auditoria `MESSAGE_SENT` |

Revisto sem achados novos: autorização por recurso em reservas, pagamentos, comprovativos, contratos, checklists,
problemas, avaliações, notificações, bloqueios de datas e fotos (dono/arrendatário/admin no serviço); `/admin/**` com
`hasRole('ADMIN')` no `SecurityConfig` e `@PreAuthorize` nos controladores; JWT com `iss`/`aud`/`typ` e chave
obrigatória; refresh com rotação e deteção de reutilização; suspensão revoga sessões; OTP com limites por telefone e
por código; logs com telefones mascarados; Resend sem corpo nos erros; uploads e URLs assinadas como na 2.ª ronda;
sem CORS (mesma origem); `DevSeeder` só com o perfil `seed`.

## Em aberto

Depende de contas ou serviços externos (ver `docs/SERVICOS_EXTERNOS.md`):

- WAF / proteção DDoS na borda (ex.: Cloudflare à frente do Render e da Vercel).
- Antivírus nos uploads (PDFs não são recodificados).
- Redis para os limites de pedidos se o Postgres (`RATE_LIMIT_STORE=database`) ficar lento.
- Ativar a proteção de `main` com os checks `build`, `frontend`, `secrets` e `deps` como obrigatórios.

Decidido para mais tarde:

- 2FA por TOTP (app autenticadora) quando houver mais admins — hoje é SMS.
- CSP do frontend com nonce (hoje `script-src 'unsafe-inline'`, necessário para a hidratação do Next).
- AWS SDK (2.55.x) atualiza normalmente; antes de fazer merge, teste manual do bucket (`docs/SERVICOS_EXTERNOS.md`).
