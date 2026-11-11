package com.beeznoo.api.item.repository;

import com.beeznoo.api.item.entity.AvailabilityBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AvailabilityBlockRepository extends JpaRepository<AvailabilityBlock, UUID> {

    /** Algum bloqueio [start, end] (inclusivo) toca o período de reserva [startDate, endDate) (fim exclusivo)? */
    @Query("""
            SELECT COUNT(a) > 0 FROM AvailabilityBlock a
            WHERE a.item.id = :itemId AND a.startDate < :endDate AND a.endDate >= :startDate
            """)
    boolean existsOverlapping(UUID itemId, LocalDate startDate, LocalDate endDate);

    /** Bloqueios que tocam a janela [from, to] (ambos inclusivos). */
    @Query("""
            SELECT a FROM AvailabilityBlock a
            WHERE a.item.id = :itemId AND a.startDate <= :to AND a.endDate >= :from
            ORDER BY a.startDate
            """)
    List<AvailabilityBlock> findInWindow(UUID itemId, LocalDate from, LocalDate to);

    List<AvailabilityBlock> findByItemIdAndEndDateGreaterThanEqualOrderByStartDateAsc(UUID itemId, LocalDate from);

    long countByItemIdAndEndDateGreaterThanEqual(UUID itemId, LocalDate from);

    Optional<AvailabilityBlock> findByIdAndItemId(UUID id, UUID itemId);
}
