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
    @EntityGraph(attributePaths = {"booking", "booking.item", "renter"})
    Page<Payment> findByStatusOrderByCreatedAtAsc(PaymentStatus status, Pageable pageable);

    // SELECT ... FOR UPDATE — usar sempre que o estado do pagamento vai mudar
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.id = :id")
    Optional<Payment> findByIdForUpdate(UUID id);

    @Query("SELECT p.id FROM Payment p WHERE p.status = :status AND p.expiresAt < :now")
    List<UUID> findIdsByStatusAndExpiresAtBefore(PaymentStatus status, OffsetDateTime now);
}
