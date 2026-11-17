package com.beeznoo.api.message.repository;

import com.beeznoo.api.message.entity.MessageDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MessageDeliveryRepository extends JpaRepository<MessageDelivery, UUID> {
}
