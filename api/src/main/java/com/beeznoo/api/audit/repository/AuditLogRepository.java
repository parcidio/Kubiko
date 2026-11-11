package com.beeznoo.api.audit.repository;

import com.beeznoo.api.audit.entity.AuditLog;
import com.beeznoo.api.audit.entity.AuditAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @EntityGraph(attributePaths = "actor")
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = "actor")
    Page<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, UUID entityId, Pageable pageable);

    List<AuditLog> findByEntityIdOrderByCreatedAtAsc(UUID entityId);

    // Filtros opcionais do ecrã de auditoria (null = todos). LEFT JOIN: ações do sistema não têm autor
    @Query(value = """
            SELECT a FROM AuditLog a LEFT JOIN FETCH a.actor act
            WHERE (:entityType IS NULL OR a.entityType = :entityType)
              AND (:entityId IS NULL OR a.entityId = :entityId)
              AND (:action IS NULL OR a.action = :action)
              AND (:actorId IS NULL OR act.id = :actorId)
            ORDER BY a.createdAt DESC
            """,
            countQuery = """
            SELECT COUNT(a) FROM AuditLog a LEFT JOIN a.actor act
            WHERE (:entityType IS NULL OR a.entityType = :entityType)
              AND (:entityId IS NULL OR a.entityId = :entityId)
              AND (:action IS NULL OR a.action = :action)
              AND (:actorId IS NULL OR act.id = :actorId)
            """)
    Page<AuditLog> search(String entityType, UUID entityId, AuditAction action, UUID actorId, Pageable pageable);
}
