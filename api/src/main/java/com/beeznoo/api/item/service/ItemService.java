package com.beeznoo.api.item.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.item.dto.ItemDtos.*;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.kyc.service.KycService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.review.dto.ReviewDtos.RatingSummary;
import com.beeznoo.api.review.service.ReviewService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.access.AccessDeniedException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class ItemService {

    private final ItemRepository itemRepository;
    private final CategoryRepository categoryRepository;
    private final ProfileRepository profileRepository;
    private final KycService kycService;
    private final PhotoUrls photoUrls;
    private final ReviewService reviewService;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;

    public ItemService(ItemRepository itemRepository, CategoryRepository categoryRepository,
                       ProfileRepository profileRepository, KycService kycService, PhotoUrls photoUrls,
                       ReviewService reviewService, BookingRepository bookingRepository, AuditService auditService) {
        this.itemRepository = itemRepository;
        this.categoryRepository = categoryRepository;
        this.profileRepository = profileRepository;
        this.kycService = kycService;
        this.photoUrls = photoUrls;
        this.reviewService = reviewService;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
    }

    public ItemResponse publish(UUID ownerId, PublishItemRequest request) throws AccessDeniedException {
        Profile owner = profileRepository.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));

        if (!canPublish(owner.getRole())) {
            throw new AccessDeniedException("Apenas OWNER ou BOTH podem publicar itens");
        }
        if (!kycService.isVerified(ownerId)) {
            throw new AccessDeniedException("Verifica a tua identidade antes de continuar");
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
        // itens apagados não se mostram a ninguém, nem por id
        Item item = itemRepository.findById(itemId)
                .filter(i -> i.getStatus() != ItemStatus.DELETED)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));

        return  toResponse(item);
    }

    @Transactional(readOnly = true)
    public Page<ItemSummaryResponse> listActive(UUID categoryId, Pageable pageable) {
        return listActive(categoryId, false, ItemOrder.RECENT, pageable);
    }

    // A ordem vem do enum, não do Pageable (o cliente não escolhe colunas para ordenar)
    @Transactional(readOnly = true)
    public Page<ItemSummaryResponse> listActive(UUID categoryId, boolean featured, ItemOrder order, Pageable pageable) {
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<Item> page = switch (order) {
            case POPULAR -> itemRepository.findPublicPopular(categoryId, featured, unsorted);
            case RATING -> itemRepository.findPublicByRating(categoryId, featured, unsorted);
            case RECENT -> itemRepository.findPublicRecent(categoryId, featured, unsorted);
        };
        return summaries(page);
    }

    @Transactional(readOnly = true)
    public Page<ItemSummaryResponse> listMyItems(UUID ownerId, Pageable pageable) {
        return summaries(itemRepository.findByOwnerIdAndStatusNot(ownerId, ItemStatus.DELETED, pageable));
    }

    // Admin: pôr ou tirar o destaque no Explorar
    public ItemResponse setFeatured(UUID adminId, UUID itemId, boolean featured) {
        Item item = itemRepository.findActiveById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        if (featured && item.getStatus() != ItemStatus.ACTIVE) {
            throw new IllegalStateException("Só podes destacar equipamento ativo");
        }
        if (featured != (item.getFeaturedAt() != null)) {
            item.setFeaturedAt(featured ? OffsetDateTime.now() : null);
            auditService.record(adminId, featured ? AuditAction.ITEM_FEATURED : AuditAction.ITEM_UNFEATURED,
                    AuditService.ITEM, itemId, null, Map.of());
        }
        return toResponse(item);
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
                .map(p -> new PhotoResponse(p.getId(), photoUrls.of(p), p.getPosition()))
                .toList();
        RatingSummary rating = rating(item);

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
                rating.average(),
                rating.count(),
                completedRentals(List.of(item.getId())).getOrDefault(item.getId(), 0L),
                item.getFeaturedAt() != null,
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }

    private RatingSummary rating(Item item) {
        return reviewService.ratings(List.of(item.getId())).getOrDefault(item.getId(), RatingSummary.NONE);
    }

    private Map<UUID, Long> completedRentals(List<UUID> itemIds) {
        Map<UUID, Long> out = new HashMap<>();
        if (itemIds.isEmpty()) return out;
        for (Object[] row : bookingRepository.completedCountByItem(itemIds)) {
            out.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return out;
    }

    // Avaliações e contagens numa query por página, não uma por cartão
    private Page<ItemSummaryResponse> summaries(Page<Item> page) {
        List<UUID> ids = page.getContent().stream().map(Item::getId).toList();
        Map<UUID, RatingSummary> ratings = reviewService.ratings(ids);
        Map<UUID, Long> rentals = completedRentals(ids);
        return page.map(i -> toSummary(i, ratings.getOrDefault(i.getId(), RatingSummary.NONE),
                rentals.getOrDefault(i.getId(), 0L)));
    }

    private ItemSummaryResponse toSummary(Item item, RatingSummary rating, long rentals) {
        String cover = item.getPhotos().isEmpty() ? null : photoUrls.of(item.getPhotos().get(0));
        return new ItemSummaryResponse(
                item.getId(),
                item.getTitle(),
                item.getCondition().name(),
                item.getPricePerDay(),
                item.getProvince(),
                item.getCity(),
                item.getStatus().name(),
                cover,
                item.getCategory().getSlug(),
                item.getCreatedAt(),
                rating.average(),
                rating.count(),
                rentals,
                item.getFeaturedAt() != null
        );
    }
}
