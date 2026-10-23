package com.beeznoo.api.item.service;

import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.common.storage.StorageTransactions;
import com.beeznoo.api.common.storage.UploadedFiles;
import com.beeznoo.api.common.storage.UploadedFiles.ValidFile;
import com.beeznoo.api.item.dto.ItemDtos.PhotoResponse;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemPhoto;
import com.beeznoo.api.item.repository.ItemRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Fotos do equipamento no bucket privado (items/{itemId}/{uuid}.{ext}). Ver claude/decisoes-produto.md (2026-10-23).
 * O frontend comprime antes de enviar; aqui só se valida tipo (JPEG/PNG) e tamanho (5 MB).
 */
@Service
@Transactional
public class ItemPhotoService {

    static final int MAX_PHOTOS = 8;

    private final ItemRepository itemRepository;
    private final StorageService storageService;
    private final PhotoUrls photoUrls;

    public ItemPhotoService(ItemRepository itemRepository, StorageService storageService, PhotoUrls photoUrls) {
        this.itemRepository = itemRepository;
        this.storageService = storageService;
        this.photoUrls = photoUrls;
    }

    // Acrescenta no fim; a primeira foto é a capa
    public List<PhotoResponse> upload(UUID ownerId, UUID itemId, List<MultipartFile> files) {
        Item item = findOwnedItem(ownerId, itemId);
        if (files == null || files.isEmpty()) throw new IllegalArgumentException("Envia pelo menos uma foto");
        if (item.getPhotos().size() + files.size() > MAX_PHOTOS) {
            throw new IllegalArgumentException("Máximo de " + MAX_PHOTOS + " fotos por equipamento");
        }

        List<ValidFile> valid = new java.util.ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            valid.add(UploadedFiles.validate(files.get(i), "A foto " + (i + 1), UploadedFiles.IMAGES));
        }

        List<String> uploaded = StorageTransactions.deleteOnRollback(storageService);
        int position = item.getPhotos().stream().mapToInt(ItemPhoto::getPosition).max().orElse(-1) + 1;
        for (ValidFile file : valid) {
            String key = storageService.upload("items/" + itemId, UUID.randomUUID() + "." + file.extension(),
                    file.content(), file.contentType());
            uploaded.add(key);
            item.getPhotos().add(ItemPhoto.builder()
                    .item(item)
                    .storageKey(key)
                    .contentType(file.contentType())
                    .sizeBytes((long) file.content().length)
                    .position(position++)
                    .build());
        }
        itemRepository.flush();
        return toResponses(item);
    }

    // Remove da BD já e do storage só depois do commit
    public List<PhotoResponse> delete(UUID ownerId, UUID itemId, UUID photoId) {
        Item item = findOwnedItem(ownerId, itemId);
        ItemPhoto photo = item.getPhotos().stream()
                .filter(p -> p.getId().equals(photoId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Foto não encontrada"));
        item.getPhotos().remove(photo);
        if (photo.getStorageKey() != null) {
            StorageTransactions.deleteAfterCommit(storageService, List.of(photo.getStorageKey()));
        }
        return toResponses(item);
    }

    private Item findOwnedItem(UUID ownerId, UUID itemId) {
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        if (!item.getOwner().getId().equals(ownerId)) {
            throw new AccessDeniedException("Só o dono pode mudar as fotos deste equipamento");
        }
        return item;
    }

    private List<PhotoResponse> toResponses(Item item) {
        return item.getPhotos().stream()
                .map(p -> new PhotoResponse(p.getId(), photoUrls.of(p), p.getPosition()))
                .toList();
    }
}
