package com.beeznoo.api.transaction.repository;

import com.beeznoo.api.transaction.entity.EntryType;
import com.beeznoo.api.transaction.entity.LedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {

    Page<LedgerEntry> findByAccountIdOrderByCreatedAtDesc(UUID accountId, Pageable pageable);

    // usado para saber se uma reserva já tem hold/pagamento registado (ex.: cancel só liberta se houve hold)
    boolean existsByBookingIdAndType(UUID bookingId, EntryType type);
}
