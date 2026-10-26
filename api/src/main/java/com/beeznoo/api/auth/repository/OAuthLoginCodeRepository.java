package com.beeznoo.api.auth.repository;

import com.beeznoo.api.auth.entity.OAuthLoginCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface OAuthLoginCodeRepository extends JpaRepository<OAuthLoginCode, UUID> {

    // FOR UPDATE: dois pedidos com o mesmo código não trocam os dois
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM OAuthLoginCode c WHERE c.codeHash = :codeHash")
    Optional<OAuthLoginCode> findByCodeHashForUpdate(String codeHash);

    @Modifying
    @Query("DELETE FROM OAuthLoginCode c WHERE c.expiresAt < :before")
    int deleteExpiredBefore(OffsetDateTime before);
}
