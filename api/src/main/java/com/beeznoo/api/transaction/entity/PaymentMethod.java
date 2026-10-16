package com.beeznoo.api.transaction.entity;

public enum PaymentMethod {
    REFERENCE,  // pagamento por referência Multicaixa (Express ou ATM)
    MANUAL      // validado manualmente pelo admin com comprovativo
}
