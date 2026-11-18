package com.beeznoo.api.metrics.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** Painel de métricas do admin (decisoes-produto.md 2026-11-15). Valores em Kz inteiros. */
public final class MetricsDtos {

    private MetricsDtos() {}

    public record AdminMetrics(
            OffsetDateTime generatedAt,
            NorthStar northStar,
            List<MonthPoint> months,
            Funnel funnel30d,
            Commissions commissions,
            Kyc kyc,
            Marketplace marketplace,
            Queues queues
    ) {}

    /**
     * Trabalho em aberto para a equipa (decisoes-produto.md 2026-11-18), visível a qualquer papel na Visão geral.
     * awaitingOwner: pedidos à espera do dono · inProgress: pagas ou com o equipamento entregue · disputed: em
     * disputa · openIncidents: problemas por resolver · suspendedAccounts: contas suspensas.
     */
    public record Queues(long awaitingOwner, long inProgress, long disputed, long openIncidents, long suspendedAccounts) {}

    /** Alugueres concluídos: este mês e o anterior (para a variação). */
    public record NorthStar(long completedThisMonth, long completedLastMonth) {}

    /** Um mês (YYYY-MM, fuso de Luanda): concluídos, pagos, valor alugado e taxa de serviço. */
    public record MonthPoint(String month, long completed, long paid, BigDecimal rentalValue, BigDecimal serviceFee) {}

    /** Pedidos dos últimos 30 dias pelo estado atual. */
    public record Funnel(long requested, long accepted, long paid, long completed, long lost, long pending) {}

    public record Commissions(BigDecimal earnedThisMonth, BigDecimal pendingTotal, long pendingOwners) {}

    /** avgDecisionHours: null se não houve decisões nos últimos 30 dias. */
    public record Kyc(long pending, Double avgDecisionHours, long decided30d) {}

    public record Marketplace(long users, long newUsers30d, long verifiedUsers, long activeItems, long ownersWithItems) {}
}
