package com.beeznoo.api.metrics.controller;

import com.beeznoo.api.metrics.dto.MetricsDtos.AdminMetrics;
import com.beeznoo.api.metrics.service.AdminMetricsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/metrics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Métricas", description = "North Star e funil do MVP")
public class AdminMetricsController {

    private final AdminMetricsService metricsService;

    @Operation(summary = "Painel de métricas", description = """
            Alugueres concluídos (North Star) este mês e no anterior; últimos 6 meses (concluídos, pagos, valor alugado,
            taxa de serviço; fuso de Luanda); funil dos pedidos dos últimos 30 dias; comissões por receber; fila e tempo
            médio de decisão do KYC; utilizadores e equipamento ativo. Valores em Kz inteiros. Sem dados pessoais. Apenas ADMIN.
            """)
    @GetMapping
    public ResponseEntity<AdminMetrics> get() {
        return ResponseEntity.ok(metricsService.get());
    }
}
