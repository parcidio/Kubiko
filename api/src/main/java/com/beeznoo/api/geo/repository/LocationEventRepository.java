package com.beeznoo.api.geo.repository;

import com.beeznoo.api.geo.entity.LocationContext;
import com.beeznoo.api.geo.entity.LocationEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LocationEventRepository extends JpaRepository<LocationEvent, UUID> {

    List<LocationEvent> findByUserIdAndContextOrderByCreatedAtDesc(UUID userId, LocationContext context);
}
