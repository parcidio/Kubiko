package com.beeznoo.api.transaction.gateway;

import com.beeznoo.api.transaction.config.PaymentProperties;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.repository.PaymentRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Gateway falso para o MVP: gera referências de 9 dígitos e, com auto-confirm,
 * considera-as pagas na primeira verificação. Sem auto-confirm fica PENDING até o admin validar.
 */
@Component
@ConditionalOnProperty(prefix = "app.payments", name = "provider", havingValue = "simulated", matchIfMissing = true)
public class SimulatedPaymentGateway implements PaymentGateway {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final PaymentProperties properties;
    private final PaymentRepository paymentRepository;

    public SimulatedPaymentGateway(PaymentProperties properties, PaymentRepository paymentRepository) {
        this.properties = properties;
        this.paymentRepository = paymentRepository;
    }

    @Override
    public String provider() {
        return "SIMULATED";
    }

    @Override
    public IssuedReference issueReference(BigDecimal amount, OffsetDateTime expiresAt) {
        String entity = properties.simulated().entity();
        String reference;
        do {
            reference = String.format("%09d", RANDOM.nextInt(1_000_000_000));
        } while (paymentRepository.existsByEntityAndReference(entity, reference));
        return new IssuedReference(entity, reference);
    }

    @Override
    public GatewayStatus checkStatus(Payment payment) {
        return properties.simulated().autoConfirm()
                ? GatewayStatus.paid("SIM-" + UUID.randomUUID())
                : GatewayStatus.pending();
    }
}
