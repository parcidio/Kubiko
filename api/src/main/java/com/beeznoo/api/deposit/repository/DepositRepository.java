package com.beeznoo.api.deposit.repository;

import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.deposit.entity.Deposit;
import com.beeznoo.api.deposit.entity.DepositStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface DepositRepository extends JpaRepository<Deposit, UUID> {

    Optional<Deposit> findByBookingId(UUID bookingId);

    // SELECT ... FOR UPDATE — dois admins não decidem a mesma caução
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM Deposit d WHERE d.booking.id = :bookingId")
    Optional<Deposit> findByBookingIdForUpdate(UUID bookingId);

    // Fila do admin: cauções retidas de reservas devolvidas ou em disputa, mais antigas primeiro
    @Query("""
            SELECT d FROM Deposit d JOIN FETCH d.booking b JOIN FETCH b.item JOIN FETCH b.renter JOIN FETCH b.owner
            WHERE d.status = :status AND b.status IN :bookingStatuses ORDER BY d.heldAt ASC""")
    Page<Deposit> findQueue(DepositStatus status, Collection<BookingStatus> bookingStatuses, Pageable pageable);
}
