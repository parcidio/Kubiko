package com.beeznoo.api.profile.repository;

import com.beeznoo.api.profile.entity.Profile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    Optional<Profile> findByPhone(String phone);

    Optional<Profile> findByGoogleId(String googleId);

    boolean existsByPhone(String phone);

    boolean existsByEmail(String email);

    boolean existsByGoogleId(String googleId);
}
