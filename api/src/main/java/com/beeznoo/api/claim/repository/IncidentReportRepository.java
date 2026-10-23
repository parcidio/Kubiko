package com.beeznoo.api.claim.repository;

import com.beeznoo.api.claim.entity.IncidentReport;
import com.beeznoo.api.claim.entity.IncidentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IncidentReportRepository extends JpaRepository<IncidentReport, UUID> {

    List<IncidentReport> findByBookingIdOrderByCreatedAtAsc(UUID bookingId);

    // Fila do admin: mais antigos primeiro
    @EntityGraph(attributePaths = {"booking", "booking.item", "reporter"})
    Page<IncidentReport> findByStatusOrderByCreatedAtAsc(IncidentStatus status, Pageable pageable);
}
