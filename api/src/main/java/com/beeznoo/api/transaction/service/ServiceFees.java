package com.beeznoo.api.transaction.service;

import com.beeznoo.api.transaction.config.PaymentProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

// Taxa de serviço Beeznoo (8% por omissão), arredondada ao kwanza. Usada no pagamento e no contrato.
@Component
public class ServiceFees {

    private final PaymentProperties properties;

    public ServiceFees(PaymentProperties properties) {
        this.properties = properties;
    }

    public BigDecimal of(BigDecimal rental) {
        return rental.multiply(properties.serviceFeeRate()).setScale(0, RoundingMode.HALF_UP).setScale(2);
    }

    /** "8%" / "10%" / "7,5%" — a taxa em vigor, para textos (contrato). Vírgula decimal (PT). */
    public String rateLabel() {
        BigDecimal pct = properties.serviceFeeRate().multiply(BigDecimal.valueOf(100)).stripTrailingZeros();
        if (pct.scale() < 0) pct = pct.setScale(0);
        return pct.toPlainString().replace('.', ',') + "%";
    }
}
