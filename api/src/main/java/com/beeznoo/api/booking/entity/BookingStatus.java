package com.beeznoo.api.booking.entity;

public enum BookingStatus {
    PENDING_OWNER,      // arrendatário pediu, aguarda resposta do dono
    ACCEPTED,           // dono aceitou, aguarda pagamento
    CANCELLED_RENTER,   // arrendatário cancelou antes do dono responder
    CANCELLED_OWNER,    // dono recusou ou cancelou após aceitar
    EXPIRED,            // pedido sem resposta do dono no prazo (24 h ou até ao dia de levantamento) — V22
    ACTIVE,             // pagamento confirmado, à espera da entrega
    IN_PROGRESS,        // entrega confirmada pelas duas partes, equipamento em uso
    RETURNED,           // devolução confirmada, à espera da decisão da caução
    COMPLETED,          // caução decidida (libertada ou retida)
    DISPUTED;           // reclamação aberta

    /**
     * Estados que ocupam as datas do equipamento (reserva aceite até a caução ser decidida). Pedidos pendentes não
     * ocupam: o dono escolhe entre pedidos sobrepostos. DISPUTED ocupa: o equipamento pode ainda estar com o
     * arrendatário. Ver claude/decisoes-produto.md (2026-11-11, gap #8).
     */
    public static final java.util.List<BookingStatus> OCCUPYING =
            java.util.List.of(ACCEPTED, ACTIVE, IN_PROGRESS, RETURNED, DISPUTED);
}
