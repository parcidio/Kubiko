package com.beeznoo.api.transaction.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.time.Duration;

/**
 * Configuração de pagamentos. Ver claude/decisoes-produto.md (2026-10-16).
 *
 * @param provider       gateway ativo: "simulated" (MVP) ou, no futuro, "emis"
 * @param serviceFeeRate taxa de serviço sobre o aluguer (0.08 = 8%)
 * @param referenceTtl   validade de uma referência
 * @param simulated      opções do gateway simulado
 */
@ConfigurationProperties(prefix = "app.payments")
public record PaymentProperties(
        String provider,
        BigDecimal serviceFeeRate,
        Duration referenceTtl,
        Simulated simulated
) {
    public PaymentProperties {
        if (provider == null) provider = "simulated";
        if (serviceFeeRate == null) serviceFeeRate = new BigDecimal("0.08");
        if (referenceTtl == null) referenceTtl = Duration.ofHours(24);
        if (simulated == null) simulated = new Simulated(null, false);
    }

    /**
     * @param entity      entidade Multicaixa mostrada ao utilizador
     * @param autoConfirm "Já paguei" confirma logo — só dev/demo, nunca em produção
     */
    public record Simulated(String entity, boolean autoConfirm) {
        public Simulated {
            if (entity == null) entity = "00000";
        }
    }
}
