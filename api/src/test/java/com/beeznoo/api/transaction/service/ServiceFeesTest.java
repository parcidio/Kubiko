package com.beeznoo.api.transaction.service;

import com.beeznoo.api.transaction.config.PaymentProperties;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** Taxa de serviço configurável (PAYMENTS_SERVICE_FEE_RATE): valor e rótulo para o contrato. */
class ServiceFeesTest {

    private static ServiceFees fees(String rate) {
        return new ServiceFees(new PaymentProperties("direct", "simulated", new BigDecimal(rate), null, null));
    }

    @Test
    void rotuloDaTaxa() {
        assertThat(fees("0.08").rateLabel()).isEqualTo("8%");
        assertThat(fees("0.10").rateLabel()).isEqualTo("10%");
        assertThat(fees("0.075").rateLabel()).isEqualTo("7,5%");
    }

    @Test
    void valorEmKwanzasInteiros() {
        assertThat(fees("0.10").of(new BigDecimal("105000"))).isEqualByComparingTo("10500");
        assertThat(fees("0.075").of(new BigDecimal("15001"))).isEqualByComparingTo("1125"); // 1125,075 → 1125
    }
}
