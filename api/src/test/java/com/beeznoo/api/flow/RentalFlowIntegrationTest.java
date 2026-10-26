package com.beeznoo.api.flow;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.claim.entity.IncidentType;
import com.beeznoo.api.claim.service.IncidentService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.deposit.entity.DepositStatus;
import com.beeznoo.api.deposit.repository.DepositRepository;
import com.beeznoo.api.deposit.service.DepositService;
import com.beeznoo.api.handover.entity.ChecklistType;
import com.beeznoo.api.handover.service.ChecklistService;
import com.beeznoo.api.item.dto.ItemDtos.PhotoResponse;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.ItemPhotoService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.notification.entity.NotificationType;
import com.beeznoo.api.notification.repository.NotificationRepository;
import com.beeznoo.api.profile.dto.MeDtos.UpdateMeRequest;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.ProfileService;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.repository.AccountRepository;
import com.beeznoo.api.transaction.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
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

import static org.assertj.core.api.Assertions.*;

/**
 * Fluxo do SPEC §7 de ponta a ponta: pedido → aceite (contrato) → pago → entregue → devolvido → caução decidida,
 * mais perfil, fotos do equipamento, reportar problema e auditoria.
 */
@SpringBootTest
@Testcontainers
@Transactional
class RentalFlowIntegrationTest {

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

    private static final byte[] JPEG = com.beeznoo.api.common.storage.TestImages.JPEG;
    private static final AtomicInteger PHONE = new AtomicInteger(923500000);
    // 3 dias × 5.000 = 15.000 · taxa 1.200 · caução 20.000
    private static final BigDecimal RENTAL = new BigDecimal("15000.00");
    private static final BigDecimal DEPOSIT = new BigDecimal("20000.00");

    @Autowired MockStorageService storage;
    @Autowired ProfileService profileService;
    @Autowired ItemPhotoService itemPhotoService;
    @Autowired BookingService bookingService;
    @Autowired ContractService contractService;
    @Autowired PaymentService paymentService;
    @Autowired ChecklistService checklistService;
    @Autowired DepositService depositService;
    @Autowired IncidentService incidentService;
    @Autowired ProfileRepository profileRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired DepositRepository depositRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired AuditLogRepository auditLogRepository;

    private Profile owner;
    private Profile renter;
    private Profile admin;
    private Item item;

    @BeforeEach
    void setup() {
        storage.clear();
        owner = profile("Edson Manuel", UserRole.OWNER, "edson@beeznoo.test");
        renter = profile("Ana Domingos", UserRole.RENTER, "ana@beeznoo.test");
        admin = profile("Equipa Beeznoo", UserRole.ADMIN, null);
        approveKyc(owner);
        approveKyc(renter);
        accountRepository.save(Account.builder().profile(owner).build());
        accountRepository.save(Account.builder().profile(renter).build());

        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.save(Item.builder()
                .owner(owner)
                .category(category)
                .title("Sony A7 III")
                .condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00"))
                .depositAmount(DEPOSIT)
                .build());
    }

    // ── Perfil ────────────────────────────────────────────────────────────

    @Test
    void me_distingueTelefoneDeIdentidadeEEditaDados() {
        Profile fresh = profile("Mauro Fernandes", UserRole.RENTER, null);

        var me = profileService.getMe(fresh.getId());
        assertThat(me.phoneVerified()).isTrue();
        assertThat(me.identityVerified()).isFalse();
        assertThat(me.kycStatus()).isNull();
        assertThat(profileService.getMe(renter.getId()).identityVerified()).isTrue();

        var updated = profileService.updateMe(fresh.getId(), new UpdateMeRequest("Mauro F.", "Mauro@Beeznoo.test", null, "Viana"));
        assertThat(updated.fullName()).isEqualTo("Mauro F.");
        assertThat(updated.email()).isEqualTo("mauro@beeznoo.test");
        assertThat(updated.city()).isEqualTo("Viana");

        assertThatThrownBy(() -> profileService.updateMe(fresh.getId(), new UpdateMeRequest(null, "ana@beeznoo.test", null, null)))
                .isInstanceOf(IllegalStateException.class);
    }

    // ── Fotos do equipamento ──────────────────────────────────────────────

    @Test
    void fotos_donoEnviaJpegsComUrlAssinadaEApaga() {
        List<PhotoResponse> photos = itemPhotoService.upload(owner.getId(), item.getId(), List.of(jpeg("a"), jpeg("b")));

        assertThat(photos).hasSize(2);
        assertThat(photos).allSatisfy(p -> assertThat(p.photUrl()).startsWith("https://storage.test/items/" + item.getId() + "/"));
        assertThat(storage.objects()).hasSize(2);

        List<PhotoResponse> left = itemPhotoService.delete(owner.getId(), item.getId(), photos.getFirst().id());
        assertThat(left).hasSize(1);
    }

    @Test
    void fotos_ficheiroQueNaoEImagemOuOutroUtilizador_saoRecusados() {
        MockMultipartFile pdf = new MockMultipartFile("photos", "x.jpg", "image/jpeg", "%PDF-1.7".getBytes());
        assertThatThrownBy(() -> itemPhotoService.upload(owner.getId(), item.getId(), List.of(pdf)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("JPEG ou PNG");
        assertThatThrownBy(() -> itemPhotoService.upload(renter.getId(), item.getId(), List.of(jpeg("a"))))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Contrato ──────────────────────────────────────────────────────────

    @Test
    void contrato_geradoAoAceitarEObrigatorioAntesDePagar() {
        UUID bookingId = requestAndAccept();

        var contract = contractService.get(renter.getId(), bookingId);
        assertThat(contract.ownerAcceptedAt()).isNotNull();
        assertThat(contract.renterAcceptedAt()).isNull();
        assertThat(contract.bodySha256()).hasSize(64);
        assertThat(contract.body()).contains("Sony A7 III", "Edson Manuel", "Ana Domingos", "15.000 Kz", "36.200 Kz")
                .doesNotContainIgnoringCase("seguro").doesNotContainIgnoringCase("sinistro");

        assertThatThrownBy(() -> paymentService.createReference(renter.getId(), bookingId))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("contrato");
        assertThatThrownBy(() -> contractService.acceptAsRenter(owner.getId(), bookingId))
                .isInstanceOf(AccessDeniedException.class);

        assertThat(contractService.acceptAsRenter(renter.getId(), bookingId).fullyAccepted()).isTrue();
    }

    // ── Entrega, devolução e caução ───────────────────────────────────────

    @Test
    void fluxoCompleto_entregaDevolucaoERetencaoParcial() {
        UUID bookingId = paidBooking();
        assertThat(depositRepository.findByBookingId(bookingId).orElseThrow().getStatus()).isEqualTo(DepositStatus.HELD);

        // entrega: o dono regista, o arrendatário confirma
        checklistService.create(owner.getId(), bookingId, ChecklistType.DELIVERY, "Sem riscos, 2 baterias", twoPhotos());
        assertThat(notificationRepository.existsByTypeAndBookingId(NotificationType.CHECKLIST_TO_CONFIRM, bookingId)).isTrue();
        assertThatThrownBy(() -> checklistService.confirm(owner.getId(), bookingId, ChecklistType.DELIVERY))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("outra parte");
        checklistService.confirm(renter.getId(), bookingId, ChecklistType.DELIVERY);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.IN_PROGRESS);

        // devolução: o arrendatário regista, o dono confirma
        checklistService.create(renter.getId(), bookingId, ChecklistType.RETURN, "Ecrã com um risco", twoPhotos());
        checklistService.confirm(owner.getId(), bookingId, ChecklistType.RETURN);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.RETURNED);
        assertThat(depositService.queue(Pageable.unpaged()).map(d -> d.bookingId()).toList()).contains(bookingId);

        var decided = depositService.withhold(admin.getId(), bookingId, new BigDecimal("5000"), "Risco no ecrã");

        assertThat(decided.status()).isEqualTo("WITHHELD");
        assertThat(decided.withheldAmount()).isEqualByComparingTo("5000");
        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);
        Account renterAccount = accountRepository.findByProfileId(renter.getId()).orElseThrow();
        Account ownerAccount = accountRepository.findByProfileId(owner.getId()).orElseThrow();
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo("15000");   // 20.000 − 5.000 retidos
        assertThat(ownerAccount.getAvailableBalance()).isEqualByComparingTo("20000");    // aluguer + 5.000
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(bookingId))
                .extracting(a -> a.getAction())
                .containsExactly(AuditAction.PAYMENT_CONFIRMED_MANUALLY, AuditAction.DEPOSIT_WITHHELD);
        assertThat(notificationRepository.existsByTypeAndBookingId(NotificationType.DEPOSIT_WITHHELD, bookingId)).isTrue();
    }

    @Test
    void checklist_comMenosDeDuasFotosOuEstadoErrado_eRecusada() {
        UUID bookingId = paidBooking();

        assertThatThrownBy(() -> checklistService.create(owner.getId(), bookingId, ChecklistType.DELIVERY, "ok", List.of(jpeg("a"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> checklistService.create(owner.getId(), bookingId, ChecklistType.RETURN, "ok", twoPhotos()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void concluir_libertaCaucaoInteiraSoDepoisDaDevolucao() {
        UUID bookingId = paidBooking();
        assertThatThrownBy(() -> bookingService.complete(admin.getId(), bookingId))
                .isInstanceOf(IllegalStateException.class);

        deliverAndReturn(bookingId);
        bookingService.complete(admin.getId(), bookingId, "Tudo em ordem");

        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);
        assertThat(depositRepository.findByBookingId(bookingId).orElseThrow().getStatus()).isEqualTo(DepositStatus.RELEASED);
        assertThat(accountRepository.findByProfileId(renter.getId()).orElseThrow().getAvailableBalance()).isEqualByComparingTo(DEPOSIT);
        assertThatThrownBy(() -> depositService.withhold(admin.getId(), bookingId, new BigDecimal("1"), "tarde"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void reter_maisDoQueACaucao_eRecusado() {
        UUID bookingId = paidBooking();
        deliverAndReturn(bookingId);

        assertThatThrownBy(() -> depositService.withhold(admin.getId(), bookingId, new BigDecimal("20001"), "demais"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> depositService.withhold(admin.getId(), bookingId, new BigDecimal("100"), " "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── Reportar problema ─────────────────────────────────────────────────

    @Test
    void problema_poeReservaEmDisputaAvisaEquipaEResolveComAuditoria() {
        UUID bookingId = paidBooking();
        checklistService.create(owner.getId(), bookingId, ChecklistType.DELIVERY, "Tudo ok", twoPhotos());
        checklistService.confirm(renter.getId(), bookingId, ChecklistType.DELIVERY);

        var incident = incidentService.report(owner.getId(), bookingId, IncidentType.DAMAGE, "Lente partida", List.of(jpeg("x")));

        assertThat(status(bookingId)).isEqualTo(BookingStatus.DISPUTED);
        assertThat(incident.photos()).hasSize(1);
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(admin.getId()))
                .extracting(n -> n.getType()).contains(NotificationType.INCIDENT_REPORTED);
        assertThat(incidentService.queue(Pageable.unpaged()).map(i -> i.id()).toList()).contains(incident.id());

        Profile stranger = profile("Outra Pessoa", UserRole.RENTER, null);
        assertThatThrownBy(() -> incidentService.report(stranger.getId(), bookingId, IncidentType.OTHER, "?", null))
                .isInstanceOf(AccessDeniedException.class);

        var resolved = incidentService.resolve(admin.getId(), incident.id(), "Dono compensado com a caução");
        assertThat(resolved.status()).isEqualTo("RESOLVED");
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(incident.id()))
                .extracting(a -> a.getAction()).containsExactly(AuditAction.INCIDENT_RESOLVED);

        // em disputa, a caução decide-se sem devolução
        depositService.withhold(admin.getId(), bookingId, DEPOSIT, "Lente partida");
        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);
    }

    @Test
    void problema_antesDePagar_eRecusado() {
        UUID bookingId = requestAndAccept();
        assertThatThrownBy(() -> incidentService.report(renter.getId(), bookingId, IncidentType.OTHER, "Desisti", null))
                .isInstanceOf(IllegalStateException.class);
    }

    // ── Filas de admin ────────────────────────────────────────────────────

    @Test
    void filaDePagamentos_mostraReferenciasPorPagar() {
        UUID bookingId = requestAndAccept();
        contractService.acceptAsRenter(renter.getId(), bookingId);
        paymentService.createReference(renter.getId(), bookingId);

        assertThat(paymentService.adminQueue(com.beeznoo.api.transaction.entity.PaymentStatus.AWAITING_PAYMENT, Pageable.unpaged()))
                .anySatisfy(p -> {
                    assertThat(p.bookingId()).isEqualTo(bookingId);
                    assertThat(p.renterName()).isEqualTo("Ana Domingos");
                    assertThat(p.amount()).isEqualByComparingTo("36200");
                });
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private UUID requestAndAccept() {
        int offset = (int) (bookingRepository.count() * 10) + 2;
        var booking = bookingService.create(renter.getId(), new CreateBookingRequest(
                item.getId(), LocalDate.now().plusDays(offset), LocalDate.now().plusDays(offset + 3), null));
        bookingService.accept(owner.getId(), booking.id(), null);
        return booking.id();
    }

    private UUID paidBooking() {
        UUID bookingId = requestAndAccept();
        contractService.acceptAsRenter(renter.getId(), bookingId);
        bookingService.confirmPayment(admin.getId(), bookingId, "Comprovativo Multicaixa conferido");
        assertThat(status(bookingId)).isEqualTo(BookingStatus.ACTIVE);
        return bookingId;
    }

    private void deliverAndReturn(UUID bookingId) {
        checklistService.create(owner.getId(), bookingId, ChecklistType.DELIVERY, "Tudo ok", twoPhotos());
        checklistService.confirm(renter.getId(), bookingId, ChecklistType.DELIVERY);
        checklistService.create(renter.getId(), bookingId, ChecklistType.RETURN, "Tudo ok", twoPhotos());
        checklistService.confirm(owner.getId(), bookingId, ChecklistType.RETURN);
    }

    private BookingStatus status(UUID bookingId) {
        return bookingRepository.findById(bookingId).orElseThrow().getStatus();
    }

    private List<MultipartFile> twoPhotos() {
        return List.of(jpeg("1"), jpeg("2"));
    }

    private static MockMultipartFile jpeg(String name) {
        return new MockMultipartFile("photos", name + ".jpg", "image/jpeg", JPEG);
    }

    private void approveKyc(Profile p) {
        kycVerificationRepository.save(KycVerification.builder()
                .profile(p)
                .accountType(AccountType.INDIVIDUAL)
                .status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now())
                .build());
    }

    private Profile profile(String name, UserRole role, String email) {
        return profileRepository.save(Profile.builder()
                .fullName(name)
                .phone("+244" + PHONE.incrementAndGet())
                .email(email)
                .passwordHash("$2a$10$hash")
                .role(role)
                .isVerified(true)
                .build());
    }
}
