package com.beeznoo.api.message.repository;

import com.beeznoo.api.message.entity.AdminMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AdminMessageRepository extends JpaRepository<AdminMessage, UUID> {

    Page<AdminMessage> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
