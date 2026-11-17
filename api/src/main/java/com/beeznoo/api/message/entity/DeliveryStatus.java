package com.beeznoo.api.message.entity;

public enum DeliveryStatus {
    PENDING,
    SENT,
    FAILED,
    // não enviado por regra (sem email, SMS para fora de Angola, conta suspensa…); motivo em error
    SKIPPED
}
