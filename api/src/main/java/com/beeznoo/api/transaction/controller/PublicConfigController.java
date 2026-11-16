package com.beeznoo.api.transaction.controller;

import com.beeznoo.api.transaction.config.PaymentProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Duration;

/**
 * Configuração pública que o frontend precisa para mostrar valores iguais aos que a API cobra.
 * A taxa de serviço vem de PAYMENTS_SERVICE_FEE_RATE (app.payments.service-fee-rate); uma só fonte de verdade.
 */
@RestController
@RequestMapping("/api/v1/config")
@RequiredArgsConstructor
@Tag(name = "Configuração", description = "Valores públicos da plataforma")
public class PublicConfigController {

    private final PaymentProperties paymentProperties;

    public record PublicConfig(BigDecimal serviceFeeRate) {}

    @Operation(summary = "Configuração pública", description = """
            `serviceFeeRate`: taxa de serviço sobre o aluguer (0.08 = 8%), a mesma que entra no cálculo dos pagamentos.
            Endpoint público; pode ficar em cache 5 minutos.
            """)
    @GetMapping
    public ResponseEntity<PublicConfig> get() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(new PublicConfig(paymentProperties.serviceFeeRate()));
    }
}
