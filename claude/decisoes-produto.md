# Decisões de produto e arquitetura — Beeznoo

Fonte de verdade (CLAUDE.md §3.3). Cada decisão regista-se aqui **antes** da implementação.

---

## 2026-10-16 — Pagamento por referência (simulado, preparado para EMIS)

**Contexto.** O arrendatário paga depois de o dono aceitar (SPEC §7). Até agora `accept` fazia `holdForBooking`,
que exigia saldo prévio na conta do arrendatário — incompatível com "aceita primeiro, paga depois".
A integração real com a EMIS (Multicaixa) ainda não está fechada; por agora o pagamento é **simulado**.

**Decisões (aprovadas pelo André nesta data):**

1. **Aceitar não retém valores.** `accept` só muda o estado para `ACCEPTED`.
2. **Pagamento por referência** (`payments`, 1:N com `bookings` — trilho imutável de tentativas):
   - O arrendatário gera uma referência (entidade + referência de 9 dígitos + montante + validade).
   - Montante = aluguer + **taxa de serviço 8%** + caução. Os três valores ficam guardados no pagamento.
   - Só existe uma referência `AWAITING_PAYMENT` por reserva (índice único parcial). Pedir outra devolve a mesma, salvo se expirou.
   - Estados: `AWAITING_PAYMENT` → `CONFIRMED` | `EXPIRED` | `CANCELLED` | `FAILED`.
3. **Confirmação liquida tudo numa transação:** `TOPUP` (valor pago) → `SERVICE_FEE` (débito da taxa) → `HOLD` + `DEPOSIT_HOLD`
   → `PAYMENT_DEBIT` / `PAYMENT_CREDIT` → reserva `ACTIVE`. Novos tipos no ledger: `TOPUP`, `SERVICE_FEE` (migração V6).
4. **Gateway plugável** — interface `PaymentGateway` (`issueReference`, `checkStatus`):
   - `SimulatedPaymentGateway` (ativo por omissão, `app.payments.provider=simulated`).
     Com `app.payments.simulated.auto-confirm=true` o "Já paguei" confirma logo (só para dev/demo). **Em produção fica `false`.**
   - Futuro `EmisPaymentGateway`: mesma interface + webhook de notificação. Nenhum outro código muda.
5. **Validação manual mantém-se** como recurso: `PATCH /bookings/{id}/confirm-payment` (admin) liquida a referência aberta.
6. Cancelar uma reserva cancela a referência aberta.

**Margem para mudar de ideias.** Provider, entidade, validade da referência (`reference-ttl`, por omissão 24 h) e taxa
(`service-fee-rate`) são configuração. Trocar para EMIS = nova implementação de `PaymentGateway`.

**Em aberto.**
- Conta da plataforma: a taxa é debitada ao arrendatário mas ainda não é creditada numa conta Beeznoo.
- Valores em `NUMERIC(12,2)` para seguir o schema existente; o CLAUDE.md pede inteiros (Kz). Arredondamos a taxa a kwanzas inteiros.
- Prazo para pagar depois de aceite e política de reembolso (SPEC §12.3).
- `audit_logs` ainda não existe; a confirmação manual pelo admin deve passar a ser auditada quando existir.

---

## 2026-10-17 — Frontend sem shadcn/ui, design "Identidade Verde v3"

**Contexto.** As duas rondas no Claude Design (v1 e v2) saíram com cara de template shadcn: planas, cantos retos, sem
personalidade. O pedido da equipa é um visual mais criativo e **nenhum código shadcn** no frontend.

**Decisões (pedidas pela equipa nesta data — confirmar com o André na sexta):**

1. **Sai o shadcn/ui** e as dependências que só existiam por ele (`radix-ui`, `class-variance-authority`, `input-otp`,
   `sonner`, `tw-animate-css`, `components.json`). Os componentes da app vivem em `frontend/src/components/bz/`,
   escritos à mão com Tailwind v4 + HTML nativo (`<dialog>` para sheets/modais, `<input type="date">`, etc.).
   Consequência: a acessibilidade (foco, teclado, ARIA) é responsabilidade nossa em cada componente.
2. **Design "Identidade Verde v3"** (`docs/DESIGN_SYSTEM.md`): mantém a paleta (areia/verde/âmbar) e o vocabulário;
   muda forma (raios 12–24px), tipografia de display (Bricolage Grotesque, a mesma da landing), profundidade
   (sombras suaves só em elementos flutuantes) e motivos de marca (colmeia, bilhete de reserva).
3. A **landing não muda** — continua com os seus componentes em `frontend/components/landing/`.
4. Ecrãs sem endpoint no backend ficam **desenhados e navegáveis**, com aviso "Falta backend" e a lista do que
   falta em `docs/BACKEND_GAPS.md`. Nada de dados falsos a fingir que estão guardados.
5. Enquanto não houver telefone do dono exposto pela API, o botão WhatsApp fala com a **equipa Beeznoo**
   (`NEXT_PUBLIC_WHATSAPP_NUMBER`) com a mensagem pré-preenchida — coerente com o modelo concierge.

**Em aberto.** Contraste e legibilidade ao sol devem ser validados num Android de gama média antes do 1.º aluguer.

---

## 2026-10-23 — Pagamentos: expiração automática, `payment_id` no ledger, dono vê o pagamento

**Contexto.** Revisão do módulo de pagamentos (2026-10-16) contra as instruções do "Módulo 5". O módulo já existia;
ficam só as lacunas. Rotas, DTOs e migrações V4–V6 mantêm-se (o frontend já os usa e o Flyway já os aplicou).

**Decisões (aprovadas nesta data):**

1. **Expiração automática.** `PaymentExpiryScheduler` corre a cada minuto e marca `EXPIRED` as referências
   `AWAITING_PAYMENT` com `expires_at` no passado. A reserva fica `ACCEPTED` (pode gerar nova referência).
   Não há valores a libertar: a retenção só acontece na confirmação. Leitura do pagamento com lock pessimista
   para o agendador e o "Já paguei" não se cruzarem.
2. **`ledger_entries.payment_id`** (migração V7, nullable): os movimentos da liquidação apontam para o pagamento
   que os originou. Movimentos anteriores ficam a `NULL` (o ledger é append-only, sem backfill).
3. **O dono da reserva também vê o pagamento** (`GET /bookings/{id}/payments/current`). Só o arrendatário gera
   referência e carrega em "Já paguei".

**Em aberto.** Se a reserva deve ser cancelada automaticamente depois de N referências expiradas (SPEC §12.3).

---

## 2026-10-23 — KYC: verificação de identidade com documentos no Backblaze B2

**Contexto.** SPEC §7: verificação obrigatória antes de pedir reserva ou publicar equipamento, manual pelo admin.
Instruções do "Módulo 6" revistas contra o repo; as faturas ficam de fora (ver abaixo).

**Decisões (aprovadas nesta data):**

1. **Estados** `PENDING → IN_REVIEW → APPROVED | REJECTED | INFO_REQUESTED`. O admin passa a `IN_REVIEW` com a ação
   `START_REVIEW`; pode aprovar, recusar ou pedir informação a partir de `PENDING` ou `IN_REVIEW`.
2. **Re-submissão.** `INFO_REQUESTED`: a pessoa reenvia os documentos *na mesma* verificação, que volta a `PENDING`
   (ação `RESUBMIT` no histórico). `REJECTED`: cria uma verificação nova. No máximo uma verificação não recusada por
   perfil (índice único parcial).
3. **Documentos obrigatórios.** `INDIVIDUAL`: BI frente, BI verso, selfie. `BUSINESS`: NIF e documento da empresa.
   JPEG, PNG ou PDF (validado pelos bytes, não pela extensão), máx. 5 MB cada. `profiles.account_type` guarda o tipo.
4. **"Verificado" é derivado**: a verificação mais recente está `APPROVED`. Não há coluna nova —
   `profiles.is_verified` continua a querer dizer *telefone confirmado* (o login depende dela).
5. **Gate**: `ItemService.publish` e `BookingService.create` exigem identidade verificada (403).
6. **Storage privado no Backblaze B2** (API S3, AWS SDK v2) em todos os ambientes; os testes usam um mock.
   Só se guarda a `storage_key` (`kyc/{profileId}/{kycId}/{tipo}_{uuid}.{ext}`), nunca exposta na API nem nos logs.
   O admin vê os documentos por URL pré-assinada de 5 minutos. Se a transação falhar, os ficheiros enviados são apagados.
7. **Histórico** em `kyc_decisions` (append-only, trigger): ação, autor, nota e data. Recusar e pedir informação
   exigem nota.
8. **Só ADMIN** revê KYC (não existe papel MODERATOR no schema).

**Fora deste módulo.** Faturas: uma "fatura" com numeração sequencial em Angola tem de sair de software certificado
pela AGT (fora do âmbito, SPEC §9) e o iText 7 é AGPL. Se for preciso, um *comprovativo de pagamento* não fiscal
com Apache PDFBox, com hipótese e critério de sucesso próprios.

**Em aberto.**
- Proteção de dados: documentos de identidade num servidor nos EUA (B2 `us-east-005`) podem exigir autorização da APD
  (Lei 22/11) antes de entrarem documentos reais em produção. Confirmar com o André.
- `audit_logs` ainda não existe; quando existir, aprovar KYC deve lá ficar também.
- Prazo de retenção dos documentos depois de aprovados ou recusados.

---

## 2026-10-23 — Notificações: histórico na app + email (Resend), sem tempo real

**Contexto.** Instruções do "Módulo 7" revistas contra o repo. Hipótese: avisar dono, arrendatário e equipa nos
momentos que fazem o aluguer avançar (novo pedido, aceite, pago, KYC) reduz o tempo de resposta. Critério: tempo
entre "pedido" e "aceite/recusado" — a medir no primeiro mês.

**Decisões (aprovadas nesta data):**

1. **Histórico na app é o canal principal**: uma linha em `notifications` por evento e destinatário, criada *na mesma
   transação* da operação (se a reserva falhar, a notificação também não existe). `GET /notifications/me`,
   contagem de não lidas e marcar como lida. O frontend consulta a cada ~60 s.
2. **Email via Resend** (API REST, `RestClient`), enviado **depois do commit e em segundo plano**
   (`@TransactionalEventListener(AFTER_COMMIT)` + `@Async`): uma chamada HTTP não segura transações nem locks do ledger,
   e ninguém recebe email de uma operação que fez rollback. Falhas ficam em `email_status`/`email_error`; nunca
   rebentam a operação principal. Sem email no perfil (é opcional no registo) → `SKIPPED`.
   `Idempotency-Key` = id da notificação. Desligado por omissão (`NOTIFICATIONS_EMAIL_ENABLED`).
3. **Sem WebSocket/STOMP por agora.** O Vercel não faz proxy de WebSocket, o Render free adormece e corta ligações,
   o JWT expira com a ligação aberta e o broker em memória não escala. Polling chega para o volume do MVP.
4. **Sem SMS por agora** (custo por mensagem). Fica estruturado para acrescentar um canal sem mexer nos serviços.
5. **Eventos:** novo pedido (dono), aceite / recusado / cancelado (outra parte), pagamento confirmado (ambos),
   pagamento à espera de validação (admins, uma vez por reserva), KYC submetido (admins), KYC aprovado / recusado /
   informação pedida (pessoa). "Recusado" = dono cancela um pedido `PENDING_OWNER` (não existe `reject`).
   Sem "fatura disponível" (faturas adiadas, ver 2026-10-23 KYC).
6. Emails: um template Thymeleaf (`email/notification.html`) com as regras do design system — um botão âmbar com
   texto verde, PT-PT com "tu", sem dados de BI/NIF. Conteúdo do utilizador sempre escapado.

**Em aberto.**
- Domínio `beeznoo.ao` tem de estar verificado no Resend (SPF/DKIM) antes de ligar o email em produção.
- Se a API reiniciar entre o commit e o envio, o email fica `PENDING` e não é reenviado (sem retry no MVP).
- SMS nos eventos "novo pedido" e "aceite", se os donos não responderem a tempo — decisão do André.

---

## 2026-10-23 — Fecho do fluxo do MVP: perfil, fotos, contrato, entrega/devolução, caução, problemas, auditoria

**Contexto.** Itens P0/P1 do `docs/BACKEND_GAPS.md` que faltavam para o fluxo SPEC §7 ("Entrega + checklist → Uso →
Devolução + checklist → Inspeção → Caução libertada / retida"). Decisões tomadas pela equipa de backend nesta data —
**a validar pelo André na sexta**, sobretudo as marcadas com ⚑.

1. **`audit_logs`** (append-only, trigger): autor, ação, entidade, motivo e metadados sem dados pessoais.
   Regista: decisões de KYC, confirmação manual de pagamento, ajuste de saldo, libertar/reter caução, resolver problema.
   `GET /admin/audit-logs`. Reter caução exige motivo; nas restantes o motivo é opcional mas guardado.
2. **`GET/PATCH /profiles/me`**: nome, email, província, cidade editáveis; telefone não (muda-se com OTP, fora do MVP).
   Devolve `phoneVerified` (= `is_verified`) e `identityVerified` + `kycStatus` (do KYC) — nomes distintos de propósito.
3. **Fotos do equipamento** no mesmo bucket privado do B2 (`items/{itemId}/…`), servidas por URL assinada de 12 h.
   JPEG/PNG até 5 MB, máx. 8 por item. Compressão no frontend antes do upload (o backend não redimensiona).
   ⚑ Quando houver tráfego, passar para bucket público + CDN (URLs assinadas não ficam em cache entre pedidos).
4. **Contrato** gerado quando o dono aceita (o aceitar do dono conta como aceitação do contrato, que lhe é mostrado
   nesse ecrã). O arrendatário aceita antes de gerar a referência de pagamento. Texto versionado + hash SHA-256.
   ⚑ **O texto `v1` é um rascunho técnico — tem de ser revisto por um jurista antes do primeiro aluguer real.**
5. **Novos estados**: `ACTIVE` (pago) → `IN_PROGRESS` (entregue) → `RETURNED` (devolvido) → `COMPLETED`.
   `ACTIVE` mantém o nome para não partir o frontend. A timeline de 6 passos passa a ser verdadeira.
6. **Checklists** de entrega e devolução: uma das partes regista notas + pelo menos 2 fotos; a **outra** parte confirma
   e a reserva avança. Se não concorda, reporta um problema em vez de confirmar. ⚑ Sem código de 4 dígitos no MVP.
7. **Cauções** em tabela própria (`deposits`, opção B do SPEC), criada na confirmação do pagamento, com backfill a partir
   do ledger. O admin liberta (total) ou retém (parcial em Kz ou total, motivo obrigatório) depois de `RETURNED`
   ou `DISPUTED`; a reserva passa a `COMPLETED`. O valor retido vai para o dono, o resto volta ao arrendatário.
   `PATCH /bookings/{id}/complete` continua a funcionar e equivale a libertar.
8. **Reportar problema** (`incident_reports`): dano / perda / roubo / outro, descrição, até 6 fotos (bucket privado).
   Põe a reserva em `DISPUTED` e avisa a equipa. O admin resolve com nota; o dinheiro decide-se na caução (ponto 7).
9. **Filas de admin**: `GET /admin/payments`, `/admin/deposits`, `/admin/incidents`, mais antigos primeiro.

**Em aberto.** Comprovativo de pagamento (`payment_review`, gap #5), expiração de pedidos sem resposta em 24 h,
disponibilidade/bloqueios de datas, política de cancelamento depois de pago.

---

## 2026-10-23 — Segurança do backend (OWASP Top 10:2025) e limites de pedidos

**Contexto.** Auditoria do backend contra o OWASP Top 10. Falhas encontradas (por gravidade):
- **Crítico** — `JWT_SECRET` tinha valor por omissão público no `application.yaml`: sem a variável, qualquer pessoa forjava
  um token de ADMIN. O OTP tinha só ~90 mil combinações (bug em `nextInt(900_00)`) e **tentativas ilimitadas**: com o
  `password/reset` dava para tomar conta de qualquer conta por força bruta. Sem limites, o envio de SMS podia ser abusado
  (custo por SMS).
- **Alto** — login Google associava contas **pelo email**, que nunca é verificado na Beeznoo (pré-sequestro de conta);
  tokens de acesso e refresh iam na **URL** do redirect (ficam no histórico, logs e Referer); força bruta no login sem
  limite; refresh token roubado não era detetado; Swagger público em produção.
- **Médio** — erros de cliente (JSON inválido, parâmetro em falta) davam 500; sem cabeçalhos de segurança explícitos;
  `pendingToken` escrito nos logs; páginas de 2.000 elementos aceites; itens apagados visíveis por id; papel no JWT válido
  60 min depois de mudar.

**Decisões (tomadas pela equipa de backend nesta data — ⚑ validar com o André):**

1. **Segredos sem valor por omissão.** A API não arranca sem `JWT_SECRET` com ≥ 32 bytes. JWT com `iss`/`aud`/`typ`
   verificados. Access token passa a **15 min** (antes 60) para limitar tokens roubados e mudanças de papel.
2. **OTP**: 6 dígitos uniformes, **máx. 5 tentativas por código** (depois é invalidado), validade mantém-se.
3. **Limites de pedidos** (em memória, por instância — chega para uma instância no Render; ⚑ Redis se escalarmos):
   - login: 10 / 15 min por telefone/email e 30 / 15 min por IP;
   - envio de OTP: 1 / 60 s por telefone e finalidade, 5 / hora por telefone, 10 / hora por IP;
   - verificação de OTP: 10 / 15 min por telefone;
   - uploads (KYC, fotos, checklists, problemas): 30 / hora por pessoa;
   - escrita autenticada: 120 / min por pessoa; qualquer pedido: 300 / min por IP.
   Resposta `429` com `Retry-After`. O IP do cliente vem do `X-Forwarded-For` contando só os proxies de confiança
   (`RATE_LIMIT_TRUSTED_PROXIES`, 0 em local; em produção = nº de proxies à frente da API).
4. **Refresh token**: 256 bits aleatórios; reutilizar um refresh já usado **revoga todas as sessões** da pessoa (sinal de roubo).
5. **Login Google**: deixa de associar por email. Se o email do Google já existe noutra conta, o frontend diz para entrar
   com telefone. Tokens deixam de ir na URL: o redirect leva um **código de uso único (60 s)** trocado em
   `POST /auth/google/exchange`. Sai o `/auth/google/link`, que não fazia nada. ⚑ Associar Google a uma conta existente
   fica para uma história própria (com sessão iniciada).
6. **Swagger** só com `API_DOCS_ENABLED=true` (desligado por omissão; ligado no `.env` de desenvolvimento).
7. **Cabeçalhos**: CSP `default-src 'none'`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`,
   HSTS em HTTPS, `Permissions-Policy` restrito. Corpo JSON até 1 MB. Páginas até 100 elementos.
8. **Erros**: 4xx corretos para pedidos mal formados; nunca detalhes internos na resposta. Eventos de segurança
   (login falhado, OTP bloqueado, limite atingido, refresh reutilizado) vão para o log com identificadores mascarados.
9. **Cadeia de dependências**: Dependabot semanal (Maven, npm, GitHub Actions).

**Em aberto.** WAF/proteção DDoS na borda (Cloudflare à frente do Render); alertas sobre eventos de segurança;
2FA para contas ADMIN; política de passwords além de 8–72 caracteres (lista de passwords comuns).

---

## 2026-10-23 — Segurança, 2.ª ronda: fechar as lacunas que dependem só de código

**Contexto.** O que ficou "em aberto" na ronda anterior e não depende de contas externas é resolvido agora.
O resto (WAF, antivírus, Redis, etc.) fica em `docs/SEGURANCA.md`, e a configuração de cada serviço externo para
passar das contas pessoais para as contas do projeto fica em `docs/SERVICOS_EXTERNOS.md`.

**Decisões (equipa de backend, nesta data — ⚑ validar com o André):**

1. **2FA para ADMIN por SMS** (reaproveita o OTP): password certa → `mfaRequired` + código por SMS → `POST /auth/login/mfa`.
   Vale também para o login Google de uma conta ADMIN. ⚑ TOTP (app autenticadora) fica para quando houver mais admins.
2. **Refresh token em cookie `httpOnly`** (`bz_refresh`, `SameSite=Strict`, `Path=/api/v1/auth`) para o cliente web;
   deixa de estar em `localStorage`. O access token (15 min) continua no browser. Clientes não-web continuam a
   receber o refresh no corpo.
3. **Mudar password com sessão iniciada** (`POST /auth/password/change`, pede a atual) — revoga as outras sessões.
4. **Política de passwords**: 8–72 bytes, recusa as mais comuns e as que contêm o telefone ou o nome.
5. **Verificação de email** (código de 6 dígitos por email, 15 min, 5 tentativas). Mudar o email anula a verificação.
   Com email verificado **dos dois lados** (Beeznoo e Google), o login Google volta a associar a conta.
6. **Eventos de segurança** em tabela própria (`security_events`, sem dados pessoais em claro) + `GET /admin/security-events`.
   Alerta aos admins (notificação + email) quando um refresh roubado é detetado ou um admin falha o 2FA.
7. **Limites de pedidos com armazenamento escolhido por configuração**: memória (uma instância) ou Postgres
   (`RATE_LIMIT_STORE=database`, várias instâncias; as chaves ficam em SHA-256).
8. **Imagens recodificadas no servidor**: remove EXIF (incl. GPS da casa do dono), neutraliza ficheiros "poliglota",
   recusa imagens acima de 40 megapíxeis (bomba de descompressão). PDFs ficam como estão.
9. **Auditoria de leitura de documentos KYC** (`KYC_DOCUMENTS_VIEWED`): quem viu o BI de quem, e quando.
10. **Aceitar reserva bloqueia o equipamento** (lock na linha do item) — dois aceites simultâneos não sobrepõem datas.
11. **Identificador por pedido** (`X-Request-Id`) nos logs e na resposta, para investigar incidentes.
12. **Frontend**: cabeçalhos de segurança no Next (CSP, HSTS, nosniff, frame deny). **CI**: lint/typecheck/build do
    frontend, procura de segredos (gitleaks) e de dependências vulneráveis (OSV-Scanner).

---

## 2026-10-23 — Avaliações e destaques no Explorar (gap #21)

**Contexto.** O Explorar parece vazio e a confiança entre desconhecidos é o maior travão ao primeiro aluguer.
Avaliações de alugueres reais e faixas com equipamento escolhido/mais alugado dão prova social sem inventar dados.
Anúncios pagos e recomendações continuam fora do MVP (SPEC §9).

**Hipótese.** Mostrar avaliações e "Mais alugados" aumenta a passagem Explorar → Detalhe → Pedir reserva.
**Utilizador-alvo:** arrendatário que ainda não conhece o dono. **Critério de sucesso:** ≥ 50% das reservas concluídas
recebem avaliação; mais pedidos de reserva por visita ao Detalhe (comparar 4 semanas antes/depois).

**Decisões (equipa, nesta data — ⚑ validar com o André):**

1. **Uma avaliação por reserva `COMPLETED`, só do arrendatário** (`reviews`, V18): nota 1–5 e comentário opcional
   (≤ 1000). Não se edita nem apaga (sem moderação no MVP; abuso → admin trata manualmente na BD com registo).
   ⚑ Avaliar o arrendatário (dono → arrendatário) fica para depois.
2. **Público:** média e número de avaliações em cada equipamento e lista em `GET /items/{id}/reviews`, com o nome
   do autor encurtado ("Ana M."). Calculado na leitura (sem contadores desnormalizados).
3. **Destaques sem anúncios:** `items.featured_at` posto pelo admin (`PATCH /admin/items/{id}/featured`, com auditoria).
   `GET /items?featured=true` e `GET /items?order=POPULAR` (nº de reservas concluídas) e `order=RATING`.
4. **Frontend:** faixas "Em destaque", "Mais alugados" e "Novidades" no Explorar; cada faixa só aparece se tiver itens.

---

## 2026-11-05 — Alojamento refeito à mão, com contas `@beeznoo.ao`

**Contexto.** O alojamento vai ser recriado de raiz com as contas do projeto. A branch `staging` passa a seguir a `main`,
sem configuração própria (decisão do Victor nesta data — ⚑ validar com o André).

**Decisões:**
1. **Sem `render.yaml`:** serviços criados à mão, com as variáveis só nos painéis. Passos em `docs/DEPLOY.md`.
2. **Mesma arquitetura nos dois ambientes:** o browser fala só com o Next, que faz proxy para a API. Sem CORS e com cookie
   `SameSite=Strict`. Não entra na `main` o desenho de 2026-10-26 (browser a chamar a API diretamente).
3. **Separação por ambiente:** serviço Render, branch Neon, bucket B2, cliente Google e segredos próprios para staging e produção.
4. **Role `beeznoo_app`** sem permissões de dono na BD; as migrações correm com o dono, pela ligação direta.

**A decidir (recomendação em `docs/DEPLOY.md`):** região (Frankfurt, em vez de Ohio) e planos pagos da Vercel e do Render para a produção.

---

## 2026-11-11 — KYC desligável, reativar item, selo "Verificado", contrato e comprovativo em PDF

**Contexto.** Para testar a publicação e o pedido de reserva em local e em staging é preciso aprovar um KYC à mão em cada
conta. Faltavam ainda o #20 (reativar equipamento pausado) e o #15 (selo "Verificado") do `docs/BACKEND_GAPS.md`. O
arrendatário e o dono não tinham nenhum documento para guardar depois de pagar ou de assinar.

**Hipótese (comprovativo).** Um comprovativo de pagamento com aspeto de documento a sério (número, datas, partes, linhas,
totais, método) aumenta a confiança de quem paga pela primeira vez a um desconhecido, e reduz as perguntas "já pagaste?"
no WhatsApp da equipa. **Utilizador-alvo:** arrendatário (e a empresa que precisa de justificar a despesa).
**Critério de sucesso:** zero pedidos manuais de comprovativo à equipa nos primeiros 10 alugueres.

**Decisões (equipa de backend, nesta data — ⚑ validar com o André):**

1. **Gate de KYC por configuração** (`app.kyc.required`, `KYC_REQUIRED`). **Por omissão `true`** (revisto nesta
   data: esquecer a variável em produção não pode abrir a plataforma a contas não verificadas). Desliga-se de forma
   explícita com `KYC_REQUIRED=false` no `.env` local e no staging; a API escreve um aviso no arranque quando está
   desligado. O selo "Verificado" continua a vir
   **só** do KYC aprovado — desligar o gate não põe ninguém como verificado.
2. **Reativar equipamento**: `PATCH /items/{id}/activate`, só o dono, só a partir de `INACTIVE` (pausado).
   `SUSPENDED` é decisão do admin e não se reativa por aqui. Passa pelo mesmo gate de KYC que publicar.
3. **Selo "Verificado"** (#15): `ownerVerified` no `ItemResponse` e `ItemSummaryResponse`; `renterVerified` e
   `ownerVerified` no `BookingResponse`. Uma consulta por página (sem N+1).
4. **Comprovativo de pagamento em PDF** (`GET /payments/{id}/receipt`, arrendatário ou admin, só pagamentos `CONFIRMED`):
   número sequencial próprio (`CP 2026/000001`, sequência na BD, atribuído na confirmação — migração V19 com backfill
   dos pagamentos já confirmados), emitente, cliente, reserva, linhas (aluguer, taxa de serviço, caução reembolsável),
   total, método e data do pagamento, e código de verificação.
   **Chama-se "Comprovativo de pagamento" e diz "Documento não fiscal"**: faturas e recibos com valor fiscal em Angola
   têm de sair de software certificado pela AGT (fora do âmbito, SPEC §9 — ver decisão KYC de 2026-10-23).
   Os dados do emitente (nome legal, NIF, morada) vêm de configuração (`app.company.*`) e ficam de fora se vazios.
5. **Contrato em PDF** (`GET /bookings/{id}/contract/pdf`, partes ou admin): o texto congelado + versão, SHA-256 e
   datas de aceitação de cada parte. O texto continua a ser o `v1-rascunho` (rever com jurista).
6. **Biblioteca**: Apache PDFBox 3 (licença Apache 2.0). Não o iText (AGPL). Fontes base do PDF (Helvetica), sem
   ficheiros de fonte no repo.

**Em aberto.** Nome legal e NIF da empresa para o emitente. Se o dono também deve receber um documento do que recebe
(fica para quando houver levantamentos, #23).

---

## 2026-11-11 (tarde) — Auditoria das partes e dos acessos de admin; contrato e checklist ligados na app

**Contexto.** A revisão do mesmo dia mostrou que o primeiro aluguer não passava do pagamento na app (o frontend nunca
aceitava o contrato) nem do `ACTIVE` (checklist só desenhado). O `audit_logs` só tinha ações da equipa, e a equipa
não tinha ecrã para o ler.

**Decisões (equipa de backend, nesta data — ⚑ validar com o André):**

1. **`audit_logs` passa a registar também as mudanças de estado com valor de prova feitas pelas partes** (SPEC §8):
   `CONTRACT_ACCEPTED` (com versão e SHA-256 do texto aceite), `HANDOVER_REGISTERED` e `HANDOVER_CONFIRMED`. Numa
   disputa, é o rasto de quem aceitou e confirmou o quê, e quando. Sem dados pessoais nos metadados.
2. **Acessos de admin a documentos com dados pessoais ficam registados**: `CONTRACT_VIEWED` (JSON ou PDF) e
   `RECEIPT_VIEWED`, como já acontecia com `KYC_DOCUMENTS_VIEWED`. As partes a lerem os seus documentos não ficam.
3. **Filtros** em `GET /admin/audit-logs`: `action` e `actorId`, combináveis com a entidade. Ecrã `/admin/auditoria`
   com os eventos de segurança ao lado (`/admin/security-events`). Os filtros ficam na URL para partilhar um rasto.
4. **Checklist sem código de 4 dígitos** (confirmado da decisão de 2026-10-23): o ecrã antigo pedia-o e foi retirado.
   Mínimo 2 fotos (API), 6 ângulos sugeridos.
5. **Pagar sem contrato aceite** deixa de dar erro 409 no ecrã: o pagamento encaminha para o contrato.

**Em aberto.** O admin ainda não consegue abrir uma reserva pelo id (`GET /bookings/{id}` é só das partes) — a
auditoria mostra o código mas não liga ao detalhe. Retenção dos registos de auditoria (hoje: para sempre).

---

## 2026-11-11 (fim do dia) — Filas de admin ligadas; avisos de problemas às duas partes

**Contexto.** As filas de cauções e problemas só tinham "ação por ID". O reporte de problema mandava a descrição e as
fotos pelo WhatsApp, apesar de a API já as receber. Quem não reportou o problema não era avisado de que a reserva
ficou em disputa, e ninguém era avisado da resolução.

**Decisões (equipa, nesta data — ⚑ validar com o André):**

1. **Reportar problema avisa a outra parte** (mesmo tipo `INCIDENT_REPORTED`, link para a reserva). Transparência:
   a outra parte pode acrescentar a sua versão à equipa.
2. **Resolver um problema avisa as duas partes com a nota da equipa** (`INCIDENT_RESOLVED`, V20). A nota passa a ser
   escrita a pensar nas partes; o ecrã diz isso ao admin. A caução continua a ser uma decisão à parte.
3. **O admin pode abrir qualquer reserva** (`GET /bookings/{id}`), sem auditoria por leitura: tem nomes e valores,
   não documentos. Contrato e comprovativo continuam auditados quando abertos por admin.
4. **Toda a decisão de admin no ecrã pede motivo** (mínimo 5 caracteres), mesmo onde a API o aceita como opcional
   (libertar caução, validar pagamento): fica em `audit_logs`.
5. Cauções: o ecrã avisa quando há problemas por resolver na reserva, mas não bloqueia a decisão (a API também não).

---

## 2026-11-11 — Disponibilidade e bloqueio de datas (gap #8)

**Contexto.** SPEC §10: "datas ocupadas não são selecionáveis". Hoje só se valida a sobreposição com reservas aceites,
o dono não consegue bloquear datas (viagem, uso próprio, aluguer fora da app) e o arrendatário só descobre o conflito
quando o pedido falha. A tabela `item_availability` (V2, um registo por dia) nunca foi usada.

**Hipótese.** Mostrar as datas ocupadas no Detalhe e deixar o dono bloquear datas reduz pedidos impossíveis e recusas.
**Utilizador-alvo:** arrendatário a escolher datas; dono com o equipamento ocupado fora da app.
**Critério de sucesso:** zero pedidos recusados por "já está ocupado" nas primeiras 4 semanas; recusas < 15%.

**Opções.**
- **A — bloqueios manuais numa tabela; reservas calculadas** a partir de `bookings` (fonte de verdade única).
- **B — tabela única com `booking_id`** (SPEC §8): uma linha por reserva aceite, apagada ao cancelar/expirar.
  Duas fontes para a mesma informação: cada transição (cancelar, recusar, expirar — #11) tem de limpar o bloqueio;
  um esquecimento deixa datas presas para sempre.

**Decisão (equipa, nesta data — ⚑ validar com o André: desvia do SPEC §8, que pedia B):** **opção A.**

1. **`availability_blocks`** (V21): `item_id`, `start_date`, `end_date` **inclusivos** (o dono pensa em dias: "16 a 18"
   bloqueia 16, 17 e 18), nota opcional (só o dono a vê), autor. Máx. 366 dias por bloqueio e 100 bloqueios futuros
   por item. Não se bloqueia o passado nem datas já com reserva aceite/paga.
2. **Reservas** continuam `[início, fim)`: o dia de devolução fica livre para a reserva seguinte. Ocupam datas as
   reservas `ACCEPTED`, `ACTIVE`, `IN_PROGRESS`, `RETURNED` e **`DISPUTED`** (novo: em disputa o equipamento pode
   ainda estar com o arrendatário). Pedidos pendentes não ocupam: o dono escolhe entre pedidos sobrepostos.
   A lista vive em `BookingStatus.OCCUPYING` (fonte única para a disponibilidade e para aceitar).
3. **`GET /items/{id}/availability?from&to`** (público): intervalos de dias indisponíveis, inclusivos, com o motivo
   `BOOKED` ou `BLOCKED` e **sem** nomes, notas nem ids de reserva. Janela por omissão: hoje + 180 dias; máx. 366.
4. **`GET/POST /items/{id}/blocks`, `DELETE /items/{id}/blocks/{blockId}`**: só o dono.
5. **Pedir reserva** recusa datas bloqueadas; **aceitar** volta a verificar (o dono pode ter bloqueado entretanto).
   Criar bloqueio, criar reserva e aceitar fazem lock na linha do item, para não se cruzarem.
6. **Explorar**: `GET /items?startDate&endDate` devolve só equipamento livre nesse período.
7. `item_availability` migra para `availability_blocks` (um dia = um bloqueio, sem perda) e é removida.

---

## 2026-11-11 — Pedido sem resposta expira (gap #11)

**Contexto.** SPEC §7: `requested → expired` (24 h sem resposta). Hoje um pedido `PENDING_OWNER` fica pendurado para
sempre: o arrendatário não sabe se deve procurar outro equipamento e o frontend mostra um prazo que ninguém aplica.

**Hipótese.** Um prazo real faz os donos responderem mais depressa e liberta o arrendatário para outra opção.
**Critério de sucesso:** tempo mediano até resposta < 6 h; < 20% dos pedidos expiram (a medir no 1.º mês).

**Decisões (equipa, nesta data — ⚑ validar com o André):**

1. **Estado novo `EXPIRED`** (V22), em vez de reutilizar `CANCELLED_OWNER`: "recusado" e "não respondeu" contam
   coisas diferentes ao arrendatário e à métrica de resposta.
2. **Prazo**: 24 h desde o pedido (`app.bookings.request-ttl`, configurável) **ou** o fim do dia de levantamento
   (hora de Luanda), o que vier primeiro — um pedido não fica à espera depois de o aluguer começar.
3. **`BookingExpiryScheduler`** a cada minuto, uma transação por pedido (como o dos pagamentos).
4. **Corrida com o aceitar**: lock na linha da reserva no agendador, no aceitar e no cancelar. Depois do prazo, o
   aceitar recusa ("O pedido expirou") mesmo que o agendador ainda não tenha passado — e marca-o `EXPIRED`.
5. **Avisos** (`BOOKING_EXPIRED`): ao arrendatário ("o dono não respondeu a tempo", com atalho para Explorar) e ao dono
   ("o pedido expirou"). Sem auditoria: é uma transição automática sem decisão humana; fica no log.
6. **Fora deste ponto:** prazo para pagar depois de aceite (`ACCEPTED` sem pagamento) — depende da política de
   pagamentos (SPEC §12.3), que está fora desta ronda.

---

## 2026-11-11 — Associar Google a uma conta existente; emails sem diferença de maiúsculas

**Contexto.** Quem já tem conta (telefone + password) e carrega em "Entrar com Google" com o mesmo email recebe
`email_in_use`: por segurança (decisão de 2026-10-23), só associamos automaticamente com o email **verificado** na
Beeznoo. Mas a verificação de email manda o código por email, que está desligado (Resend por configurar), e o ecrã
Conta nem a oferece — beco sem saída. Além disso os emails comparam-se com maiúsculas/minúsculas: o registo e o login
guardam/procuram o email tal como foi escrito, e o Google devolve sempre minúsculas.

**Decisões (equipa, nesta data — ⚑ validar com o André):**

1. **Associar Google com sessão iniciada** (a "história própria" prevista em 2026-10-23 #5): em Conta, "Associar
   conta Google" → `POST /auth/google/link` (autenticado) guarda a intenção **na sessão HTTP do fluxo OAuth2** (cookie
   `httpOnly`, `SameSite=Lax`, 10 min) e o browser segue para o Google. No regresso, a conta Google fica associada
   ao perfil da sessão. A sessão Beeznoo prova a posse da conta; o Google prova a posse da conta Google. **Sem token
   no URL** e sem depender de envio de emails.
   - Conta Google já associada a outro perfil → recusa (`link_conflict`). Perfil já com outra conta Google → recusa.
   - Se o email do Google (verificado pelo Google) for o email do perfil, o email fica **verificado** na Beeznoo.
   - Evento de segurança `GOOGLE_LINKED` (como na associação automática).
2. **Emails normalizados** (minúsculas, sem espaços) em todas as entradas — registo, login, perfil, Google — e
   procurados sem diferença de maiúsculas. V23 normaliza os emails existentes (só quando não colide com outra conta)
   e cria índice em `lower(email)`.
3. O ecrã `email_in_use` passa a explicar o caminho: entrar com telefone e associar o Google em Conta.

**Fora do código.** `redirect_uri_mismatch` é configuração do cliente OAuth na Google Cloud: o URI exato de cada
ambiente tem de estar em "URIs de redirecionamento autorizados". Hoje staging e produção usam o **mesmo** cliente
(`107243221268…`), ao contrário da decisão de 2026-11-05 (um cliente por ambiente).

---

## 2026-11-11 — API a ser morta por memória no Render (512 MB)

**Contexto.** O Render avisou "exceeded its memory limit" e reiniciou o serviço. Reproduzido em local com o mesmo
limite (`docker --memory=512m`, sem swap) e a imagem/JVM em produção: **497 MB em repouso** (às vezes nem arranca) e
**morto pelo kernel** (OOMKilled) com 6 uploads simultâneos de fotos de 35 MP. Native Memory Tracking: ~200 MB fora do
heap (metaspace ~100, symbols ~43, código ~30) + heap até 384 MB (`MaxRAMPercentage=75`) > 512 MB. A recodificação de
imagens descodificava cada foto em tamanho real (35 MP ≈ 140 MB; o dobro com conversão de cor).

**Decisões (equipa, nesta data — ⚑ validar com o André a remoção do RabbitMQ, que constava da stack):**

1. **Imagens descodificadas já reduzidas** (subamostragem, lado maior ≤ 3000 px) e no máximo **2 em simultâneo**.
   As fotos guardadas passam a ter no máximo 3000 px (chega para BI e equipamento; poupa B2 e dados móveis).
2. **Sem RabbitMQ nem Twilio na API**: nenhum código os usava; carregavam classes (−20 MB) e o Twilio trazia o
   `org.json` vulnerável (GHSA-ghc9-756g-vrcv). Voltam quando houver uma história que precise deles.
3. **JVM dimensionada para 512 MB** (`api/Dockerfile`): heap 40%, metaspace ≤ 128 MB, código ≤ 32 MB, só C1,
   SerialGC, pilhas de 512 KB; Tomcat com 40 threads (`TOMCAT_MAX_THREADS`).
   **Resultado medido (3 corridas):** 372–398 MB em repouso, pico 411–420 MB com a mesma carga, sem OOM.
4. Com o plano Standard (2 GB) — se o tráfego crescer — subir `MaxRAMPercentage` e voltar ao compilador C2.

---

## 2026-11-15 — Pagamento direto ao dono (modelo "Yango") e KYC manual pelo portal

**Contexto.** A integração com a EMIS não está fechada e a equipa não quer, nesta fase, receber nem guardar dinheiro
de terceiros. Em Angola as pessoas já conhecem o modelo da Yango: o cliente paga ao motorista (numerário ou
transferência) e a plataforma cobra a comissão ao motorista à parte. O KYC já tinha API mas não tinha ecrãs.

**Hipótese.** Pagar ao dono na entrega, com contrato, checklist e comprovativo na app, chega para o primeiro aluguer
real; tirar a Beeznoo do caminho do dinheiro remove a dependência da EMIS e o risco de guardar cauções.
**Utilizador-alvo:** dono e arrendatário em Luanda que se encontram para a entrega.
**Critério de sucesso:** primeiros 10 alugueres pagos e concluídos sem a equipa mexer em dinheiro, com a comissão
de todos cobrada até 7 dias depois do pagamento.

**Decisões (pedidas pela equipa nesta data — ⚑ validar com o André):**

1. **Modo de pagamento `direct` por omissão** (`app.payments.mode`, `PAYMENTS_MODE`). O modo `reference` (referência
   Multicaixa, 2026-10-16) fica no código, desligado, para quando houver EMIS. No modo `direct` gerar referência dá 409.
2. **O arrendatário paga ao dono, na entrega**, o mesmo total de antes: aluguer + taxa de serviço (8%) + caução.
   Primeiro confere o equipamento, depois paga. A app mostra o valor e as regras; nada é pago antes do encontro.
3. **O dono confirma na app que recebeu** (`POST /bookings/{id}/payment-received`, com o meio: numerário,
   transferência ou Multicaixa Express) → pagamento `DIRECT`/`CONFIRMED`, comprovativo `CP …` (diz "pago ao dono"),
   reserva `ACTIVE`, aviso ao arrendatário, auditoria `PAYMENT_RECEIVED`. Exige o contrato aceite pelo arrendatário.
   O admin pode confirmar em nome do dono (com motivo, auditado), por exemplo se o dono confirmar por telefone.
4. **A taxa de serviço passa a ser dívida do dono** (comissão): fica no próprio pagamento (`service_fee`) até a equipa
   registar que a recebeu (`commission_settled_at`, `POST /admin/commissions/{ownerId}/settle`, auditado
   `COMMISSION_SETTLED`). O dono vê o que deve na Carteira. Sem saldo negativo nem ledger no modo `direct`: o ledger
   só regista dinheiro que passa pela Beeznoo. ⚑ Alternativa: comissão descontada ao dono e o arrendatário paga só
   aluguer + caução (mais parecido com a Yango, mas muda os preços que o dono vê).
5. **A caução fica com o dono e é ele que a devolve.** Depois da devolução confirmada (`RETURNED`), o dono indica
   "devolvi tudo" ou "retive X Kz, motivo" (`POST /bookings/{id}/deposit/decision`) → reserva `COMPLETED`, aviso ao
   arrendatário. Sem caução, a reserva conclui-se sozinha quando a devolução é confirmada.
   **Se o arrendatário não concordar**, reporta um problema até **7 dias** depois da decisão do dono (a reserva
   concluída passa a `DISPUTED`); a equipa medeia e fecha o caso. A Beeznoo não move dinheiro: a sanção possível é
   suspender a conta de quem não cumprir.
6. **Contrato v2** (`v2-rascunho`): diz que o pagamento e a caução são entregues ao dono, que a Beeznoo não recebe nem
   guarda dinheiro do aluguer e que a taxa de serviço é entregue pelo dono à Beeznoo. Continua a rever por jurista.
7. **KYC manual pelo portal.** O utilizador envia BI (frente e verso) e uma selfie com o BI (empresa: documento do NIF
   e certidão/alvará) em `/verificacao`; a equipa decide em Admin › Verificações (aprovar, recusar com motivo, pedir
   mais informação). A app avisa **antes e depois do envio** que a verificação é feita à mão e pode demorar até
   **2 dias úteis** ⚑ (prazo a confirmar). Com os ecrãs feitos, `KYC_REQUIRED=true` volta a fazer sentido em produção.

**Consequências.** Sem dinheiro de terceiros na Beeznoo nem cauções a guardar; em troca, a Beeznoo não garante o
pagamento nem a devolução da caução — só regista, medeia e pode suspender contas. A comissão depende de o dono pagar.

**Complemento (mesma data), depois da revisão — ⚑ validar com o André:**

8. **Cancelar antes de pagar.** O arrendatário pode cancelar uma reserva `ACCEPTED` (ainda não pagou nada); o dono já
   podia, e a app passa a mostrar o botão aos dois (o dono pode deixar uma mensagem). Depois de pago, o cancelamento
   continua em aberto (contrato §9).
9. **Reserva aceite nunca paga expira** no dia seguinte ao da devolução (`BookingExpiryScheduler`): ninguém apareceu ou o
   dono não confirmou o pagamento. As duas partes são avisadas; se o aluguer aconteceu, falam com a equipa.
10. **Contestação da caução: uma vez.** O arrendatário contesta uma vez, até 7 dias depois de o dono registar a caução.
11. **Política de Privacidade** (`/privacidade`), escrita a partir do que a app recolhe de facto, marcada como provisória.
    ⚑ Rever por jurista e confirmar com a APD (Lei n.º 22/11) a notificação do tratamento de documentos de identidade e a
    transferência para fornecedores fora de Angola (alojamento, armazenamento, email, SMS).
12. Páginas antigas com dados mock (`/items`, `/arrendador`, `/arrendatario`) removidas; as categorias da landing abrem o
    Explorar filtrado.

---

## 2026-11-15 — Códigos OTP por WhatsApp (Losambo)

**Contexto.** O SMS (Ombala) custa por mensagem e chega com atraso; em Luanda quase toda a gente usa WhatsApp. A equipa
tem um gateway próprio de WhatsApp, Losambo (`https://message.beeznoo.ao/v1`, autenticação `Bearer lsb_live_…`), com
`/otp/send` (gera e envia um código de 6 dígitos, válido 5 min, guardado só como hash) e `/otp/verify`.

**Decisões (pedidas pela equipa nesta data — ⚑ validar com o André):**

1. **Canal do OTP** (`OTP_CHANNEL`): `whatsapp`, `sms` ou `auto` (omissão). `auto` usa WhatsApp quando há chave do
   Losambo para o ambiente e SMS (Ombala) caso contrário — local e testes continuam a funcionar sem chave.
2. **Duas chaves**, `WHATSAPP_API_KEY_PRD` e `WHATSAPP_API_KEY_TST`; `WHATSAPP_ENV` (`prd`/`tst`, omissão `tst`) escolhe
   qual. Produção: `prd`. Staging e local: `tst`.
3. **O Losambo gera e valida o código**; a Beeznoo continua a guardar um registo por pedido (`otp_codes`, com o
   **propósito** e a validade) e a aplicar os limites de reenvio e de tentativas. Assim um código pedido para registo não
   serve para repor a password, e um código só se usa uma vez. Em `code_hash` fica a referência do pedido no Losambo
   (`losambo:<id>`), não o código.
4. **Número sem WhatsApp** (404 `not_on_whatsapp`): se o SMS estiver configurado, o código segue por SMS; se não, a
   pessoa vê "Este número não tem WhatsApp". Número desligado ou sem quota (409/429) também cai para SMS quando possível.
5. Os outros endpoints do Losambo (`/messages`, `/contacts/{phone}`, `/numbers/{id}/health`) ficam para uma história
   própria (avisos por WhatsApp, verificar o número no registo, alerta de quota).

**A confirmar com quem gere o Losambo:** o corpo do `/otp/verify` não está na documentação pública. Enviamos
`{ "id", "to", "code" }` e aceitamos como válido um 2xx sem `valid`/`verified` a `false`. Testar em staging com a chave
TST antes de produção.

---

## 2026-11-15 — Painel de métricas do admin (North Star)

**Contexto.** A visão geral do admin só mostra as quatro filas. Para saber se o MVP está a funcionar, a equipa precisa de
ver a North Star (alugueres pagos e concluídos por mês) e o que a trava, sem correr SQL à mão.

**Hipótese.** Se a equipa vir todas as semanas os alugueres concluídos, o funil de pedidos e o tempo de KYC, descobre
mais cedo onde se perdem os alugueres (dono não responde, KYC lento, pedidos que expiram) e age sobre isso.
**Para quem:** equipa Beeznoo (ADMIN). **Sucesso:** a demo de sexta usa este ecrã em vez de consultas à base de dados.

**Decisões (pedidas pela equipa nesta data — ⚑ validar com o André):**

1. **Um endpoint só de leitura**, `GET /api/v1/admin/metrics` (ADMIN), calculado na hora com SQL agregado. Sem tabelas
   novas nem jobs: com o volume do MVP a consulta custa milissegundos. Se crescer, passa a vista materializada.
2. **Meses no fuso de Luanda** (`Africa/Luanda`), últimos 6 meses incluindo o atual, meses sem dados a zero.
3. **Concluído** = reserva `COMPLETED`, contada no mês da última alteração (`bookings.updated_at`; a reserva não muda
   depois de concluída). **Pago** = pagamento `CONFIRMED`, no mês de `confirmed_at`. **Valor alugado** = soma do aluguer
   (`rental_amount`), sem taxa nem caução. **Comissão** = `service_fee` dos pagamentos confirmados.
4. **Funil dos últimos 30 dias**, por data do pedido, a partir do estado atual de cada reserva: pedidos → aceites (passou
   de `PENDING_OWNER` para um estado de aluguer) → pagos (tem pagamento confirmado) → concluídos; perdidos =
   recusados/cancelados/expirados. Um pedido cancelado depois de aceite conta como perdido, não como aceite — aproximação
   aceitável sem histórico de estados.
5. **KYC:** pendentes (`PENDING`, `IN_REVIEW`, `INFO_REQUESTED`) e tempo médio de decisão (submissão → `reviewed_at`) das
   decisões dos últimos 30 dias.
6. **Gráficos sem biblioteca** (SVG próprio em `src/components/bz/`), seguindo a regra de não juntar bibliotecas de UI.
## 2026-11-15 — Ações de admin: utilizadores, suspensões e pagamento na reserva

**Contexto.** No teste de staging a equipa não tinha como encontrar uma pessoa, afastar quem não cumpre (o contrato v2
diz que "a Beeznoo pode suspender a conta") nem ver o pagamento a partir do detalhe de uma reserva (falha anotada em
`BACKEND_GAPS.md`). Hoje isto exigia SQL no servidor.

**Hipótese.** Com estas ações no portal, a equipa resolve problemas de confiança (equipamento enganador, dono ou
arrendatário que não cumpre) no próprio dia, sem acesso à base de dados. **Para quem:** equipa Beeznoo (ADMIN).
**Sucesso:** nenhuma operação do dia a dia precisa de SQL; cada suspensão fica na auditoria com motivo.

**Decisões (pedidas pela equipa nesta data — ⚑ validar com o André):**

1. **Pesquisar utilizadores** (`GET /admin/users?q=`): por nome, telefone ou email; mostra papel, telefone confirmado,
   estado do KYC, suspensão e contagens. Ficha (`GET /admin/users/{id}`) com o equipamento e as últimas reservas.
   Ver a ficha não fica na auditoria (não abre documentos); abrir documentos de KYC continua a ficar.
2. **Suspender equipamento** (`PATCH /admin/items/{id}/suspend`, motivo obrigatório): passa a `SUSPENDED`, perde o
   destaque, sai do Explorar e não aceita pedidos. **Reativar** (`/reinstate`) volta a `ACTIVE`. O dono não reativa um
   item suspenso (já era assim). Auditoria `ITEM_SUSPENDED` / `ITEM_REINSTATED`.
3. **Suspender conta** (`POST /admin/users/{id}/suspend`, motivo obrigatório; migração V25 `profiles.suspended_at`,
   `suspension_reason`, `suspended_by`): sessões revogadas e não volta a entrar (login, refresh, Google e 2FA de admin
   recusados com "A tua conta está suspensa"). O token de acesso já emitido vale no máximo 15 min. O equipamento da conta
   sai do Explorar e não recebe pedidos, sem mudar o estado de cada item (reativar a conta devolve tudo como estava).
   Contas ADMIN não se suspendem por aqui. Auditoria `ACCOUNT_SUSPENDED` / `ACCOUNT_REINSTATED`.
4. **Reservas em curso** de uma conta ou item suspenso **não são canceladas automaticamente**: a equipa decide caso a
   caso (manual antes de automatizar). Não há notificação automática da suspensão: a equipa avisa a pessoa.
5. **Pagamento no detalhe da reserva:** `GET /bookings/{id}/payments/current` passa a aceitar ADMIN (como o
   comprovativo já aceitava).

---

## 2026-11-16 — Identidade Verde v4 ("Colmeia em movimento") na landing e na app

**Contexto.** A landing (beeznoo.ao) parecia amadora: plana, formulário longo logo no topo, pouco movimento. Foi
redesenhada no Claude Design com motion, 3D leve e melhor UX, e o pedido é levar a mesma linguagem a toda a app.

**Hipótese.** Uma landing com proposta mais clara (como funciona, confiança, valores visíveis) e uma app com a mesma
linguagem aumentam a passagem visita → registo → primeiro pedido de reserva.
**Utilizador-alvo:** visitante que ainda não confia em alugar a um desconhecido; arrendatário/dono novo.
**Critério de sucesso:** taxa de inscrição na lista/registo por visita à landing ≥ 2× a da versão anterior nas
primeiras 4 semanas; sem queda de desempenho (LCP < 2,5 s num Android de gama média em 4G).

**Decisões (pedidas pela equipa nesta data — ⚑ validar com o André):**

1. **`docs/DESIGN_SYSTEM.md` passa à v4.** Paleta, fontes (Bricolage Grotesque + DM Sans), raios 12/16/24 e vocabulário
   mantêm-se. Acrescenta tokens de movimento, regras de 3D em CSS e componentes `HexTile`, `SegmentedControl`,
   `SuccessCheck`, `BookingTicket` com inclinação, rodapé escuro.
2. **Movimento com limites na app:** nada de animações infinitas em listas, sem parallax no telemóvel, só
   `transform`/`opacity`, `prefers-reduced-motion` sempre respeitado. A landing pode usar mais.
3. **Sem WebGL/three.js** — o 3D é CSS (peso e bateria).
4. **Copy alinhada com o pagamento direto ao dono** (2026-11-15): "Pagas ao dono na entrega", "O dono devolve-te a
   caução", Timeline "pago ao dono" / "caução devolvida".
5. **Landing:** botões "Entrar" e "Criar conta" no cabeçalho; formulário da lista de espera sai do hero para uma
   secção própria; novas secções (categorias, como funciona com timeline, dois papéis, confiança, perguntas, rodapé).

**Em aberto.**

- Fotos reais de equipamento para a landing e para os anúncios de exemplo (próprias ou de banco com licença).
- Número de WhatsApp da equipa nos links (`NEXT_PUBLIC_WHATSAPP_NUMBER`).
- Se a lista de espera continua depois do lançamento ou é substituída por "Criar conta".
- Prazo de verificação "até 2 dias úteis" (⚑ 2026-11-15) — confirmar antes de o publicar na landing.

---

## 2026-11-16 — Taxa de serviço configurável e pré-visualização dos links

**Taxa de serviço.** O backend já lia `PAYMENTS_SERVICE_FEE_RATE` (`app.payments.service-fee-rate`, omissão 0.08), mas o
frontend tinha 8% fixo: mudar a variável fazia a API cobrar uma taxa e o ecrã mostrar outra. Agora há uma só fonte:
`GET /api/v1/config` (público, cache 5 min) devolve `serviceFeeRate`, e o frontend lê-a (`lib/fee.ts`, com 8% enquanto
não chega). A variável passa no `deploy/coolify/docker-compose.yml`. Mudar a taxa só afeta pagamentos novos (o
pagamento guarda a taxa calculada). A landing mostra um exemplo ilustrativo com "8%" fixo (mockup de marketing).

**Pré-visualização dos links (WhatsApp, Facebook, LinkedIn, X).** Metadados Open Graph em todo o site (`SITE_URL` no
build para os endereços absolutos) e duas imagens geradas no servidor com `next/og`: a da marca (título da landing) e
uma por equipamento (foto, nome, preço por dia, bairro, selo de dono verificado), em JPEG < 100 KB para o WhatsApp a
mostrar. Sem dados pessoais além do que a página pública do equipamento já mostra.

---

## 2026-11-17 — Administradores, mensagens da equipa, zonas de serviço (piloto Luanda), mapa de registos, EN, balanceador

**Contexto.** Pedido urgente da equipa: (a) dar papel de admin a outras pessoas; (b) mandar mensagens às pessoas a
partir do Admin, com modelos predefinidos ou texto livre, por WhatsApp (Losambo, custa mais), email (Resend) ou SMS
(Ombala); (c) o piloto é **só Luanda** — quem está noutra província pode registar-se e fazer KYC, mas não publica;
(d) mapa de calor de onde se fazem os registos pós-KYC; (e) plataforma também em inglês; (f) revisão de segurança e
balanceador à frente da API, que não deve ser acessível fora da VPS.

**Hipótese.** Contactar as pessoas certas no momento certo (KYC parado, reserva por aceitar) aumenta a conversão
pedido → aluguer pago; travar a publicação fora de Luanda evita anúncios que ninguém consegue alugar no piloto e
mostra-nos onde está a procura para expandir.
**Utilizador-alvo:** equipa Beeznoo (admin); donos fora de Luanda; estrangeiros residentes com número não angolano.
**Critério de sucesso:** ≥ 80% das mensagens enviadas pelo Admin entregues; 0 anúncios publicados fora das zonas
ativas; mapa usado na decisão da 2.ª província.

**Decisões (pedidas pela equipa nesta data — ⚑ validar com o André):**

1. **Promover/retirar admin** em Admin › Utilizadores (`PATCH /admin/users/{id}/role`). Não se retira o próprio papel
   nem o último admin. Contas suspensas não são promovidas. Auditoria `USER_ROLE_CHANGED`.
2. **Mensagens da equipa** (Admin › Mensagens): modelos predefinidos (semeados na migração) e modelos próprios, com
   variáveis `{{nome}}`; envio a uma pessoa, a várias ou a um segmento (todos, verificados, por cidade). Canais:
   `WHATSAPP` (Losambo `POST /v1/messages` — o corpo não está documentado publicamente, usamos `{to, text}`; ⚑ confirmar),
   `EMAIL` (Resend), `SMS` (Ombala). **Números não angolanos (fora de +244) só recebem por WhatsApp** — SMS da Ombala
   não chega lá. O envio sai depois do commit, em segundo plano, com ritmo (Losambo "ritmo humano") e limite de
   destinatários por envio; cada entrega fica registada (`message_deliveries`) com estado. WhatsApp mostra aviso de custo.
   Verificar se um número tem WhatsApp: `GET /admin/messages/whatsapp-check` → Losambo `GET /v1/contacts/{phone}`.
   Não é chat: só saída. Auditoria `MESSAGE_SENT`.
3. **Telefones estrangeiros** aceites no registo em formato internacional (`+<indicativo>…`); para eles o OTP é só
   WhatsApp.
4. **Zonas de serviço** (`service_areas`): província + cidade, centro (lat/lng) e raio em km, ativa/inativa, geridas
   em Admin › Zonas. Semeado: **Luanda (ativa, raio 60 km)** e **Bengo (ativa, Caxito,
   raio 60 km)** — Bengo confirmado no piloto pela equipa em 2026-11-17. Publicar equipamento exige localização atual dentro de uma zona
   ativa; fora dela a API responde 403 `area_not_available` e a app explica "Ainda não estamos na tua zona". O registo
   e o KYC continuam abertos em todo o lado. A verificação repete-se em cada tentativa de publicar.
   ⚠ A localização vem do browser e pode ser falsificada: é um controlo de produto, não de segurança.
5. **Localização com consentimento.** A app pede acesso à localização (registo, KYC e publicar), explica porquê, e
   guarda só coordenadas **arredondadas a ~1 km** (2 casas decimais). Recusar não bloqueia o registo; bloqueia
   publicar. Política de privacidade atualizada. Histórico de localização guardado **até 12 meses** (confirmado pela
   equipa em 2026-11-17).
6. **Mapa de calor** (Admin › Mapa): contagem agregada por célula (~5 km) de pessoas com KYC submetido/aprovado, com
   mínimo de 3 por célula para não identificar ninguém. Não é localização de pessoas.
7. **Inglês:** a interface ganha seletor PT/EN (cookie `lang`, omissão `pt`). Dicionários próprios, sem biblioteca.
8. **Balanceador:** Caddy é a única porta de entrada (80/443). API, Postgres e Garage só na rede interna do Docker;
   a API corre em 2 réplicas atrás do Caddy/Next com health check. Nenhuma porta da API ou da BD publicada no host.
   **Implementação:** Next → `api-lb:8080` (site interno do mesmo Caddy; no Coolify um Caddy à parte) → `api-1`/`api-2`,
   `least_conn` + afinidade por cookie (o login Google usa a sessão HTTP da réplica). Postgres e Garage em redes
   `internal: true`. Agendadores só na `api-1` (`SCHEDULER_ENABLED`); limites de pedidos no Postgres
   (`RATE_LIMIT_STORE=database`); 768 MB por réplica (~700 MB a mais do que uma réplica numa VPS de 4 GB);
   `update.sh` rolante. Não é alta disponibilidade: um só servidor e um só Postgres. Detalhe e trade-offs em
   `docs/DEPLOY_VPS.md` ("Arquitetura") e achados em `docs/SEGURANCA.md` ("Revisão 2026-11-17").

**Em aberto.**
- Corpo exato de `POST /v1/messages` e resposta de `GET /v1/contacts/{phone}` no Losambo (consola /consola).
- Custo por mensagem WhatsApp e orçamento mensal.
- Limpeza diária automática de `location_events` com mais de 12 meses (`LocationRetentionScheduler`).

**Nota de schema (2026-11-17).** As mensagens da equipa entram como **V28** (`V28__admin_messages.sql`), não V26:
foram integradas depois da V27 (zonas de serviço) e o Flyway recusa uma versão mais baixa numa base onde a V27 já
esteja aplicada. A V26 fica por usar (o Flyway aceita saltos).

---

## 2026-11-18 — Verificação de identidade visível, acesso da equipa ao KYC e números estrangeiros

**Contexto.** (1) Pouca gente encontrava o "Verifica a tua identidade" (só um link na Conta e um 403 ao publicar/pedir).
(2) A equipa dizia que os dados do KYC ficavam guardados mas que deixava de os conseguir rever. (3) Quem está em Luanda
com número estrangeiro não conseguia registar-se: o frontend tinha o prefixo `+244` fixo e 9 dígitos (o backend já
aceitava E.164 desde 2026-11-17).

**Hipótese.** Se a pessoa vir o passo de verificação (o que é, porquê, quanto demora, o que precisa) no momento certo,
mais pessoas chegam a "Verificado" antes do primeiro pedido; se a equipa vir todas as verificações, decide mais depressa;
se estrangeiros residentes se puderem registar, aumenta a oferta e a procura. **Utilizador-alvo:** arrendatários e
donos novos; equipa Beeznoo. **Critério de sucesso:** % de contas com KYC submetido nos primeiros 7 dias; tempo médio
de decisão (já em Admin › Visão geral); registos com número fora de +244.

**Decisões.**
1. **Cartão de verificação** (`KycCard`, estado: por começar · em análise · recusada com motivo e "Enviar outra vez" ·
   falta informação · verificada) na Conta, no Painel do dono, no início de Publicar e no lugar do pedido em Reservar.
   Nos momentos com gate só aparece se o servidor exigir KYC (`canTransact`).
2. **Causa da falta de acesso da equipa** (achados): a API de decisão e as URLs assinadas funcionam (teste de ponta a
   ponta por HTTP: `KycAdminFlowIntegrationTest`), mas (a) a fila só mostrava `PENDING`/`IN_REVIEW` — depois de
   recusar, aprovar ou pedir informação a verificação desaparecia e não havia forma de voltar aos documentos, enquanto a
   Visão geral contava `INFO_REQUESTED` como pendente; (b) quem recebia acesso de admin (Admin › Utilizadores, desde
   2026-11-17) ficava com o token antigo e a área de Admin recusava-o sem pedir nada à API, por isso a sessão nunca era
   renovada. Correções: `GET /admin/kyc?status=OPEN|INFO_REQUESTED|REJECTED|APPROVED` e `?profileId=` (separadores em
   Admin › Verificações e "Ver documentos" na ficha da pessoa); o Admin renova a sessão uma vez antes de recusar
   (a promoção já revoga as sessões → entra outra vez com 2FA).
3. **Documentos de KYC:** continuam guardados depois da decisão (nada é apagado); só URLs assinadas de 5 min, cada
   abertura auditada (`KYC_DOCUMENTS_VIEWED`). ⚑ O prazo de retenção depois de aprovado/recusado continua em aberto
   (ver 2026-10-23) — decidir com o André antes de implementar limpeza.
4. **Telefone:** campo com indicativo do país (+244 por omissão, lista de países frequentes e "Outro país"),
   normalização para E.164 no frontend (`lib/phone.ts`) e no backend (`Phones.normalize`, nos DTOs de registo,
   verificação, login, recuperação e Google). O mesmo número escrito de outra forma é o mesmo (unicidade, login,
   recuperação). Fora de +244 o código vai só por WhatsApp (sem alteração à decisão de 2026-11-17).

---

## 2026-11-18 — Tema claro/escuro/sistema único; landing de produto em produção

**Contexto.** O tema escuro só era aplicado pelo `AppShell` (num `useEffect`, depois da pintura) e pela página Conta.
Resultado: flash ao carregar; ao sair da sessão a classe `.dark` ficava no `<html>` e o login ficava escuro (mas, num
carregamento direto, claro); o admin herdava o escuro e não tinha forma de o mudar; a landing ignorava-o. O `<body>` usava
ainda tokens antigos (estilo shadcn) com outros verdes/areias. A landing tinha a lista de espera, que já não faz sentido
com a plataforma no ar.

**Decisões (⚑ a validar pelo André):**

1. **Um só mecanismo de tema** (`frontend/src/lib/theme-script.ts` + `lib/theme.ts`): escolha `claro` / `escuro` /
   `sistema` guardada em `localStorage` (`beeznoo.theme`, preferência do aparelho, não da conta: mantém-se ao sair).
   Um script no `<head>` do layout raiz aplica `.dark` e `color-scheme` antes da primeira pintura, em todas as rotas.
   **Omissão: claro** (a identidade é 70% areia); "sistema" é opção explícita.
2. **Onde se muda:** botão compacto "tema e língua" (`PreferencesMenu`) no cabeçalho da app, da landing, no canto do
   ecrã de autenticação e na barra lateral do admin; controlo completo em Conta › Aparência; tema e língua no rodapé da landing.
3. **Paleta escura** = os tokens da v4 com o mesmo papel (globals.css, `.dark`), AA verificado. Âmbar e sálvia levam sempre
   texto verde-escuro (`sobre-ambar`, `sobre-salvia`). A landing segue o tema; blocos verdes e ilustrações mantêm as cores claras.
4. **Landing em produção:** sai a lista de espera (formulário, contagem, CTAs, Google Apps Script na CSP). CTAs reais:
   Explorar equipamento (âmbar), Publicar equipamento, Entrar / Criar conta; "Diz-nos o que procuras" vai para o WhatsApp.

**Em aberto.** O slogan "Por que comprar quando podes alugar?" segue a norma brasileira na pergunta direta; em pt-PT
escreve-se "Porque comprar quando podes alugar?". Não mudei por ser texto de marca congelado — decisão do André.

---

## 2026-11-18 — Localização: consentimento na conta, Publicar sem bloquear, mapa com 2 níveis

**Contexto.** Três bugs em produção: (1) "Publicar" demorava ou congelava à espera da localização (o formulário só
aparecia depois do pedido ao browser e da verificação da zona; `permissions.query` e os pedidos à API não tinham tempo
máximo; quem ignorava o pedido do browser esperava até 32 s); (2) o Admin › Mapa aparecia vazio apesar de muitas pessoas
terem aceitado a localização: em Publicar a posição só era *consultada* (`publish-eligibility`, não guarda), o ecrã abria
em "Verificados", e com poucas pessoas espalhadas quase todas as células de 5 km tinham 1–2 pessoas (escondidas pelo
mínimo de 3) sem a UI dizer quantas estavam escondidas; (3) noutro dispositivo a app voltava a perguntar, porque "já
perguntei" vivia só no `localStorage`.
**Hipótese.** Tirar a espera de Publicar e não repetir perguntas aumenta os anúncios publicados; um mapa com dados
serve a decisão da 2.ª província. **Utilizador-alvo:** donos (Publicar), equipa (Mapa).
**Critério de sucesso:** Publicar abre em < 1 s em rede 3G; 0 queixas de "congela"; mapa com células visíveis.

**Decisões (⚑ validar com o André):**
1. **Consentimento na conta.** `profiles.location_consent_at` (V27) passa a ser a fonte: `GET /me/location` e
   `location` em `GET /profiles/me` devolvem `{consented, consentAt, updatedAt, inServiceArea, area, storedZoneUsable}` —
   **zona, nunca coordenadas**. Noutro dispositivo, com consentimento, a app não volta a perguntar; só chama a API do
   browser em silêncio se a permissão já estiver dada nesse browser. Sem migração (V29 não usada).
2. **Publicar não espera pela localização.** O formulário aparece logo; a zona resolve-se num cartão no topo, por ordem:
   posição do browser já autorizada (≤ 8 s) → zona guardada na conta (última localização ≤ **30 dias** numa zona
   ativa) → a pessoa escolhe "Usar a minha localização" ou **a zona à mão** (lista das zonas ativas).
   A API aplica a mesma ordem em `POST /items` e `PATCH /items/{id}/activate` (`location`, `areaId` ou nada).
   Zona à mão recusada (403) se o browser disse "fora das zonas" nas últimas 24 h. A zona à mão e a zona guardada
   **não criam** `location_events` (o mapa só recebe posições reais).
   ⚠ Trade-off: escolher a zona à mão torna o gate mais fácil de contornar. Já era só controlo de produto (o browser
   pode ser enganado); a alternativa (sem escolha à mão) deixa de fora quem tem a localização bloqueada ou um browser
   sem GPS. Se aparecerem anúncios fora do piloto, retirar a escolha à mão é uma mudança só de frontend + `areaId`.
3. **Publicar regista a posição** (contexto `APP`) quando a obtém, em vez de só consultar: alimenta o mapa.
4. **Mapa com 2 níveis.** Quem fica numa célula de 0,05° (~5 km) com menos de 3 junta-se numa célula de 0,25° (~28 km);
   o mínimo de 3 mantém-se em todas e cada pessoa conta numa só célula. O ecrã abre em "Todos" (com localização), mostra
   quantos têm/não têm localização e quantos ficaram escondidos. Contas de admin continuam fora.
5. **Tempos máximos:** permissão 1,5 s; posição 10 s (+20 s para responder ao pedido do browser; +2 s quando já
   autorizado); pedidos de localização à API 8–10 s. Retenção inalterada (histórico 12 meses; o mapa lê o perfil).

**Em aberto.** Botão "Retirar consentimento" na conta (hoje: definições do browser ou pedido à equipa).

---

## 2026-11-18 — Acesso ao Admin por convite, papéis da equipa e back-office

**Contexto.** Feedback do André (produção): a gestão de contas "não é profissional"; o botão "Tornar admin" estava
exposto em cada linha de Admin › Utilizadores (um clique dava acesso total a dados de KYC e pagamentos); as ações eram
rasas; o painel parecia um protótipo. Esta entrada **substitui a decisão 1 de 2026-11-17** (promover/retirar admin
em Utilizadores).

**Hipótese.** Com acesso por convite, papéis com o mínimo de permissões e ações com motivo e auditoria, a equipa
(4 pessoas + quem vier) trabalha mais depressa e com menos risco de um erro ou de uma conta roubada expor dados de
identidade. **Utilizador-alvo:** equipa Beeznoo. **Critério de sucesso:** 0 acessos de admin concedidos fora do fluxo
de convite; 100% das ações sensíveis sobre contas com motivo em `audit_logs`; a equipa resolve um caso de conta
(encontrar → ficha → ação) em < 2 min.

**Decisões.**

1. **Papéis da equipa** (`profiles.admin_role`, V31; só existe com `role = 'ADMIN'`):
   | Papel | Pode |
   |---|---|
   | `SUPER_ADMIN` | tudo, incluindo Equipa e acessos, Auditoria e eventos de segurança |
   | `OPERATIONS` | Operação (reservas, pagamentos/comissões, cauções, problemas), ver Utilizadores, notas, moderar equipamento, mensagens |
   | `TRUST` | Confiança (verificações KYC, Utilizadores com ações: suspender, terminar sessões, repor telefone), notas, moderar equipamento, mensagens |
   | `GROWTH` | Crescimento (mapa, zonas, mensagens) e ver Utilizadores (para escolher destinatários) |
   Todos veem a Visão geral (métricas agregadas, sem dados pessoais). As permissões vêm da BD em cada pedido
   (`JwtAuthFiltter` já confirmava o papel ADMIN na BD): mudar ou retirar um papel tem efeito no pedido seguinte.
   Os admins existentes ficam `SUPER_ADMIN` (migração). Um ADMIN sem `admin_role` só vê a Visão geral (menor privilégio).
2. **Acesso só por convite.** Um `SUPER_ADMIN` convida um utilizador existente (pela conta) ou um email, com um papel.
   O convite tem um token aleatório de 32 bytes, guardado só como SHA-256, válido **72 h**, de uso único e revogável.
   O link leva o token no **fragmento** (`/convite-equipa#…`), que o browser não envia a servidores nem fica em logs;
   a aceitação é um `POST` com o token no corpo. Quem aceita tem de ter sessão iniciada, telefone confirmado, conta
   não suspensa, e ser a pessoa convidada (a conta indicada, ou o email convidado **já confirmado**). Ao aceitar, as
   sessões são revogadas: volta a entrar, agora com 2FA de admin. O link é mostrado uma vez a quem convida (para o
   mandar por WhatsApp, manual antes de automatizar) e vai por email quando há email.
3. **Pedidos de acesso: não construídos.** Não recomendo um botão "pedir acesso de admin" num marketplace aberto: dá
   a qualquer conta uma porta para engenharia social e cria uma fila que ninguém precisa (a equipa conhece-se). O
   convite cobre o caso "quero entrar na equipa" — a pessoa pede por fora e um SUPER_ADMIN convida. Revisitar se a
   equipa passar de ~10 pessoas.
4. **Equipa e acessos** (Admin › Sistema › Equipa): mudar o papel e retirar o acesso, sempre com motivo. Proteções:
   ninguém muda nem retira o próprio acesso (sem auto-promoção nem auto-despromoção); fica sempre pelo menos um
   `SUPER_ADMIN` ativo (bloqueio de linhas, como no último admin); retirar acesso devolve a conta a `BOTH` e revoga
   as sessões. Auditoria: `ADMIN_INVITED`, `ADMIN_INVITATION_REVOKED`, `ADMIN_INVITATION_ACCEPTED`,
   `ADMIN_ROLE_CHANGED`, `ADMIN_ACCESS_REVOKED`, na mesma transação. `PATCH /admin/users/{id}/role` é removido.
5. **Gestão de contas** (Admin › Confiança › Utilizadores): tabela com pesquisa, filtros (papel, estado do KYC,
   suspensão, telefone confirmado, data de registo), ordenação e paginação no servidor. Ficha com perfil, KYC (link
   para Verificações), equipamento, reservas, notas internas e histórico (auditoria da conta e das verificações).
   Ações com confirmação e **motivo obrigatório**: suspender, reativar, terminar sessões, repor confirmação do
   telefone. Nota interna (`admin_user_notes`, só a equipa vê; append-only). "Enviar mensagem" abre Mensagens com a
   pessoa escolhida. Cada ação fica em `audit_logs` (`SESSIONS_REVOKED`, `PHONE_VERIFICATION_RESET`, `USER_NOTE_ADDED`).
   - **Terminar sessões** revoga os refresh tokens; o token de acesso já emitido dura ≤ 15 min (como na suspensão).
   - **Repor telefone** obriga a confirmar o número outra vez. Para não trancar a pessoa: no login com telefone por
     confirmar, a API envia um código novo e responde `403 phone_unverified`; o ecrã de entrar pede o código.
6. **Reservas no Admin** (Operação): lista paginada com filtro por estado e pesquisa (equipamento, dono,
   arrendatário) — não havia lista, só a ficha.
7. **Back-office.** Barra lateral agrupada (Operação · Confiança · Crescimento · Sistema), barra de topo com menu
   da pessoa (papel, sair), cabeçalhos de página iguais, tabelas densas, estados vazio/a carregar/erro em todas as
   listas. Sem animações decorativas no Admin (DESIGN_SYSTEM §6, "Regras da app"). Desktop primeiro, tablet usável,
   telemóvel legível. Só tokens de cor (claro/escuro).

**Consequências.** Migração **V31** (`admin_role`, `admin_invitations`, `admin_user_notes`). Endpoints novos em
`/api/v1/admin/team/**` (SUPER_ADMIN), `/api/v1/admin/access/me`, `/api/v1/team-access/invitations/{inspect,accept}`
(qualquer sessão), `/api/v1/admin/users/{id}/{sessions/revoke,phone-verification/reset,notes,history}` e
`/api/v1/admin/bookings`. Os controladores de admin passam de `hasRole('ADMIN')` para permissões por área.

**Em aberto (⚑ validar com o André).**
- Os quatro papéis e o que cada um pode (tabela acima).
- Validade do convite (72 h).
- Serviços que ainda decidem "é admin?" só pelo papel ADMIN (contratos, recibos, fichas de reserva) — qualquer
  papel da equipa os abre. Restringir por área quando houver mais gente na equipa.
