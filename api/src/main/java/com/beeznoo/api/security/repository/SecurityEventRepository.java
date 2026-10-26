package com.beeznoo.api.security.repository;

import com.beeznoo.api.security.entity.SecurityEvent;
import com.beeznoo.api.security.entity.SecurityEventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SecurityEventRepository extends JpaRepository<SecurityEvent, UUID> {

    Page<SecurityEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<SecurityEvent> findBySeverityOrderByCreatedAtDesc(SecurityEventType.Severity severity, Pageable pageable);

    List<SecurityEvent> findByTypeOrderByCreatedAtDesc(SecurityEventType type);
}
