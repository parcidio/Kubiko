package com.beeznoo.api.transaction.repository;

import com.beeznoo.api.transaction.entity.Account;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByProfileId(UUID profileId);

    // SELECT ... FOR UPDATE — usar sempre que o saldo vai ser alterado
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdForUpdate(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.profile.id = :profileId")
    Optional<Account> findByProfileIdForUpdate(UUID profileId);
}
