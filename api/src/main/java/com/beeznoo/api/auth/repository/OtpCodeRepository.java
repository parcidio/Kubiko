package com.beeznoo.api.auth.repository;

import com.beeznoo.api.auth.entity.OtpCode;
import com.beeznoo.api.auth.entity.OtpCode.Purpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface OtpCodeRepository extends JpaRepository<OtpCode, UUID> {

    @Query("""
        SELECT o FROM OtpCode o 
        WHERE o.phone = :phone
            AND o.usedAt IS NULL
            AND o.expiresAt > CURRENT_TIMESTAMP
        ORDER BY o.createdAt DESC
        LIMIT 1
""")
    Optional<OtpCode> findLatestValidByPhone(String phone);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE OtpCode o SET o.usedAt = CURRENT_TIMESTAMP WHERE o.phone = :phone AND o.purpose =:purpose AND o.usedAt IS NULL")
    void invalidateAllForPhone(@org.springframework.data.repository.query.Param("phone") String phone, @org.springframework.data.repository.query.Param("purpose") Purpose purpose);

    @Query("""
        SELECT o FROM OtpCode o 
        WHERE o.phone = :phone
            AND o.purpose = :purpose
            AND o.usedAt IS NULL
            AND o.expiresAt > CURRENT_TIMESTAMP
        ORDER BY o.createdAt DESC
        LIMIT 1
""")
    Optional<OtpCode> findLatestValid(@org.springframework.data.repository.query.Param("phone") String phone, @org.springframework.data.repository.query.Param("purpose") Purpose purpose);
}
