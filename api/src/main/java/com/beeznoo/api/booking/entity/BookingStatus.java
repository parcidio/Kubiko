package com.beeznoo.api.booking.entity;

public enum BookingStatus {
    PENDING_OWNER,      // arrendatário pediu, aguarda resposta do dono
    ACCEPTED,           // dono aceitou, aguarda pagamento
    CANCELLED_RENTER,   // arrendatário cancelou antes do dono responder
    CANCELLED_OWNER,    // dono recusou ou cancelou após aceitar
    ACTIVE,             // pagamento confirmado, equipamento em uso
    COMPLETED,          // devolvido com sucesso
    DISPUTED            // reclamação aberta
}
