package com.beeznoo.api.common.storage;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// StorageService em memória para os testes — não faz uploads reais
public class MockStorageService implements StorageService {

    public record StoredObject(byte[] content, String contentType) {}

    private final Map<String, StoredObject> objects = new ConcurrentHashMap<>();

    @Override
    public String upload(String folder, String filename, byte[] content, String contentType) {
        String key = folder + "/" + filename;
        objects.put(key, new StoredObject(content, contentType));
        return key;
    }

    @Override
    public String generateSignedUrl(String storageKey, Duration ttl) {
        if (!objects.containsKey(storageKey)) throw new IllegalStateException("Objecto inexistente");
        return "https://storage.test/" + storageKey + "?X-Amz-Expires=" + ttl.toSeconds() + "&X-Amz-Signature=test";
    }

    @Override
    public void delete(String storageKey) {
        objects.remove(storageKey);
    }

    public Map<String, StoredObject> objects() {
        return objects;
    }

    public void clear() {
        objects.clear();
    }
}
