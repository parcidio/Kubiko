package com.beeznoo.api.kyc;

import com.beeznoo.api.kyc.service.KycService;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatNoException;

/** Com KYC_REQUIRED=false o gate não consulta a BD nem bloqueia (o caso true está em ItemServiceIntegrationTest). */
class KycGateTest {

    @Test
    void gateDesligado_deixaPublicarEReservar() {
        KycService service = new KycService(null, null, null, null, null, null, null, false);
        assertThatNoException().isThrownBy(() -> service.assertCanTransact(UUID.randomUUID()));
    }
}
