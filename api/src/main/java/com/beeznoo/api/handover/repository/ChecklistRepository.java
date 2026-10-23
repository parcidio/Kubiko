package com.beeznoo.api.handover.repository;

import com.beeznoo.api.handover.entity.Checklist;
import com.beeznoo.api.handover.entity.ChecklistType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChecklistRepository extends JpaRepository<Checklist, UUID> {

    Optional<Checklist> findByBookingIdAndType(UUID bookingId, ChecklistType type);

    List<Checklist> findByBookingIdOrderByCreatedAtAsc(UUID bookingId);
}
