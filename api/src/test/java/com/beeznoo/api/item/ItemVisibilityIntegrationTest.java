package com.beeznoo.api.item;

import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.profile.entity.AdminRole;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Anúncios fora do Explorar (pausados, suspensos): só o dono e quem modera equipamento os vê por id;
 * para os outros é 404. E o dono não sai de uma suspensão da equipa por pausar → reativar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class ItemVisibilityIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923900000);

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @Autowired ProfileRepository profileRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;

    private Profile owner;
    private Profile stranger;
    private Item item;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", UserRole.OWNER, null);
        stranger = profile("Ana Domingos", UserRole.RENTER, null);
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.saveAndFlush(Item.builder()
                .owner(owner).category(category).title("Sony A7 III").condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00")).depositAmount(new BigDecimal("20000.00")).build());
    }

    @Test
    void ativo_todosVeem() throws Exception {
        mvc.perform(get("/api/v1/items/{id}", item.getId())).andExpect(status().isOk());
    }

    @Test
    void suspensoOuPausado_soDonoEModeracaoVeem_outros404() throws Exception {
        for (ItemStatus hidden : new ItemStatus[]{ItemStatus.SUSPENDED, ItemStatus.INACTIVE}) {
            item.setStatus(hidden);
            itemRepository.saveAndFlush(item);

            mvc.perform(get("/api/v1/items/{id}", item.getId())).andExpect(status().isNotFound());
            mvc.perform(get("/api/v1/items/{id}", item.getId()).header("Authorization", bearer(stranger)))
                    .andExpect(status().isNotFound());
            // ADMIN sem área de moderação (Crescimento) e sem papel: também 404
            mvc.perform(get("/api/v1/items/{id}", item.getId())
                            .header("Authorization", bearer(profile("Equipa Crescimento", UserRole.ADMIN, AdminRole.GROWTH))))
                    .andExpect(status().isNotFound());
            mvc.perform(get("/api/v1/items/{id}", item.getId())
                            .header("Authorization", bearer(profile("Equipa sem papel", UserRole.ADMIN, null))))
                    .andExpect(status().isNotFound());

            mvc.perform(get("/api/v1/items/{id}", item.getId()).header("Authorization", bearer(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value(hidden.name()));
            mvc.perform(get("/api/v1/items/{id}", item.getId())
                            .header("Authorization", bearer(profile("Equipa Confiança", UserRole.ADMIN, AdminRole.TRUST))))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void donoNaoLevantaSuspensao_pausandoEReativando() throws Exception {
        Profile moderator = profile("Equipa Operação", UserRole.ADMIN, AdminRole.OPERATIONS);
        mvc.perform(patch("/api/v1/admin/items/{id}/suspend", item.getId()).header("Authorization", bearer(moderator))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Fotos de banco\"}"))
                .andExpect(status().isOk());

        mvc.perform(patch("/api/v1/items/{id}/deactivate", item.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/v1/items/{id}/activate", item.getId()).header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
        assertThat(itemRepository.findById(item.getId()).orElseThrow().getStatus()).isEqualTo(ItemStatus.SUSPENDED);
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private Profile profile(String name, UserRole role, AdminRole adminRole) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(role).adminRole(adminRole).isVerified(true).build());
    }
}
