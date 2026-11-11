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
