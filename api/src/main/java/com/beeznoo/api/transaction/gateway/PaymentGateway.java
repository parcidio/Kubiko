package com.beeznoo.api.transaction.gateway;

import com.beeznoo.api.transaction.entity.Payment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Ponto único de integração com o processador de pagamentos.
 * Hoje: {@link SimulatedPaymentGateway}. Futuro: EMIS (Multicaixa) — nova implementação, mais nada muda.
 */
public interface PaymentGateway {

    /** Identificador gravado em payments.provider (ex.: SIMULATED, EMIS). */
    String provider();

    /** Emite uma referência para o montante, válida até expiresAt. */
    IssuedReference issueReference(BigDecimal amount, OffsetDateTime expiresAt);

    /** Pergunta ao processador se a referência já foi paga. */
    GatewayStatus checkStatus(Payment payment);

    record IssuedReference(String entity, String reference) {}

    record GatewayStatus(State state, String transactionId) {
        public enum State { PENDING, PAID, FAILED }

        public static GatewayStatus pending() {
            return new GatewayStatus(State.PENDING, null);
        }

        public static GatewayStatus paid(String transactionId) {
            return new GatewayStatus(State.PAID, transactionId);
        }
    }
}
