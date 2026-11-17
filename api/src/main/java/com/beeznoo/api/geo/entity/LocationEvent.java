package com.beeznoo.api.geo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Localização enviada (arredondada a 2 casas, ~1 km). Append-only: trigger na BD bloqueia UPDATE e DELETE. */
@Entity
@Immutable
@Table(name = "location_events")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationEvent {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private LocationContext context;

    @Column(nullable = false, precision = 5, scale = 2, updatable = false)
    private BigDecimal lat;

    @Column(nullable = false, precision = 5, scale = 2, updatable = false)
    private BigDecimal lng;

    @Column(name = "in_area", nullable = false, updatable = false)
    private boolean inArea;

    @Column(name = "area_id", updatable = false)
    private UUID areaId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
