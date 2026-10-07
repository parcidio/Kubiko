package com.beeznoo.api.booking.repository;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.UUID;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    Page<Booking> findByRenterId(UUID renterId, Pageable pageable);

    Page<Booking> findByOwnerId(UUID ownerId, Pageable pageable);

    // end_date é o dia de devolução — dois períodos sobrepõem-se se start < outro.end e end > outro.start
    @Query("""
            SELECT COUNT(b) > 0 FROM Booking b
            WHERE b.item.id = :itemId
              AND b.status IN :statuses
              AND b.startDate < :endDate
              AND b.endDate > :startDate
            """)
    boolean existsOverlapping(UUID itemId, LocalDate startDate, LocalDate endDate,
                              Collection<BookingStatus> statuses);
}
