package com.beeznoo.api.auth.repository;

import com.beeznoo.api.auth.entity.GooglePendingSignup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface GooglePendingSignupRepository extends JpaRepository<GooglePendingSignup, UUID> {
}
