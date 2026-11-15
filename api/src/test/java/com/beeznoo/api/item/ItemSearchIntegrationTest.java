package com.beeznoo.api.item;

import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.item.dto.ItemDtos.ItemOrder;
import com.beeznoo.api.item.dto.ItemDtos.ItemSummaryResponse;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.ItemService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.ProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pesquisa do Explorar no servidor (#17) e o aviso de KYC antes do pedido (MeResponse.canTransact). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class ItemSearchIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @TestConfiguration
    static class StorageConfig {
        @Bean
        @Primary
        MockStorageService mockStorageService() {
            return new MockStorageService();
        }
    }

    private static final AtomicInteger PHONE = new AtomicInteger(923950000);

    @Autowired ItemService itemService;
    @Autowired ProfileService profileService;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired MockMvc mvc;

    private Profile owner;

    @BeforeEach
    void setup() {
        owner = profile();
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item(category, "Sony A7 III", "Talatona", "5000", ItemCondition.LIKE_NEW);
        item(category, "Canon EOS R6", "Maianga", "8000", ItemCondition.GOOD);
        item(category, "Coluna JBL 100% nova", "Talatona", "3000", ItemCondition.NEW);
        itemRepository.flush();
    }

    @Test
    void pesquisaPorTituloZonaPrecoEEstado() {
        assertThat(titles("SONY a7", null, null, null)).containsExactly("Sony A7 III");
        assertThat(titles(null, "talatona", null, null)).containsExactlyInAnyOrder("Sony A7 III", "Coluna JBL 100% nova");
        assertThat(titles(null, null, new BigDecimal("5000"), null)).containsExactlyInAnyOrder("Sony A7 III", "Coluna JBL 100% nova");
        assertThat(titles(null, "talatona", null, ItemCondition.NEW)).containsExactly("Coluna JBL 100% nova");
        // % é literal: "100%" encontra só o título que o tem, "%" sozinho não devolve tudo
        assertThat(titles("100%", null, null, null)).containsExactly("Coluna JBL 100% nova");
        assertThat(titles("a%a", null, null, null)).isEmpty();
        // sem filtros: todos, e o total da página é o total da pesquisa
        assertThat(itemService.listActive(null, false, ItemOrder.RECENT, null, null, "canon", null, null, null,
                PageRequest.of(0, 1)).getTotalElements()).isEqualTo(1);
    }

    @Test
    void parametrosInvalidosDao400() throws Exception {
        mvc.perform(get("/api/v1/items?condition=PARTIDO")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/items?maxPrice=-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/items?q=" + "x".repeat(101))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/items?q=sony&area=talatona&maxPrice=6000&condition=LIKE_NEW")).andExpect(status().isOk());
    }

    @Test
    void canTransactSoComKycAprovado() {
        assertThat(profileService.getMe(owner.getId()).canTransact()).isFalse();
        kycVerificationRepository.saveAndFlush(KycVerification.builder()
                .profile(owner).accountType(AccountType.INDIVIDUAL).status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now()).build());
        assertThat(profileService.getMe(owner.getId()).canTransact()).isTrue();
        assertThatThrownBy(() -> itemService.listActive(null, false, ItemOrder.RECENT, null, null, null, null,
                new BigDecimal("-5"), null, PageRequest.of(0, 10))).isInstanceOf(IllegalArgumentException.class);
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private List<String> titles(String q, String area, BigDecimal maxPrice, ItemCondition condition) {
        return itemService.listActive(null, false, ItemOrder.RECENT, null, null, q, area, maxPrice, condition,
                PageRequest.of(0, 50)).getContent().stream().map(ItemSummaryResponse::title)
                .filter(t -> t.equals("Sony A7 III") || t.equals("Canon EOS R6") || t.equals("Coluna JBL 100% nova"))
                .toList();
    }

    private void item(Category category, String title, String city, String price, ItemCondition condition) {
        itemRepository.save(Item.builder()
                .owner(owner).category(category).title(title).condition(condition).city(city).province("Luanda")
                .pricePerDay(new BigDecimal(price)).depositAmount(new BigDecimal("10000")).build());
    }

    private Profile profile() {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName("Edson Manuel").phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(UserRole.OWNER).isVerified(true).build());
    }
}
