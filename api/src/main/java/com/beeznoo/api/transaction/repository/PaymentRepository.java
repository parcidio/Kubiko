package com.beeznoo.api.transaction.repository;

import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findFirstByBookingIdOrderByCreatedAtDesc(UUID bookingId);

    Optional<Payment> findByBookingIdAndStatus(UUID bookingId, PaymentStatus status);

    boolean existsByEntityAndReference(String entity, String reference);

    // Fila do admin: mais antigos primeiro
    @EntityGraph(attributePaths = {"booking", "booking.item", "booking.owner", "renter"})
    Page<Payment> findByStatusOrderByCreatedAtAsc(PaymentStatus status, Pageable pageable);

    // Confirmados: mais recentes primeiro (modo direct, 2026-11-15)
    @EntityGraph(attributePaths = {"booking", "booking.item", "booking.owner", "renter"})
    Page<Payment> findByStatusOrderByCreatedAtDesc(PaymentStatus status, Pageable pageable);

    boolean existsByBookingIdAndStatus(UUID bookingId, PaymentStatus status);

    // Comissões (taxa de serviço) por receber dos donos, mais antigas primeiro
    @Query("""
            SELECT p FROM Payment p JOIN FETCH p.booking b JOIN FETCH b.owner JOIN FETCH b.item
            WHERE p.method = com.beeznoo.api.transaction.entity.PaymentMethod.DIRECT
              AND p.status = com.beeznoo.api.transaction.entity.PaymentStatus.CONFIRMED
              AND p.commissionSettledAt IS NULL
            ORDER BY p.confirmedAt ASC""")
    List<Payment> findCommissionsDue();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT p FROM Payment p
            WHERE p.booking.owner.id = :ownerId
              AND p.method = com.beeznoo.api.transaction.entity.PaymentMethod.DIRECT
              AND p.status = com.beeznoo.api.transaction.entity.PaymentStatus.CONFIRMED
              AND p.commissionSettledAt IS NULL
            ORDER BY p.confirmedAt ASC""")
    List<Payment> findCommissionsDueForUpdate(UUID ownerId);

    @Query("""
            SELECT COALESCE(SUM(p.serviceFee), 0) FROM Payment p
            WHERE p.booking.owner.id = :ownerId
              AND p.method = com.beeznoo.api.transaction.entity.PaymentMethod.DIRECT
              AND p.status = com.beeznoo.api.transaction.entity.PaymentStatus.CONFIRMED
              AND p.commissionSettledAt IS NULL""")
    java.math.BigDecimal sumCommissionDue(UUID ownerId);

    // Carteira do dono: pagamentos diretos que recebeu (recentes primeiro)
    @Query("""
            SELECT p FROM Payment p JOIN FETCH p.booking b JOIN FETCH b.item
            WHERE b.owner.id = :ownerId
              AND p.method = com.beeznoo.api.transaction.entity.PaymentMethod.DIRECT
              AND p.status = com.beeznoo.api.transaction.entity.PaymentStatus.CONFIRMED
            ORDER BY p.confirmedAt DESC""")
    List<Payment> findDirectReceivedBy(UUID ownerId, Pageable pageable);

    // SELECT ... FOR UPDATE — usar sempre que o estado do pagamento vai mudar
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.id = :id")
    Optional<Payment> findByIdForUpdate(UUID id);

    // Número do comprovativo (V19). Uma sequência nunca devolve o mesmo valor, mesmo com rollback
    @Query(value = "SELECT nextval('payment_receipt_seq')", nativeQuery = true)
    long nextReceiptSequence();

    @Query("SELECT p.id FROM Payment p WHERE p.status = :status AND p.expiresAt < :now")
    List<UUID> findIdsByStatusAndExpiresAtBefore(PaymentStatus status, OffsetDateTime now);
}
