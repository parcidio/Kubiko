package com.beeznoo.api.transaction.repository;

import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findFirstByBookingIdOrderByCreatedAtDesc(UUID bookingId);

    Optional<Payment> findByBookingIdAndStatus(UUID bookingId, PaymentStatus status);

    boolean existsByEntityAndReference(String entity, String reference);
}
