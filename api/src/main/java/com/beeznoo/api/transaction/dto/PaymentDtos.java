package com.beeznoo.api.transaction.dto;

import com.beeznoo.api.transaction.entity.Payment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class PaymentDtos {

    // Linha da fila do admin: o pagamento + o que é preciso para o encontrar no extracto Multicaixa
    public record AdminPaymentItem(
            UUID id,
            UUID bookingId,
            String itemTitle,
            UUID renterId,
            String renterName,
            String entity,
            String reference,
            BigDecimal amount,
            String status,
            OffsetDateTime expiresAt,
            OffsetDateTime createdAt
    ) {
        public static AdminPaymentItem from(Payment p) {
            return new AdminPaymentItem(
                    p.getId(),
                    p.getBooking().getId(),
                    p.getBooking().getItem().getTitle(),
                    p.getRenter().getId(),
                    p.getRenter().getFullName(),
                    p.getEntity(),
                    p.getReference(),
                    p.getAmount(),
                    p.getStatus().name(),
                    p.getExpiresAt(),
                    p.getCreatedAt()
            );
        }
    }

    public record PaymentResponse(
            UUID id,
            UUID bookingId,
            String method,
            String entity,
            String reference,
            BigDecimal rentalAmount,
            BigDecimal serviceFee,
            BigDecimal depositAmount,
            BigDecimal amount,
            String status,
            OffsetDateTime expiresAt,
            OffsetDateTime confirmedAt
    ) {
        public static PaymentResponse from(Payment p) {
            return new PaymentResponse(
                    p.getId(),
                    p.getBooking().getId(),
                    p.getMethod().name(),
                    p.getEntity(),
                    p.getReference(),
                    p.getRentalAmount(),
                    p.getServiceFee(),
                    p.getDepositAmount(),
                    p.getAmount(),
                    p.getStatus().name(),
                    p.getExpiresAt(),
                    p.getConfirmedAt()
            );
        }
    }
}
