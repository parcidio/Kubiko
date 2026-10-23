package com.beeznoo.api.contract.repository;

import com.beeznoo.api.contract.entity.Contract;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContractRepository extends JpaRepository<Contract, UUID> {

    Optional<Contract> findByBookingId(UUID bookingId);

    boolean existsByBookingIdAndRenterAcceptedAtIsNotNull(UUID bookingId);
}
