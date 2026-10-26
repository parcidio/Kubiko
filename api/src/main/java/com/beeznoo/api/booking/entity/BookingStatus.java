package com.beeznoo.api.booking.entity;

public enum BookingStatus {
    PENDING_OWNER,      // arrendatário pediu, aguarda resposta do dono
    ACCEPTED,           // dono aceitou, aguarda pagamento
    CANCELLED_RENTER,   // arrendatário cancelou antes do dono responder
    CANCELLED_OWNER,    // dono recusou ou cancelou após aceitar
    ACTIVE,             // pagamento confirmado, à espera da entrega
    IN_PROGRESS,        // entrega confirmada pelas duas partes, equipamento em uso
    RETURNED,           // devolução confirmada, à espera da decisão da caução
    COMPLETED,          // caução decidida (libertada ou retida)
    DISPUTED            // reclamação aberta
}
