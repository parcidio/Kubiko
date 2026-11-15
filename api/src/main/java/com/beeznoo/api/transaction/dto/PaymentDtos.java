package com.beeznoo.api.transaction.dto;

import com.beeznoo.api.transaction.entity.DirectChannel;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class PaymentDtos {

    // Linha da fila do admin: o pagamento + o que é preciso para o encontrar no extracto Multicaixa
    // (modo direct: meio usado, dono, comprovativo e se a comissão já foi recebida)
    public record AdminPaymentItem(
            UUID id,
            UUID bookingId,
            String itemTitle,
            UUID renterId,
            String renterName,
            String ownerName,
            String method,
            String channel,
            String entity,
            String reference,
            BigDecimal amount,
            BigDecimal serviceFee,
            String status,
            String receiptNumber,
            OffsetDateTime expiresAt,
            OffsetDateTime confirmedAt,
            OffsetDateTime commissionSettledAt,
            OffsetDateTime createdAt
    ) {
        public static AdminPaymentItem from(Payment p) {
            boolean direct = p.getMethod() == PaymentMethod.DIRECT;
            return new AdminPaymentItem(
                    p.getId(),
                    p.getBooking().getId(),
                    p.getBooking().getItem().getTitle(),
                    p.getRenter().getId(),
                    p.getRenter().getFullName(),
                    p.getBooking().getOwner().getFullName(),
                    p.getMethod().name(),
                    direct ? p.getProvider() : null,
                    p.getEntity(),
                    p.getReference(),
                    p.getAmount(),
                    p.getServiceFee(),
                    p.getStatus().name(),
                    p.getReceiptNumber(),
                    p.getExpiresAt(),
                    p.getConfirmedAt(),
                    p.getCommissionSettledAt(),
                    p.getCreatedAt()
            );
        }
    }

    // Dono confirma que recebeu o pagamento na entrega
    public record DirectPaymentRequest(@NotNull DirectChannel channel) {}

    // Admin › Comissões: o que cada dono deve à Beeznoo (taxa de serviço dos pagamentos diretos)
    public record CommissionDue(
            UUID ownerId,
            String ownerName,
            String ownerPhone,
            int payments,
            BigDecimal amount,
            OffsetDateTime oldestConfirmedAt
    ) {}

    public record CommissionLine(
            UUID paymentId,
            UUID bookingId,
            String itemTitle,
            String receiptNumber,
            String channel,
            BigDecimal amountReceived,
            BigDecimal rentalAmount,
            BigDecimal serviceFee,
            OffsetDateTime confirmedAt,
            OffsetDateTime commissionSettledAt
    ) {
        public static CommissionLine from(Payment p) {
            return new CommissionLine(p.getId(), p.getBooking().getId(), p.getBooking().getItem().getTitle(),
                    p.getReceiptNumber(), p.getProvider(), p.getAmount(), p.getRentalAmount(), p.getServiceFee(), p.getConfirmedAt(),
                    p.getCommissionSettledAt());
        }
    }

    // Carteira do dono (modo direct)
    public record MyCommissions(BigDecimal due, List<CommissionLine> lines) {}

    public record SettleCommissionsRequest(@Size(max = 500) String reason) {}

    public record SettleCommissionsResponse(UUID ownerId, int payments, BigDecimal amount) {}

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
            OffsetDateTime confirmedAt,
            // preenchido quando CONFIRMED: há comprovativo em GET /payments/{id}/receipt
            String receiptNumber,
            // modo direct: meio usado (CASH, TRANSFER, MULTICAIXA_EXPRESS)
            String channel
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
                    p.getConfirmedAt(),
                    p.getReceiptNumber(),
                    p.getMethod() == PaymentMethod.DIRECT ? p.getProvider() : null
            );
        }
    }
}
