package com.beeznoo.api.security.entity;

import static com.beeznoo.api.security.entity.SecurityEventType.Severity.*;

public enum SecurityEventType {
    LOGIN_LOCKED(MEDIUM),          // limite de tentativas de login por conta atingido
    OTP_LOCKED(MEDIUM),            // 5 erros no mesmo código
    RATE_LIMITED(LOW),             // primeiro pedido acima de um limite
    REFRESH_TOKEN_REUSE(HIGH),     // refresh já usado reapareceu → sessões revogadas
    ADMIN_LOGIN(LOW),              // admin entrou (depois do 2FA)
    ADMIN_MFA_FAILED(HIGH),        // admin bloqueado no 2FA
    PASSWORD_CHANGED(LOW),
    PASSWORD_RESET(LOW),
    EMAIL_VERIFIED(LOW),
    GOOGLE_LINKED(LOW),            // Google associado por email verificado dos dois lados
    GOOGLE_EMAIL_IN_USE(LOW);      // Google com email de outra conta não verificada — não associado

    public enum Severity { LOW, MEDIUM, HIGH }

    public final Severity severity;

    SecurityEventType(Severity severity) {
        this.severity = severity;
    }
}
