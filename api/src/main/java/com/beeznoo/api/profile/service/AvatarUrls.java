package com.beeznoo.api.profile.service;

import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.profile.entity.Profile;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * URL da foto de perfil que sai nos DTOs: assinada e de curta duração quando a pessoa enviou uma foto
 * (storage privado), senão a foto do Google (externa), senão null (o frontend mostra as iniciais).
 * A storage_key nunca sai daqui.
 */
@Component
public class AvatarUrls {

    // Curta, mas cobre a cache de 5 min da página pública do equipamento (item-server.ts)
    static final Duration TTL = Duration.ofHours(1);

    private final StorageService storageService;

    public AvatarUrls(StorageService storageService) {
        this.storageService = storageService;
    }

    public String of(Profile profile) {
        if (profile == null) return null;
        return of(profile.getAvatarStorageKey(), profile.getAvatarUrl());
    }

    public String of(String storageKey, String externalUrl) {
        return storageKey != null ? storageService.generateSignedUrl(storageKey, TTL) : externalUrl;
    }
}
