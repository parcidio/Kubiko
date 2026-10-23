package com.beeznoo.api.notification.repository;

import com.beeznoo.api.notification.entity.Notification;
import com.beeznoo.api.notification.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findTop50ByProfileIdOrderByCreatedAtDesc(UUID profileId);

    long countByProfileIdAndReadAtIsNull(UUID profileId);

    boolean existsByTypeAndBookingId(NotificationType type, UUID bookingId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Notification n SET n.readAt = :now WHERE n.profile.id = :profileId AND n.readAt IS NULL")
    int markAllRead(UUID profileId, OffsetDateTime now);
}
