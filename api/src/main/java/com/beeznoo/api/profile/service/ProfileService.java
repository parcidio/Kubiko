package com.beeznoo.api.profile.service;

import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.common.storage.StorageTransactions;
import com.beeznoo.api.common.storage.UploadedFiles;
import com.beeznoo.api.common.storage.UploadedFiles.ValidFile;
import com.beeznoo.api.common.util.Emails;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final ProfileRepository profileRepository;
    private final AccountRepository accountRepository;
    private final KycService kycService;
    private final StorageService storageService;
    private final AvatarUrls avatarUrls;

    @Transactional(readOnly = true)
    public MeResponse getMe(UUID profileId) {
        return toMe(findProfile(profileId));
    }

    /**
     * Foto de perfil (decisoes-produto.md 2026-11-18). Só JPEG/PNG até 5 MB, recodificada no servidor (sem EXIF).
     * O ficheiro novo apaga-se se a transação falhar; o antigo só depois do commit.
     */
    @Transactional
    public MeResponse uploadAvatar(UUID profileId, MultipartFile file) {
        Profile profile = findProfile(profileId);
        ValidFile valid = UploadedFiles.validate(file, "A foto", UploadedFiles.IMAGES);

        List<String> uploaded = StorageTransactions.deleteOnRollback(storageService);
        String key = storageService.upload("avatars/" + profileId, UUID.randomUUID() + "." + valid.extension(),
                valid.content(), valid.contentType());
        uploaded.add(key);

        String previous = profile.getAvatarStorageKey();
        profile.setAvatarStorageKey(key);
        if (previous != null) StorageTransactions.deleteAfterCommit(storageService, List.of(previous));
        return toMe(profile);
    }

    // Remove a foto enviada e também a do Google ("Remover" quer dizer ficar com as iniciais)
    @Transactional
    public MeResponse deleteAvatar(UUID profileId) {
        Profile profile = findProfile(profileId);
        String previous = profile.getAvatarStorageKey();
        profile.setAvatarStorageKey(null);
        profile.setAvatarUrl(null);
        if (previous != null) StorageTransactions.deleteAfterCommit(storageService, List.of(previous));
        return toMe(profile);
    }

    private MeResponse toMe(Profile profile) {
        UUID id = profile.getId();
        return MeResponse.from(profile, avatarUrls.of(profile), kycService.getMyStatus(id).status(), kycService.canTransact(id));
    }

    @Transactional
    public MeResponse updateMe(UUID profileId, UpdateMeRequest request) {
        Profile profile = findProfile(profileId);

        if (request.fullName() != null) {
            if (request.fullName().isBlank()) throw new IllegalArgumentException("O nome não pode ficar vazio");
            profile.setFullName(request.fullName().strip());
        }
        if (request.email() != null) {
            String email = Emails.normalize(request.email());
            if (email == null) {
                profile.setEmail(null);
                profile.setEmailVerifiedAt(null);
            } else if (!email.equalsIgnoreCase(profile.getEmail())) {
                if (profileRepository.existsByEmailIgnoreCase(email)) {
                    throw new IllegalStateException("Este email já está associado a outra conta");
                }
                profile.setEmail(email);
                profile.setEmailVerifiedAt(null);
            }
        }
        if (request.province() != null) profile.setProvince(blankToNull(request.province()));
        if (request.city() != null) profile.setCity(blankToNull(request.city()));

        return toMe(profile);
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
                .email(Emails.normalize(request.email()))
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

        profile = profileRepository.save(profile);
        return ProfileResponse.from(profile, avatarUrls.of(profile));
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(UUID id) {
        Profile profile = findProfile(id);
        return ProfileResponse.from(profile, avatarUrls.of(profile));
    }
}
