package com.beeznoo.api.transaction.entity;

public enum PaymentStatus {
    AWAITING_PAYMENT,   // referência emitida, à espera do pagamento
    CONFIRMED,          // pagamento validado (gateway ou admin) e liquidado no ledger
    EXPIRED,            // referência passou da validade sem pagamento
    CANCELLED,          // reserva cancelada com a referência em aberto
    FAILED              // gateway reportou falha
}
