package com.beeznoo.api.profile.repository;

import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    Optional<Profile> findByPhone(String phone);

    Optional<Profile> findByEmail(String email);

    // Sem diferença de maiúsculas (contas antigas podem ter maiúsculas guardadas; índice em lower(email), V23)
    @org.springframework.data.jpa.repository.Query("SELECT p FROM Profile p WHERE lower(p.email) = lower(:email)")
    Optional<Profile> findByEmailIgnoreCase(String email);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(p) > 0 FROM Profile p WHERE lower(p.email) = lower(:email)")
    boolean existsByEmailIgnoreCase(String email);

    Optional<Profile> findByGoogleId(String googleId);

    boolean existsByPhone(String phone);

    List<Profile> findByRole(UserRole role);

    boolean existsByEmail(String email);

    boolean existsByGoogleId(String googleId);
}
