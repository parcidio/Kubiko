package com.beeznoo.api.profile.service;

import com.beeznoo.api.profile.dto.CreateProfileRequest;
import com.beeznoo.api.profile.dto.ProfileResponse;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final ProfileRepository profileRepository;
    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public Optional<Profile> findByPhone(String phone) {
        return profileRepository.findByPhone(phone);
    }

    @Transactional
    public Profile createProfile(CreateProfileRequest request) {
        if (profileRepository.existsByPhone(request.phone())) {
            throw new IllegalStateException("Perfil já existe para este número");
        }

        Profile profile = Profile.builder()
                .phone(request.phone())
                .fullName(request.fullName())
                .email(request.email())
                .role(request.role())
                .build();

        profile = profileRepository.save(profile);

        accountRepository.save(Account.builder().profile(profile).build());

        return profile;
    }

    @Transactional
    public ProfileResponse linkGoogle(UUID profileId, String googleId, String email, String avatarUrl) {
        Profile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));

        if (profile.getGoogleId() != null) {
            throw new IllegalStateException("Conta Google já associada a este perfil");
        }
        if (googleId != null && profileRepository.existsByGoogleId(googleId)) {
            throw new IllegalStateException("Esta conta Google já está associada a outro perfil");
        }

        profile.setGoogleId(googleId);
        if (profile.getEmail() == null) profile.setEmail(email);
        if (profile.getAvatarUrl() == null) profile.setAvatarUrl(avatarUrl);

        return ProfileResponse.from(profileRepository.save(profile));
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(UUID id) {
        return ProfileResponse.from(
                profileRepository.findById(id)
                        .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"))
        );
    }
}
