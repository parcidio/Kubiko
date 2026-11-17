package com.beeznoo.api.message.repository;

import com.beeznoo.api.message.entity.MessageTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageTemplateRepository extends JpaRepository<MessageTemplate, UUID> {

    // predefinidos primeiro, depois por nome
    List<MessageTemplate> findAllByOrderByPredefinedDescNameAsc();
}
