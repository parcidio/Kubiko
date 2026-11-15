package com.beeznoo.api.transaction.entity;

public enum PaymentMethod {
    REFERENCE,  // pagamento por referência Multicaixa (Express ou ATM)
    MANUAL,     // validado manualmente pelo admin com comprovativo
    DIRECT      // pago ao dono na entrega; o dono (ou o admin por ele) confirma na app (decisoes-produto.md 2026-11-15)
}
