package com.beeznoo.api.profile.service;

import com.beeznoo.api.kyc.service.KycService;
import com.beeznoo.api.profile.dto.CreateProfileRequest;
import com.beeznoo.api.profile.dto.MeDtos.MeResponse;
import com.beeznoo.api.profile.dto.MeDtos.UpdateMeRequest;
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
    private final KycService kycService;

    @Transactional(readOnly = true)
    public MeResponse getMe(UUID profileId) {
        return MeResponse.from(findProfile(profileId), kycService.getMyStatus(profileId).status());
    }

    @Transactional
    public MeResponse updateMe(UUID profileId, UpdateMeRequest request) {
        Profile profile = findProfile(profileId);

        if (request.fullName() != null) {
            if (request.fullName().isBlank()) throw new IllegalArgumentException("O nome não pode ficar vazio");
            profile.setFullName(request.fullName().strip());
        }
        if (request.email() != null) {
            String email = request.email().strip().toLowerCase();
            if (email.isEmpty()) {
                profile.setEmail(null);
                profile.setEmailVerifiedAt(null);
            } else if (!email.equalsIgnoreCase(profile.getEmail())) {
                if (profileRepository.existsByEmail(email)) {
                    throw new IllegalStateException("Este email já está associado a outra conta");
                }
                profile.setEmail(email);
                profile.setEmailVerifiedAt(null);
            }
        }
        if (request.province() != null) profile.setProvince(blankToNull(request.province()));
        if (request.city() != null) profile.setCity(blankToNull(request.city()));

        return MeResponse.from(profile, kycService.getMyStatus(profileId).status());
    }

    private Profile findProfile(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
    }

    private static String blankToNull(String value) {
        return value.isBlank() ? null : value.strip();
    }

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
                .passwordHash("")
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
