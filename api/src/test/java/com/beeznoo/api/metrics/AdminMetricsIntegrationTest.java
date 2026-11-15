package com.beeznoo.api.metrics;

import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.handover.entity.ChecklistType;
import com.beeznoo.api.handover.service.ChecklistService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.metrics.dto.MetricsDtos.AdminMetrics;
import com.beeznoo.api.metrics.service.AdminMetricsService;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.DirectChannel;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Painel de métricas do admin (decisoes-produto.md 2026-11-15): contas por diferença, para não depender de outros dados. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class AdminMetricsIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923800000);

    @Autowired AdminMetricsService metricsService;
    @Autowired BookingService bookingService;
    @Autowired ContractService contractService;
    @Autowired ChecklistService checklistService;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;

    private Profile owner;
    private Profile renter;
    private Item item;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", UserRole.OWNER);
        renter = profile("Ana Domingos", UserRole.RENTER);
        approveKyc(owner);
        approveKyc(renter);
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.save(Item.builder()
                .owner(owner).category(category).title("Sony A7 III").condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00")).depositAmount(new BigDecimal("20000.00")).build());
    }

    @Test
    void contaConcluidosFunilComissoesEKyc() {
        AdminMetrics before = snapshot();

        UUID done = request(2);                       // pedido → aceite → pago → entregue → devolvido → concluído
        bookingService.accept(owner.getId(), done, null);
        contractService.acceptAsRenter(renter.getId(), done);
        bookingService.confirmPaymentReceived(owner.getId(), done, DirectChannel.CASH);
        checklistService.create(owner.getId(), done, ChecklistType.DELIVERY, "ok", photos());
        checklistService.confirm(renter.getId(), done, ChecklistType.DELIVERY);
        checklistService.create(renter.getId(), done, ChecklistType.RETURN, "ok", photos());
        checklistService.confirm(owner.getId(), done, ChecklistType.RETURN);
        bookingService.decideDepositAsOwner(owner.getId(), done, BigDecimal.ZERO, null);

        request(12);                                  // fica à espera do dono
        UUID refused = request(22);                   // o dono recusa
        bookingService.cancel(owner.getId(), refused, null);

        Profile waiting = profile("Pedro Neto", UserRole.RENTER);
        kycVerificationRepository.save(KycVerification.builder().profile(waiting).accountType(AccountType.INDIVIDUAL)
                .status(KycStatus.PENDING).submittedAt(OffsetDateTime.now()).build());
        Profile decided = profile("Rosa Lima", UserRole.RENTER);
        kycVerificationRepository.save(KycVerification.builder().profile(decided).accountType(AccountType.INDIVIDUAL)
                .status(KycStatus.APPROVED).submittedAt(OffsetDateTime.now().minusHours(6))
                .reviewedAt(OffsetDateTime.now()).build());

        AdminMetrics after = snapshot();

        assertThat(after.northStar().completedThisMonth() - before.northStar().completedThisMonth()).isEqualTo(1);
        assertThat(after.months()).hasSize(6);
        assertThat(after.months().getLast().paid() - before.months().getLast().paid()).isEqualTo(1);
        // 3 dias × 5.000 = 15.000 de aluguer; taxa 8% = 1.200
        assertThat(after.months().getLast().rentalValue().subtract(before.months().getLast().rentalValue()))
                .isEqualByComparingTo("15000");
        assertThat(after.commissions().pendingTotal().subtract(before.commissions().pendingTotal()))
                .isEqualByComparingTo("1200");

        var f0 = before.funnel30d();
        var f1 = after.funnel30d();
        assertThat(f1.requested() - f0.requested()).isEqualTo(3);
        assertThat(f1.accepted() - f0.accepted()).isEqualTo(1);
        assertThat(f1.paid() - f0.paid()).isEqualTo(1);
        assertThat(f1.completed() - f0.completed()).isEqualTo(1);
        assertThat(f1.lost() - f0.lost()).isEqualTo(1);
        assertThat(f1.pending() - f0.pending()).isEqualTo(1);

        assertThat(after.kyc().pending() - before.kyc().pending()).isEqualTo(1);
        assertThat(after.kyc().decided30d() - before.kyc().decided30d()).isEqualTo(1);
        assertThat(after.kyc().avgDecisionHours()).isNotNull();
        assertThat(after.marketplace().activeItems() - before.marketplace().activeItems()).isZero();
    }

    @Test
    void soAdmin() throws Exception {
        Profile admin = profile("Equipa Beeznoo", UserRole.ADMIN);
        mvc.perform(get("/api/v1/admin/metrics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/metrics").header("Authorization", bearer(renter))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/metrics").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.months.length()").value(6))
                .andExpect(jsonPath("$.northStar.completedThisMonth").isNumber());
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private AdminMetrics snapshot() {
        bookingRepository.flush(); // o painel lê por JDBC: escrever primeiro o que o JPA tem em memória
        return metricsService.get();
    }

    private UUID request(int offset) {
        return bookingService.create(renter.getId(), new CreateBookingRequest(
                item.getId(), LocalDate.now().plusDays(offset), LocalDate.now().plusDays(offset + 3), null)).id();
    }

    private List<MultipartFile> photos() {
        byte[] jpeg = com.beeznoo.api.common.storage.TestImages.JPEG;
        return List.of(new MockMultipartFile("photos", "1.jpg", "image/jpeg", jpeg),
                new MockMultipartFile("photos", "2.jpg", "image/jpeg", jpeg));
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private void approveKyc(Profile p) {
        kycVerificationRepository.save(KycVerification.builder()
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.save(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(role).isVerified(true).build());
    }
}
