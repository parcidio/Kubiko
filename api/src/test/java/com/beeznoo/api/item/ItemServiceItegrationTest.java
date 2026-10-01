package com.beeznoo.api.item;

import com.beeznoo.api.item.dto.ItemDtos.*;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.ItemService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Testcontainers
@Transactional
class ItemServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired ItemService itemService;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProfileRepository profileRepository;

    private Profile owner;
    private Profile renter;
    private UUID categoryId;

    @BeforeEach
    void setup() {
        owner = Profile.builder()
                .fullName("Dono Equipamento")
                .phone("+244923000001")
                .passwordHash("$2a$10$hash")
                .role(UserRole.OWNER)
                .isVerified(true)
                .build();
        profileRepository.save(owner);

        renter = Profile.builder()
                .fullName("Arrendatário")
                .phone("+244923000002")
                .passwordHash("$2a$10$hash")
                .role(UserRole.RENTER)
                .isVerified(true)
                .build();
        profileRepository.save(renter);

        categoryId = categoryRepository.findBySlug("fotografia")
                .map(Category::getId)
                .orElseGet(() -> categoryRepository.save(
                        Category.builder()
                                .name("Fotografia")
                                .slug("fotografia")
                                .build()
                ).getId());
    }

    @Test
    void ownerPublishesItem_itemIsActive() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Canon EOS R5", "Câmara mirrorless em excelente estado",
                categoryId, ItemCondition.LIKE_NEW,
                new BigDecimal("5000.00"), new BigDecimal("20000.00"),
                "Luanda", "Miramar"
        );

        ItemResponse res = itemService.publish(owner.getId(), req);

        assertThat(res.status()).isEqualTo("ACTIVE");
        assertThat(res.title()).isEqualTo("Canon EOS R5");
        assertThat(res.ownerId()).isEqualTo(owner.getId());
    }

    @Test
    void renterCannotPublishItem() {
        PublishItemRequest req = new PublishItemRequest(
                "Tripé", null, categoryId, ItemCondition.GOOD,
                new BigDecimal("500.00"), null, "Luanda", null
        );

        assertThatThrownBy(() -> itemService.publish(renter.getId(), req))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void listActiveItems_returnsOnlyActive() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Drone DJI", null, categoryId, ItemCondition.NEW,
                new BigDecimal("8000.00"), new BigDecimal("30000.00"),
                "Luanda", "Talatona"
        );
        itemService.publish(owner.getId(), req);

        Page<ItemSummaryResponse> page = itemService.listActive(null, Pageable.ofSize(10));

        assertThat(page.getContent()).isNotEmpty();
        assertThat(page.getContent()).allMatch(i -> i.status().equals("ACTIVE"));
    }

    @Test
    void ownerDeactivatesItem_statusBecomesInactive() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Microfone Rode", null, categoryId, ItemCondition.GOOD,
                new BigDecimal("1500.00"), null, "Luanda", null
        );
        ItemResponse created = itemService.publish(owner.getId(), req);

        itemService.deactivate(owner.getId(), created.id());

        var item = itemRepository.findById(created.id()).orElseThrow();
        assertThat(item.getStatus()).isEqualTo(ItemStatus.INACTIVE);
    }

    @Test
    void otherUserCannotDeactivateItem() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Flash Godox", null, categoryId, ItemCondition.NEW,
                new BigDecimal("3000.00"), null, "Luanda", null
        );
        ItemResponse created = itemService.publish(owner.getId(), req);

        assertThatThrownBy(() -> itemService.deactivate(renter.getId(), created.id()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ownerDeletesItem_softDelete() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Lente 50mm", null, categoryId, ItemCondition.FAIR,
                new BigDecimal("2000.00"), null, "Luanda", null
        );
        ItemResponse created = itemService.publish(owner.getId(), req);

        itemService.delete(owner.getId(), created.id());

        var item = itemRepository.findById(created.id()).orElseThrow();
        assertThat(item.getStatus()).isEqualTo(ItemStatus.DELETED);
    }

    @Test
    void updateItem_onlyChangedFields() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Câmara Sony A7", null, categoryId, ItemCondition.GOOD,
                new BigDecimal("6000.00"), null, "Luanda", null
        );
        ItemResponse created = itemService.publish(owner.getId(), req);

        UpdateItemRequest update = new UpdateItemRequest(
                "Câmara Sony A7 III", null, null, null,
                new BigDecimal("7000.00"), null, null, null
        );
        ItemResponse updated = itemService.update(owner.getId(), created.id(), update);

        assertThat(updated.title()).isEqualTo("Câmara Sony A7 III");
        assertThat(updated.pricePerDay()).isEqualByComparingTo("7000.00");
        assertThat(updated.condition()).isEqualTo("GOOD");
    }

    @Test
    void listMyItems_doesNotReturnDeletedItems() throws java.nio.file.AccessDeniedException {
        PublishItemRequest req = new PublishItemRequest(
                "Item a eliminar", null, categoryId, ItemCondition.FAIR,
                new BigDecimal("1000.00"), null, "Luanda", null
        );
        ItemResponse created = itemService.publish(owner.getId(), req);
        itemService.delete(owner.getId(), created.id());

        Page<ItemSummaryResponse> mine = itemService.listMyItems(owner.getId(), Pageable.ofSize(10));

        assertThat(mine.getContent()).noneMatch(i -> i.id().equals(created.id()));
    }
}