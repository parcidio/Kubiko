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
