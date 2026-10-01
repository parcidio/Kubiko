package com.beeznoo.api.item.service;

import com.beeznoo.api.item.dto.ItemDtos.*;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ItemService {

    private final ItemRepository itemRepository;
    private final CategoryRepository categoryRepository;
    private final ProfileRepository profileRepository;

    public ItemService(ItemRepository itemRepository, CategoryRepository categoryRepository, ProfileRepository profileRepository) {
        this.itemRepository = itemRepository;
        this.categoryRepository = categoryRepository;
        this.profileRepository = profileRepository;
    }

    public ItemResponse publish(UUID ownerId, PublishItemRequest request) throws AccessDeniedException {
        Profile owner = profileRepository.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));

        if (!canPublish(owner.getRole())) {
            throw new AccessDeniedException("Apenas OWNER ou BOTH podem publicar itens");
        }

        Category category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Categoria não encontrada"));

        Item item = Item.builder()
                .owner(owner)
                .category(category)
                .title(request.title())
                .description(request.description())
                .condition(request.itemCondition())
                .pricePerDay(request.pricePerDay())
                .depositAmount(request.depositAmount())
                .province(request.province())
                .city(request.city())
                .build();

        itemRepository.save(item);
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public ItemResponse getById(UUID itemId) {
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));

        return  toResponse(item);
    }

    @Transactional(readOnly = true)
    public Page<ItemSummaryResponse> listActive(UUID categoryId, Pageable pageable) {
        Page<Item> page =categoryId != null
                ? itemRepository.findByCategoryIdAndStatus(categoryId, ItemStatus.ACTIVE, pageable)
                : itemRepository.findByStatus(ItemStatus.ACTIVE, pageable);
        return page.map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public Page<ItemSummaryResponse> listMyItems(UUID ownerId, Pageable pageable) {
        return itemRepository.findByOwnerIdAndStatusNot(ownerId, ItemStatus.DELETED, pageable)
                .map(this::toSummary);
    }

    public ItemResponse update(UUID requesterId, UUID itemId, UpdateItemRequest request) throws AccessDeniedException {
        Item item = itemRepository.findActiveById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));

        assertOwner(requesterId, item);

        if (request.title() != null) item.setTitle(request.title());
        if (request.description() != null) item.setDescription(request.description());
        if (request.condition() != null)  item.setCondition(request.condition());
        if (request.pricePerDay() != null) item.setPricePerDay(request.pricePerDay());
        if (request.depositAmount() != null) item.setDepositAmount(request.depositAmount());
        if (request.province() != null) item.setProvince(request.province());
        if (request.city() != null) item.setCity(request.city());
        if (request.categoryId() != null) {
            Category category = categoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Categoria não encontrada"));
            item.setCategory(category);
        }

        return toResponse(item);
    }

    public void deactivate(UUID requesterId, UUID itemId) throws AccessDeniedException {
        Item item = itemRepository.findActiveById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        assertOwner(requesterId, item);
        item.deactivate();
    }

    public void delete(UUID requesterId, UUID itemId) throws AccessDeniedException {
        Item item = itemRepository.findActiveById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        assertOwner(requesterId, item);
        item.softDelete();
    }

    private boolean canPublish(UserRole role) {
        return role == UserRole.OWNER || role == UserRole.BOTH;
    }

    private void assertOwner(UUID requesterId,Item item) throws AccessDeniedException {
        if (!item.getOwner().getId().equals(requesterId)) {
            throw new AccessDeniedException("Sem permissão para modificar este item");
        }
    }

    private CategoryResponse toCategoryResponse(Category category) {
        return new CategoryResponse(
                category.getId(), category.getName(), category.getSlug(), category.getIconUrl(),
                category.getParent() != null ? category.getParent().getId() : null
        );
    }

    private ItemResponse toResponse(Item item) {
        List<PhotoResponse> photos = item.getPhotos().stream()
                .map(p -> new PhotoResponse(p.getId(), p.getPhotoUrl(), p.getPosition()))
                .toList();

        return new ItemResponse(
                item.getId(),
                item.getOwner().getId(),
                item.getOwner().getFullName(),
                toCategoryResponse(item.getCategory()),
                item.getTitle(),
                item.getDescription(),
                item.getCondition().name(),
                item.getPricePerDay(),
                item.getDepositAmount(),
                item.getProvince(),
                item.getCity(),
                item.getStatus().name(),
                item.getViewCount(),
                photos,
                item.getUpdatedAt(),
                item.getUpdatedAt()
        );
    }

    private ItemSummaryResponse toSummary(Item item) {
        String cover = item.getPhotos().isEmpty() ? null : item.getPhotos().get(0).getPhotoUrl();
        return new ItemSummaryResponse(
                item.getId(),
                item.getTitle(),
                item.getCondition().name(),
                item.getPricePerDay(),
                item.getProvince(),
                item.getCity(),
                item.getStatus().name(),
                cover,
                item.getCreatedAt()
        );
    }
}
