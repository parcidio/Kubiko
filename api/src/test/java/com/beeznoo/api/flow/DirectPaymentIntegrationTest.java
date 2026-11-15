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
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.notification.entity.NotificationType;
import com.beeznoo.api.notification.repository.NotificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.DirectChannel;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentMethod;
import com.beeznoo.api.transaction.repository.LedgerEntryRepository;
import com.beeznoo.api.transaction.repository.PaymentRepository;
import com.beeznoo.api.transaction.service.PaymentService;
import com.beeznoo.api.transaction.service.ReceiptService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
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
 * Pagamento direto ao dono, modelo "Yango" (decisoes-produto.md 2026-11-15) — o modo por omissão:
 * aceite → contrato → o dono confirma que recebeu → entrega → devolução → o dono devolve a caução → concluída.
 * A Beeznoo não mexe em dinheiro (sem ledger); a taxa de serviço fica como comissão a cobrar ao dono.
 */
@SpringBootTest
@Testcontainers
@Transactional
class DirectPaymentIntegrationTest {

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
    private static final AtomicInteger PHONE = new AtomicInteger(923700000);
    // 3 dias × 5.000 = 15.000 · taxa 1.200 · caução 20.000 → 36.200
    private static final BigDecimal DEPOSIT = new BigDecimal("20000.00");

    @Autowired BookingService bookingService;
    @Autowired ContractService contractService;
    @Autowired PaymentService paymentService;
    @Autowired ReceiptService receiptService;
    @Autowired ChecklistService checklistService;
    @Autowired DepositService depositService;
    @Autowired IncidentService incidentService;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired DepositRepository depositRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired LedgerEntryRepository ledgerEntryRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired AuditLogRepository auditLogRepository;

    private Profile owner;
    private Profile renter;
    private Profile admin;
    private Item item;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", UserRole.OWNER);
        renter = profile("Ana Domingos", UserRole.RENTER);
        admin = profile("Equipa Beeznoo", UserRole.ADMIN);
        approveKyc(owner);
        approveKyc(renter);
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.save(Item.builder()
                .owner(owner).category(category).title("Sony A7 III").condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00")).depositAmount(DEPOSIT).build());
    }

    @Test
    void semReferencia_eContratoV2DizQueSePagaAoDono() {
        UUID bookingId = requestAndAccept();

        assertThatThrownBy(() -> paymentService.createReference(renter.getId(), bookingId))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("pagas ao dono");
        var contract = contractService.get(renter.getId(), bookingId);
        assertThat(contract.version()).isEqualTo(ContractService.DIRECT_VERSION);
        assertThat(contract.body()).contains("paga o total ao dono", "A caução fica com o dono", "36.200 Kz")
                .doesNotContain("O pagamento é feito à Beeznoo");

        // o aviso de aceite leva ao contrato, não a um ecrã de pagamento
        var accepted = notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(renter.getId()).stream()
                .filter(n -> n.getType() == NotificationType.BOOKING_ACCEPTED).findFirst().orElseThrow();
        assertThat(accepted.getLinkPath()).endsWith("/contrato");
    }

    @Test
    void donoConfirmaQueRecebeu_reservaAtiva_comprovativo_semLedger() throws Exception {
        UUID bookingId = requestAndAccept();

        // sem contrato aceite pelo arrendatário não há pagamento
        assertThatThrownBy(() -> bookingService.confirmPaymentReceived(owner.getId(), bookingId, DirectChannel.CASH))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("contrato");
        contractService.acceptAsRenter(renter.getId(), bookingId);

        // só o dono confirma
        assertThatThrownBy(() -> bookingService.confirmPaymentReceived(renter.getId(), bookingId, DirectChannel.CASH))
                .isInstanceOf(AccessDeniedException.class);

        bookingService.confirmPaymentReceived(owner.getId(), bookingId, DirectChannel.MULTICAIXA_EXPRESS);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.ACTIVE);

        Payment payment = paymentRepository.findFirstByBookingIdOrderByCreatedAtDesc(bookingId).orElseThrow();
        assertThat(payment.getMethod()).isEqualTo(PaymentMethod.DIRECT);
        assertThat(payment.getProvider()).isEqualTo("MULTICAIXA_EXPRESS");
        assertThat(payment.getAmount()).isEqualByComparingTo("36200");
        assertThat(payment.getServiceFee()).isEqualByComparingTo("1200");
        assertThat(payment.getReceiptNumber()).startsWith("CP ");
        assertThat(payment.getConfirmedBy().getId()).isEqualTo(owner.getId());
        assertThat(payment.getCommissionSettledAt()).isNull();
        // a Beeznoo não recebeu dinheiro: nada no ledger
        assertThat(ledgerEntryRepository.existsByBookingIdAndType(bookingId, com.beeznoo.api.transaction.entity.EntryType.TOPUP)).isFalse();
        assertThat(depositRepository.findByBookingId(bookingId).orElseThrow().getStatus()).isEqualTo(DepositStatus.HELD);

        // segunda confirmação (duplo clique) é recusada
        assertThatThrownBy(() -> bookingService.confirmPaymentReceived(owner.getId(), bookingId, DirectChannel.CASH))
                .isInstanceOf(IllegalStateException.class);

        assertThat(actions(bookingId)).contains(AuditAction.PAYMENT_RECEIVED);
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(renter.getId()))
                .anyMatch(n -> n.getType() == NotificationType.PAYMENT_CONFIRMED && n.getBody().toLowerCase().contains("multicaixa express"));

        // comprovativo: o arrendatário e o dono descarregam; diz que foi pago ao dono
        var file = receiptService.receipt(owner.getId(), payment.getId());
        try (PDDocument doc = Loader.loadPDF(file.content())) {
            String text = new PDFTextStripper().getText(doc);
            assertThat(text).contains("Pago por", "Multicaixa Express", "Edson Manuel (dono)", "A Beeznoo não recebeu");
        }
        receiptService.receipt(renter.getId(), payment.getId());
        Profile stranger = profile("Outra Pessoa", UserRole.RENTER);
        assertThatThrownBy(() -> receiptService.receipt(stranger.getId(), payment.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void adminConfirmaEmNomeDoDono_exigeMotivoEMeio() {
        UUID bookingId = requestAndAccept();
        contractService.acceptAsRenter(renter.getId(), bookingId);

        assertThatThrownBy(() -> bookingService.confirmPayment(admin.getId(), bookingId, null, DirectChannel.CASH))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("motivo");
        assertThatThrownBy(() -> bookingService.confirmPayment(admin.getId(), bookingId, "Dono ligou", null))
                .isInstanceOf(IllegalArgumentException.class);

        bookingService.confirmPayment(admin.getId(), bookingId, "O dono confirmou por telefone", DirectChannel.CASH);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.ACTIVE);
        assertThat(paymentRepository.findFirstByBookingIdOrderByCreatedAtDesc(bookingId).orElseThrow()
                .getConfirmedBy().getId()).isEqualTo(admin.getId());
        assertThat(actions(bookingId)).contains(AuditAction.PAYMENT_CONFIRMED_MANUALLY);
    }

    @Test
    void cauçãoDevolvidaPeloDono_concluiAReserva() {
        UUID bookingId = paidBooking();
        deliverAndReturn(bookingId);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.RETURNED);

        // o dono é avisado para devolver a caução (a equipa não: não é ela que a tem)
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(owner.getId()))
                .anyMatch(n -> n.getType() == NotificationType.BOOKING_RETURNED && n.getTitle().contains("devolve a caução"));
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(admin.getId()))
                .noneMatch(n -> n.getType() == NotificationType.BOOKING_RETURNED);
        assertThat(depositService.queue(org.springframework.data.domain.Pageable.ofSize(20)).getContent())
                .noneMatch(d -> d.bookingId().equals(bookingId));

        assertThatThrownBy(() -> bookingService.decideDepositAsOwner(renter.getId(), bookingId, null, null))
                .isInstanceOf(AccessDeniedException.class);

        bookingService.decideDepositAsOwner(owner.getId(), bookingId, BigDecimal.ZERO, null);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);
        var deposit = depositRepository.findByBookingId(bookingId).orElseThrow();
        assertThat(deposit.getStatus()).isEqualTo(DepositStatus.RELEASED);
        assertThat(deposit.getDecidedBy().getId()).isEqualTo(owner.getId());
        assertThat(actions(bookingId)).contains(AuditAction.DEPOSIT_RETURNED_BY_OWNER);
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(renter.getId()))
                .anyMatch(n -> n.getType() == NotificationType.DEPOSIT_RELEASED && n.getBody().contains("7 dias"));
    }

    @Test
    void retencaoPeloDono_exigeMotivo_eOArrendatarioPodeContestar() {
        UUID bookingId = paidBooking();
        deliverAndReturn(bookingId);

        assertThatThrownBy(() -> bookingService.decideDepositAsOwner(owner.getId(), bookingId, new BigDecimal("5000"), " "))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("motivo");
        assertThatThrownBy(() -> bookingService.decideDepositAsOwner(owner.getId(), bookingId, new BigDecimal("25000"), "x"))
                .isInstanceOf(IllegalArgumentException.class);

        // valor com mais de 2 casas decimais: arredonda (antes dava 500)
        bookingService.decideDepositAsOwner(owner.getId(), bookingId, new BigDecimal("4999.999"), "Risco na lente");
        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);
        var deposit = depositRepository.findByBookingId(bookingId).orElseThrow();
        assertThat(deposit.getStatus()).isEqualTo(DepositStatus.WITHHELD);
        assertThat(deposit.getWithheldAmount()).isEqualByComparingTo("5000");

        // o dono não pode "contestar" a própria decisão; o arrendatário pode, dentro de 7 dias
        assertThatThrownBy(() -> incidentService.report(owner.getId(), bookingId, IncidentType.OTHER, "x", List.of()))
                .isInstanceOf(IllegalStateException.class);
        incidentService.report(renter.getId(), bookingId, IncidentType.OTHER, "O risco já existia na entrega", List.of());
        assertThat(status(bookingId)).isEqualTo(BookingStatus.DISPUTED);

        // a equipa medeia e fecha a reserva (a caução já foi decidida, não há dinheiro na Beeznoo)
        bookingService.complete(admin.getId(), bookingId, "Fotos da entrega mostram o risco: o dono devolve os 5.000 Kz");
        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);

        // só se contesta uma vez: depois da mediação a reserva fica fechada
        assertThatThrownBy(() -> incidentService.report(renter.getId(), bookingId, IncidentType.OTHER, "Outra vez", List.of()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("7 dias");
    }

    @Test
    void contestacaoForaDoPrazo_eRecusada() {
        UUID bookingId = paidBooking();
        deliverAndReturn(bookingId);
        bookingService.decideDepositAsOwner(owner.getId(), bookingId, null, null);
        var deposit = depositRepository.findByBookingId(bookingId).orElseThrow();
        deposit.setDecidedAt(OffsetDateTime.now().minusDays(8));
        depositRepository.saveAndFlush(deposit);

        assertThatThrownBy(() -> incidentService.report(renter.getId(), bookingId, IncidentType.OTHER, "Não recebi", List.of()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void semCaucao_concluiQuandoADevolucaoEConfirmada() {
        item.setDepositAmount(BigDecimal.ZERO);
        itemRepository.saveAndFlush(item);
        UUID bookingId = paidBooking();
        deliverAndReturn(bookingId);
        assertThat(status(bookingId)).isEqualTo(BookingStatus.COMPLETED);
    }

    @Test
    void comissoes_donoVeOQueDeve_eAdminRegistaQueRecebeu() {
        UUID first = paidBooking();
        UUID second = paidBooking();

        var mine = paymentService.myCommissions(owner.getId());
        assertThat(mine.due()).isEqualByComparingTo("2400");
        assertThat(mine.lines()).hasSize(2).allMatch(l -> l.commissionSettledAt() == null);

        var due = paymentService.commissionsDue().stream().filter(d -> d.ownerId().equals(owner.getId())).findFirst().orElseThrow();
        assertThat(due.payments()).isEqualTo(2);
        assertThat(due.amount()).isEqualByComparingTo("2400");

        var settled = paymentService.settleCommissions(admin.getId(), owner.getId(), "Transferência de 2.400 Kz recebida");
        assertThat(settled.payments()).isEqualTo(2);
        assertThat(paymentService.myCommissions(owner.getId()).due()).isEqualByComparingTo("0");
        assertThat(paymentService.commissionsDue()).noneMatch(d -> d.ownerId().equals(owner.getId()));
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(owner.getId()))
                .anyMatch(a -> a.getAction() == AuditAction.COMMISSION_SETTLED);

        assertThatThrownBy(() -> paymentService.settleCommissions(admin.getId(), owner.getId(), null))
                .isInstanceOf(IllegalStateException.class);
        assertThat(List.of(first, second)).allMatch(id -> status(id) == BookingStatus.ACTIVE);
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
        bookingService.confirmPaymentReceived(owner.getId(), bookingId, DirectChannel.CASH);
        return bookingId;
    }

    private void deliverAndReturn(UUID bookingId) {
        checklistService.create(owner.getId(), bookingId, ChecklistType.DELIVERY, "Tudo ok", twoPhotos());
        checklistService.confirm(renter.getId(), bookingId, ChecklistType.DELIVERY);
        checklistService.create(renter.getId(), bookingId, ChecklistType.RETURN, "Tudo ok", twoPhotos());
        checklistService.confirm(owner.getId(), bookingId, ChecklistType.RETURN);
    }

    private List<AuditAction> actions(UUID bookingId) {
        return auditLogRepository.findByEntityIdOrderByCreatedAtAsc(bookingId).stream().map(a -> a.getAction()).toList();
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
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.save(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(role).isVerified(true).build());
    }
}
