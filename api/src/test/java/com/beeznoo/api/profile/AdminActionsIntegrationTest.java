package com.beeznoo.api.profile;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.dto.AuthDtos.LoginRequest;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.item.dto.ItemDtos.ItemSummaryResponse;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.dto.ItemDtos.ItemOrder;
import com.beeznoo.api.item.entity.ItemStatus;
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
import com.beeznoo.api.profile.service.AdminUserService;
import com.beeznoo.api.transaction.entity.DirectChannel;
import com.beeznoo.api.transaction.service.PaymentService;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Ações de admin (decisoes-produto.md 2026-11-15): pesquisa, suspensão de contas e equipamento, pagamento na reserva. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class AdminActionsIntegrationTest {

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
    private static final String PASSWORD = "Segredo-123";
    private static final String HASH = new BCryptPasswordEncoder().encode(PASSWORD);

    @Autowired AdminUserService adminUserService;
    @Autowired ItemService itemService;
    @Autowired BookingService bookingService;
    @Autowired ContractService contractService;
    @Autowired PaymentService paymentService;
    @Autowired AuthService authService;
    @Autowired JwtService jwtService;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired MockMvc mvc;

    private Profile owner;
    private Profile renter;
    private Profile admin;
    private Item item;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", "edson@exemplo.ao", UserRole.OWNER);
        renter = profile("Ana Domingos", "ana@exemplo.ao", UserRole.RENTER);
        admin = profile("Equipa Beeznoo", null, UserRole.ADMIN);
        approveKyc(owner);
        approveKyc(renter);
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.saveAndFlush(Item.builder()
                .owner(owner).category(category).title("Sony A7 III").condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00")).depositAmount(new BigDecimal("20000.00")).build());
    }

    @Test
    void pesquisaPorNomeTelefoneEEmail() {
        String digits = owner.getPhone().substring(owner.getPhone().length() - 6);
        assertThat(ids(adminUserService.search("edson", false, 0, 20).getContent())).contains(owner.getId());
        assertThat(ids(adminUserService.search(digits, false, 0, 20).getContent())).containsExactly(owner.getId());
        assertThat(ids(adminUserService.search("ana@exemplo", false, 0, 20).getContent())).containsExactly(renter.getId());
        // % e _ são literais, não curingas
        assertThat(adminUserService.search("%", false, 0, 20).getContent()).isEmpty();

        var row = adminUserService.search("edson", false, 0, 20).getContent().getFirst();
        assertThat(row.kycStatus()).isEqualTo("APPROVED");
        assertThat(row.items()).isEqualTo(1);
        assertThat(adminUserService.detail(owner.getId()).items()).extracting(i -> i.title()).containsExactly("Sony A7 III");
    }

    @Test
    void contaSuspensaNaoEntraESaiDoExplorar() {
        var session = authService.login(new LoginRequest(owner.getPhone(), null, PASSWORD));
        assertThat(publicIds()).contains(item.getId());

        assertThatThrownBy(() -> adminUserService.suspend(admin.getId(), owner.getId(), " "))
                .isInstanceOf(IllegalArgumentException.class);
        var suspended = adminUserService.suspend(admin.getId(), owner.getId(), "Anúncio enganador");
        assertThat(suspended.suspendedAt()).isNotNull();
        assertThat(adminUserService.search(null, true, 0, 20).getContent()).extracting(r -> r.id()).contains(owner.getId());

        assertThatThrownBy(() -> authService.login(new LoginRequest(owner.getPhone(), null, PASSWORD)))
                .isInstanceOf(AccessDeniedException.class).hasMessageContaining("suspensa");
        assertThatThrownBy(() -> authService.refresh(session.refreshToken()))
                .isInstanceOf(IllegalArgumentException.class); // sessão revogada na suspensão
        assertThat(publicIds()).doesNotContain(item.getId());
        assertThatThrownBy(() -> request())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("não está disponível");
        assertThat(itemRepository.findById(item.getId()).orElseThrow().getStatus()).isEqualTo(ItemStatus.ACTIVE);

        adminUserService.reinstate(admin.getId(), owner.getId(), null);
        assertThat(authService.login(new LoginRequest(owner.getPhone(), null, PASSWORD)).accessToken()).isNotBlank();
        assertThat(publicIds()).contains(item.getId());
        assertThat(actions(owner.getId())).containsExactly(AuditAction.ACCOUNT_SUSPENDED, AuditAction.ACCOUNT_REINSTATED);
    }

    @Test
    void naoSuspendeAdminNemASiMesmo() {
        Profile other = profile("Outra Admin", null, UserRole.ADMIN);
        assertThatThrownBy(() -> adminUserService.suspend(admin.getId(), other.getId(), "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> adminUserService.suspend(admin.getId(), admin.getId(), "x"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void equipamentoSuspensoSaiDoExplorarEODonoNaoReativa() {
        itemService.setFeatured(admin.getId(), item.getId(), true);
        itemService.suspend(admin.getId(), item.getId(), "Fotos não correspondem");

        Item saved = itemRepository.findById(item.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(ItemStatus.SUSPENDED);
        assertThat(saved.getFeaturedAt()).isNull();
        assertThat(publicIds()).doesNotContain(item.getId());
        assertThatThrownBy(this::request).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> itemService.activate(owner.getId(), item.getId(), null)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> itemService.suspend(admin.getId(), item.getId(), "outra vez"))
                .isInstanceOf(IllegalStateException.class);

        itemService.reinstate(admin.getId(), item.getId(), "Fotos corrigidas");
        assertThat(publicIds()).contains(item.getId());
        assertThat(actions(item.getId())).contains(AuditAction.ITEM_SUSPENDED, AuditAction.ITEM_REINSTATED);
    }

    @Test
    void adminVeOPagamentoDaReserva() {
        UUID bookingId = request();
        bookingService.accept(owner.getId(), bookingId, null);
        contractService.acceptAsRenter(renter.getId(), bookingId);
        bookingService.confirmPaymentReceived(owner.getId(), bookingId, DirectChannel.CASH);

        assertThat(paymentService.findCurrent(admin.getId(), bookingId)).hasValueSatisfying(p ->
                assertThat(p.status()).isEqualTo("CONFIRMED"));
        Profile stranger = profile("Pedro Neto", null, UserRole.RENTER);
        assertThatThrownBy(() -> paymentService.findCurrent(stranger.getId(), bookingId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void soAdminPorHttp() throws Exception {
        mvc.perform(get("/api/v1/admin/users").header("Authorization", bearer(renter))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/users?q=Edson&size=1000&page=-3").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].fullName").value("Edson Manuel"));
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private UUID request() {
        return bookingService.create(renter.getId(), new CreateBookingRequest(
                item.getId(), LocalDate.now().plusDays(3), LocalDate.now().plusDays(6), null)).id();
    }

    private List<UUID> publicIds() {
        itemRepository.flush();
        return itemService.listActive(null, false, ItemOrder.RECENT, null, null, PageRequest.of(0, 100))
                .getContent().stream().map(ItemSummaryResponse::id).toList();
    }

    private List<AuditAction> actions(UUID entityId) {
        return auditLogRepository.findByEntityIdOrderByCreatedAtAsc(entityId).stream().map(a -> a.getAction()).toList();
    }

    private static List<UUID> ids(List<com.beeznoo.api.profile.dto.AdminUserDtos.AdminUserSummary> rows) {
        return rows.stream().map(r -> r.id()).toList();
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private void approveKyc(Profile p) {
        kycVerificationRepository.saveAndFlush(KycVerification.builder()
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private Profile profile(String name, String email, UserRole role) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).email(email).passwordHash(HASH)
                .role(role).isVerified(true).build());
    }
}
