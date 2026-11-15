package com.beeznoo.api.transaction.entity;

/** Meio usado no pagamento direto ao dono (guardado em payments.provider). */
public enum DirectChannel {
    CASH("Numerário"),
    TRANSFER("Transferência bancária"),
    MULTICAIXA_EXPRESS("Multicaixa Express");

    public final String label;

    DirectChannel(String label) {
        this.label = label;
    }

    public static String labelOf(String provider) {
        for (DirectChannel c : values()) if (c.name().equals(provider)) return c.label;
        return provider;
    }
}
