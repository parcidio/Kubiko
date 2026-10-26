package com.beeznoo.api.common.storage;

import java.time.Duration;

/**
 * Storage privado de ficheiros (documentos KYC). Devolve sempre a storage_key, nunca uma URL pública.
 * A storage_key não pode aparecer em DTOs nem em logs (CLAUDE.md §6).
 */
public interface StorageService {

    // Devolve a storage_key: folder + "/" + filename
    String upload(String folder, String filename, byte[] content, String contentType);

    // URL pré-assinada de leitura, válida durante ttl
    String generateSignedUrl(String storageKey, Duration ttl);

    void delete(String storageKey);
}
