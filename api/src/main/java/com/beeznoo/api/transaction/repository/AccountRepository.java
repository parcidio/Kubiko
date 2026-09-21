package com.beeznoo.api.transaction.repository;

import com.beeznoo.api.transaction.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByProfileId(UUID profileId);
}
