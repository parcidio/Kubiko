package com.beeznoo.api.item.service;

import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.item.entity.ItemPhoto;
import org.springframework.stereotype.Component;

import java.time.Duration;

// URL que o frontend usa para mostrar uma foto: assinada (storage privado) ou a URL externa antiga
@Component
public class PhotoUrls {

    static final Duration TTL = Duration.ofHours(12);

    private final StorageService storageService;

    public PhotoUrls(StorageService storageService) {
        this.storageService = storageService;
    }

    public String of(ItemPhoto photo) {
        if (photo == null) return null;
        return photo.getStorageKey() != null
                ? storageService.generateSignedUrl(photo.getStorageKey(), TTL)
                : photo.getPhotoUrl();
    }
}
