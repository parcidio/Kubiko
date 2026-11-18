package com.beeznoo.api.profile;

import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.common.storage.TestImages;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.ProfileService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Foto de perfil (decisoes-produto.md 2026-11-18). Sem @Transactional na classe: cada pedido faz commit,
 * para se ver o storage a apagar o ficheiro antigo depois do commit e o novo no rollback.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AvatarIntegrationTest {

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
    @Autowired ProfileService profileService;
    @Autowired MockStorageService storage;
    @Autowired TransactionTemplate tx;

    @Test
    void uploadGuardaEmPrivadoEDevolveUrlAssinada() throws Exception {
        Profile p = profile(null);

        mvc.perform(multipart("/api/v1/me/avatar").file(jpeg()).header("Authorization", bearer(p)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl", containsString("https://storage.test/avatars/" + p.getId() + "/")))
                .andExpect(jsonPath("$.avatarUrl", containsString("X-Amz-Expires=3600")))
                .andExpect(content().string(not(containsString("avatarStorageKey"))));

        assertThat(keysOf(p)).hasSize(1);
        assertThat(profileRepository.findById(p.getId()).orElseThrow().getAvatarStorageKey()).isEqualTo(keysOf(p).get(0));
    }

    @Test
    void substituirApagaAFotoAntigaDepoisDoCommit() throws Exception {
        Profile p = profile(null);
        mvc.perform(multipart("/api/v1/me/avatar").file(jpeg()).header("Authorization", bearer(p))).andExpect(status().isOk());
        String first = keysOf(p).get(0);

        mvc.perform(multipart("/api/v1/me/avatar").file(png()).header("Authorization", bearer(p))).andExpect(status().isOk());

        List<String> keys = keysOf(p);
        assertThat(keys).hasSize(1).doesNotContain(first);
        assertThat(keys.get(0)).endsWith(".png");
    }

    @Test
    void recusaFicheiroQueNaoEImagem() throws Exception {
        Profile p = profile(null);
        MockMultipartFile pdf = new MockMultipartFile("photo", "foto.jpg", "image/jpeg", "%PDF-1.7\n".getBytes());

        mvc.perform(multipart("/api/v1/me/avatar").file(pdf).header("Authorization", bearer(p)))
                .andExpect(status().isBadRequest());

        assertThat(keysOf(p)).isEmpty();
        assertThat(profileRepository.findById(p.getId()).orElseThrow().getAvatarStorageKey()).isNull();
    }

    @Test
    void rollbackApagaOFicheiroEnviado() {
        Profile p = profile(null);

        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            profileService.uploadAvatar(p.getId(), jpeg());
            throw new IllegalStateException("falha depois do upload");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(keysOf(p)).isEmpty();
        assertThat(profileRepository.findById(p.getId()).orElseThrow().getAvatarStorageKey()).isNull();
    }

    @Test
    void semUploadMantemAFotoDoGoogle() throws Exception {
        Profile p = profile("https://lh3.googleusercontent.com/a/foto");

        mvc.perform(get("/api/v1/profiles/me").header("Authorization", bearer(p)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://lh3.googleusercontent.com/a/foto"));
    }

    @Test
    void removerApagaOFicheiroEFicaComAsIniciais() throws Exception {
        Profile p = profile("https://lh3.googleusercontent.com/a/foto");
        mvc.perform(multipart("/api/v1/me/avatar").file(jpeg()).header("Authorization", bearer(p))).andExpect(status().isOk());
        assertThat(keysOf(p)).hasSize(1);

        mvc.perform(delete("/api/v1/me/avatar").header("Authorization", bearer(p)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());

        assertThat(keysOf(p)).isEmpty();
        Profile saved = profileRepository.findById(p.getId()).orElseThrow();
        assertThat(saved.getAvatarStorageKey()).isNull();
        assertThat(saved.getAvatarUrl()).isNull();
    }

    @Test
    void semSessaoNaoPassa() throws Exception {
        mvc.perform(multipart("/api/v1/me/avatar").file(jpeg())).andExpect(status().isUnauthorized());
    }

    private List<String> keysOf(Profile p) {
        return storage.objects().keySet().stream().filter(k -> k.startsWith("avatars/" + p.getId() + "/")).toList();
    }

    private static MockMultipartFile jpeg() {
        return new MockMultipartFile("photo", "eu.jpg", "image/jpeg", TestImages.JPEG);
    }

    private static MockMultipartFile png() {
        return new MockMultipartFile("photo", "eu.png", "image/png", TestImages.PNG);
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private Profile profile(String googleAvatar) {
        return profileRepository.save(Profile.builder()
                .fullName("Ana Domingos").phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .avatarUrl(googleAvatar).role(UserRole.BOTH).isVerified(true).build());
    }
}
