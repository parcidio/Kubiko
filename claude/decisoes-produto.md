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
