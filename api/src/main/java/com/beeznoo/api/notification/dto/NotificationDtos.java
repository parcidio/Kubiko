package com.beeznoo.api.notification.dto;

import com.beeznoo.api.notification.entity.Notification;

import java.time.OffsetDateTime;
import java.util.UUID;

// Sem estado nem erro do email: isso é operacional, não é para o utilizador
public class NotificationDtos {

    public record NotificationResponse(
            UUID id,
            String type,
            String title,
            String body,
            String linkPath,
            UUID bookingId,
            OffsetDateTime readAt,
            OffsetDateTime createdAt
    ) {
        public static NotificationResponse from(Notification n) {
            return new NotificationResponse(
                    n.getId(),
                    n.getType().name(),
                    n.getTitle(),
                    n.getBody(),
                    n.getLinkPath(),
                    n.getBooking() == null ? null : n.getBooking().getId(),
                    n.getReadAt(),
                    n.getCreatedAt()
            );
        }
    }

    public record UnreadCountResponse(long unread) {}

    public record MarkAllReadResponse(int updated) {}
}
