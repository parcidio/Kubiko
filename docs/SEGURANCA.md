# Segurança do backend — OWASP Top 10:2025

Estado a 2026-10-23. Decisões e valores em `claude/decisoes-produto.md` ("Segurança do backend"). Testes em
`api/src/test/java/com/beeznoo/api/security/SecurityIntegrationTest.java` (+ testes de cada módulo).
Regra geral: **o backend nunca confia no frontend** — cada pedido é autenticado, autorizado por recurso e validado.

## Mapa OWASP → controlos

| OWASP 2025 | Risco na Beeznoo | Controlo | Onde |
|---|---|---|---|
| **A01 Broken Access Control** | Ver/alterar reserva, pagamento, KYC ou ficheiro de outra pessoa | Autorização por recurso em cada serviço (dono / arrendatário / admin); `/admin/**` só `ROLE_ADMIN` (+ `@PreAuthorize`); documentos só por URL assinada curta; páginas ≤ 100; itens apagados escondidos | `SecurityConfig`, serviços de domínio, `common.storage` |
| **A02 Security Misconfiguration** | Segredos por omissão, Swagger público, cabeçalhos em falta | Sem segredo por omissão (`JWT_SECRET` ≥ 32 bytes obrigatório, `B2_*` obrigatórios); Swagger só com `API_DOCS_ENABLED=true`; CSP `default-src 'none'`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, `Permissions-Policy`, COOP/CORP; erros sem stack nem mensagem interna; só `/actuator/health` exposto | `SecurityConfig`, `JwtProperties`, `application.yaml` |
| **A03 Software Supply Chain Failures** | Dependência vulnerável | Dependabot semanal (Maven, npm, Actions); versões fixas no `pom.xml`; CI corre os testes em cada PR | `.github/dependabot.yml`, `.github/workflows/ci.yml` |
| **A04 Cryptographic Failures** | Tokens previsíveis ou expostos | JWT HS256 com `iss`/`aud`/`typ` verificados; refresh de 256 bits guardado só como SHA-256; OTP com `SecureRandom`, guardado com bcrypt; passwords bcrypt (máx. 72 bytes); tokens nunca na URL (login Google usa código de uso único); bucket B2 privado com encriptação | `JwtService`, `AuthService`, `OAuth2SuccessHandler` |
| **A05 Injection** | SQL, HTML em emails, ficheiros maliciosos | Só JPA/JPQL com parâmetros (sem SQL concatenado); Thymeleaf `th:text` escapa tudo; uploads validados pelos bytes (JPEG/PNG/PDF), 5 MB, nome gerado pelo servidor; DTOs com `@Valid` e limites de tamanho | repositórios, `EmailTemplateRenderer`, `UploadedFiles` |
| **A06 Insecure Design** | Força bruta, abuso de SMS, enumeração | Limites por IP e por identificador (tabela abaixo); OTP com 5 tentativas por código; mesma mensagem e mesmo tempo no login com ou sem conta; pedido de recuperação responde igual exista ou não o número | `RateLimiter`, `RateLimitFilter`, `AuthService` |
| **A07 Authentication Failures** | Sequestro de conta | Access token de 15 min; rotação do refresh e **revogação de todas as sessões se um refresh já usado reaparecer**; logout e mudança de password revogam sessões; login Google não associa contas por email (pré-sequestro) | `AuthService`, `OAuth2SuccessHandler` |
| **A08 Software or Data Integrity Failures** | Alteração de registos financeiros ou de decisões | Ledger, decisões de KYC e auditoria append-only (trigger na BD); texto do contrato imutável com SHA-256; valores calculados no servidor (taxa, caução, total) | migrações V5, V8, V10, V12 |
| **A09 Security Logging & Alerting Failures** | Ataque sem rasto | `audit_logs` para ações de admin; log de login falhado, OTP bloqueado, limite atingido e refresh reutilizado — com identificadores mascarados, nunca códigos, tokens, BI/NIF, referências ou storage keys | `AuditService`, `AuthService`, `RateLimiter` |
| **A10 Mishandling of Exceptional Conditions** | 500 com detalhes, estados inconsistentes | Erros do cliente com 4xx (JSON inválido, campo em falta, método, tipo); tudo o resto 500 genérico; transações com rollback e limpeza do storage; email depois do commit; filtro JWT falha fechado | `GlobalExceptionHandler`, `StorageTransactions`, `NotificationEmailListener` |

## Limites de pedidos

Em memória, por instância (suficiente para uma instância no Render; com várias, mover para Redis). Resposta `429` com `Retry-After`.

| O quê | Limite | Chave |
|---|---|---|
| Qualquer pedido | 300 / min | IP |
| Login | 30 / 15 min · 10 / 15 min | IP · telefone ou email |
| Envio de OTP (registo, recuperação, Google) | 10 / hora · 5 / hora · 1 / 60 s | IP · telefone · telefone + finalidade |
| Verificação de OTP | 10 / 15 min · 5 erros por código | telefone · código |
| Refresh | 30 / min | IP |
| Troca do código Google | 20 / min | IP |
| Uploads (multipart) | 30 / hora | pessoa |
| Escrita autenticada | 120 / min | pessoa |
| Corpo JSON | 1 MB (413) · ficheiros 5 MB, pedido multipart 26 MB | — |

**IP do cliente:** `RATE_LIMIT_TRUSTED_PROXIES` = nº de proxies à frente da API que acrescentam ao `X-Forwarded-For`
(0 em local; browser → Vercel → Render → API = **2**). Com o valor errado, ou se limita toda a gente pelo IP do proxy
(valor baixo) ou um atacante escolhe o IP (valor alto).

## Configuração por ambiente

| Variável | Local | Staging / produção |
|---|---|---|
| `JWT_SECRET` | qualquer valor ≥ 32 bytes | `openssl rand -base64 64`, diferente por ambiente |
| `JWT_EXPIRATION_MINUTES` | 15 | 15 |
| `API_DOCS_ENABLED` | `true` | `false` |
| `SESSION_COOKIE_SECURE` | `false` (http://localhost) | `true` |
| `RATE_LIMITS_ENABLED` | `true` | `true` |
| `RATE_LIMIT_TRUSTED_PROXIES` | `0` | `2` (confirmar a cadeia de proxies) |
| `PAYMENTS_AUTO_CONFIRM` | `true` (demo) | `false` |
| `B2_*` | bucket de desenvolvimento | bucket e chave por ambiente, só esse bucket |

## Para o frontend

- Login Google: o redirect traz `status=success&code=…` → `POST /auth/google/exchange { code }` (uso único, 60 s).
  Outros estados: `pending_phone`, `email_in_use`, `error`.
- Tratar `429` (mostrar a mensagem e respeitar `Retry-After`) e renovar o token com `/auth/refresh` ao receber `401`.
- Tokens continuam em `localStorage` (risco de XSS conhecido — ver `frontend/src/lib/session.ts`).

## Em aberto

- WAF / proteção DDoS na borda (ex.: Cloudflare à frente do Render).
- Alertas sobre os eventos de segurança (hoje só ficam no log).
- 2FA para contas ADMIN.
- Lista de passwords comuns; verificação de email (permitiria voltar a associar Google por email com segurança).
- Tokens do frontend em cookie `httpOnly` em vez de `localStorage`.
- Rever o pino do AWS SDK (2.26.x) — o Dependabot só propõe patches dessa linha.
