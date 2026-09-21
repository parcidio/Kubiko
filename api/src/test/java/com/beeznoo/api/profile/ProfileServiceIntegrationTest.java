package com.beeznoo.api.profile;

import com.beeznoo.api.profile.dto.CreateProfileRequest;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.service.ProfileService;
import com.beeznoo.api.transaction.repository.AccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
@Transactional
class ProfileServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired ProfileService profileService;
    @Autowired AccountRepository accountRepository;

    @Test
    @DisplayName("Deve criar perfil e account na mesma transação após OTP verificado")
    void shouldCreateProfileAndAccount() {
        CreateProfileRequest request = new CreateProfileRequest(
                "+244923000001",
                "Leonel Teste",
                null,
                UserRole.RENTER
        );

        Profile profile = profileService.createProfile(request);

        assertThat(profile.getId()).isNotNull();
        assertThat(profile.getPhone()).isEqualTo("+244923000001");
        assertThat(profile.isVerified()).isFalse();
        assertThat(profile.getGoogleId()).isNull();

        // Account criada automaticamente e associada ao perfil
        assertThat(accountRepository.findByProfileId(profile.getId())).isPresent();
    }

    @Test
    @DisplayName("Deve rejeitar número de telefone duplicado")
    void shouldRejectDuplicatePhone() {
        CreateProfileRequest request = new CreateProfileRequest(
                "+244923000002",
                "Outro Utilizador",
                null,
                UserRole.OWNER
        );

        profileService.createProfile(request);

        assertThatThrownBy(() -> profileService.createProfile(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Perfil já existe para este número");
    }

    @Test
    @DisplayName("Google não deve associar se já ligado a outro perfil")
    void shouldRejectDuplicateGoogleLink() {
        Profile p1 = profileService.createProfile(new CreateProfileRequest(
                "+244923000003", "User 1", "user1@gmail.com", UserRole.RENTER));
        Profile p2 = profileService.createProfile(new CreateProfileRequest(
                "+244923000004", "User 2", null, UserRole.RENTER));

        profileService.linkGoogle(p1.getId(), "google-uid-123", "user1@gmail.com", null);

        assertThatThrownBy(() ->
                profileService.linkGoogle(p2.getId(), "google-uid-123", "user1@gmail.com", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("já está associada a outro perfil");
    }
}