package com.beeznoo.api.notification.service;

import com.beeznoo.api.booking.dto.BookingDtos.BookingActionRequest;
import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.kyc.dto.KycDtos.ReviewRequest;
import com.beeznoo.api.kyc.entity.DocumentType;
import com.beeznoo.api.kyc.entity.KycAction;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.kyc.service.KycService;
import com.beeznoo.api.notification.config.NotificationProperties;
import com.beeznoo.api.notification.dto.NotificationDtos.NotificationResponse;
import com.beeznoo.api.notification.email.EmailTemplateRenderer;
import com.beeznoo.api.notification.email.ResendEmailSender;
import com.beeznoo.api.notification.entity.EmailStatus;
import com.beeznoo.api.notification.entity.Notification;
import com.beeznoo.api.notification.entity.NotificationType;
import com.beeznoo.api.notification.repository.NotificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.repository.AccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@SpringBootTest
@Testcontainers
@Transactional
class NotificationServiceIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923400000);
    private static final byte[] JPEG = com.beeznoo.api.common.storage.TestImages.JPEG;

    @Autowired NotificationService notificationService;
    @Autowired NotificationRepository notificationRepository;
    @Autowired EmailTemplateRenderer renderer;
    @Autowired BookingService bookingService;
    @Autowired KycService kycService;
    @Autowired ContractService contractService;
    @Autowired BookingRepository bookingRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;

    private Profile owner;
    private Profile renter;
    private Profile admin;
    private Item item;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", UserRole.OWNER, "edson@beeznoo.test");
        renter = profile("Ana Domingos", UserRole.RENTER, "ana@beeznoo.test");
        admin = profile("Equipa Beeznoo", UserRole.ADMIN, "equipa@beeznoo.test");
        approveKyc(renter);

        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.save(Item.builder()
                .owner(owner)
                .category(category)
                .title("Sony A7 III")
                .condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00"))
                .depositAmount(new BigDecimal("20000.00"))
                .build());
    }

    // ── Integração com os serviços ────────────────────────────────────────

    @Test
    void criarReserva_avisaODonoNaApp() {
        var res = bookingService.create(renter.getId(), new CreateBookingRequest(
                item.getId(), LocalDate.now().plusDays(5), LocalDate.now().plusDays(8), null));

        Notification n = only(owner);
        assertThat(n.getType()).isEqualTo(NotificationType.BOOKING_RECEIVED);
        assertThat(n.getTitle()).isEqualTo("Novo pedido: Sony A7 III");
        assertThat(n.getBody()).contains("Ana Domingos quer alugar", "15.000 Kz");
        assertThat(n.getBooking().getId()).isEqualTo(res.id());
        assertThat(n.getLinkPath()).isEqualTo("/pedidos");
        // email desligado nos testes: fica só na app
        assertThat(n.getEmailStatus()).isEqualTo(EmailStatus.SKIPPED);
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(renter.getId())).isEmpty();
    }

    @Test
    void aceitarPedido_avisaOArrendatarioComLinkParaPagar() {
        Booking booking = booking(BookingStatus.PENDING_OWNER);

        bookingService.accept(owner.getId(), booking.getId(), null);

        Notification n = only(renter);
        assertThat(n.getType()).isEqualTo(NotificationType.BOOKING_ACCEPTED);
        assertThat(n.getLinkPath()).isEqualTo("/reservas/" + booking.getId() + "/pagar");
    }

    @Test
    void donoRecusaPedido_avisaOArrendatarioComAMensagem() {
        Booking booking = booking(BookingStatus.PENDING_OWNER);

        bookingService.cancel(owner.getId(), booking.getId(), new BookingActionRequest("Já está reservada nesses dias"));

        Notification n = only(renter);
        assertThat(n.getType()).isEqualTo(NotificationType.BOOKING_REJECTED);
        assertThat(n.getBody()).contains("Mensagem do dono: Já está reservada nesses dias");
    }

    @Test
    void adminConfirmaPagamento_avisaArrendatarioEDono() {
        accountRepository.save(Account.builder().profile(owner).build());
        accountRepository.save(Account.builder().profile(renter).build());
        Booking booking = booking(BookingStatus.ACCEPTED);
        contractService.generateOnAccept(booking);
        contractService.acceptAsRenter(renter.getId(), booking.getId());

        bookingService.confirmPayment(admin.getId(), booking.getId());

        assertThat(only(renter).getType()).isEqualTo(NotificationType.PAYMENT_CONFIRMED);
        assertThat(only(renter).getBody()).contains("36.200 Kz"); // 15.000 + 8% + 20.000 de caução
        assertThat(only(owner).getType()).isEqualTo(NotificationType.PAYMENT_CONFIRMED);
    }

    @Test
    void kycSubmetido_avisaOsAdmins() {
        Profile user = profile("Mauro Fernandes", UserRole.RENTER, null);

        kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles());

        Notification n = only(admin);
        assertThat(n.getType()).isEqualTo(NotificationType.KYC_SUBMITTED);
        assertThat(n.getBody()).isEqualTo("Mauro Fernandes enviou documentos (particular).");
        assertThat(n.getLinkPath()).isEqualTo("/admin/verificacoes");
    }

    @Test
    void kycAprovado_avisaAPessoa() {
        Profile user = profile("Mauro Fernandes", UserRole.RENTER, null);
        var kyc = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles());

        kycService.review(admin.getId(), kyc.id(), new ReviewRequest(KycAction.APPROVE, null));

        assertThat(only(user).getType()).isEqualTo(NotificationType.KYC_APPROVED);
    }

    // ── Email (Resend simulado com MockRestServiceServer) ─────────────────

    @Test
    void email_comEnderecoDoPerfil_chamaResendEFicaSent() {
        Mail mail = mailWithEnabledEmail();
        mail.server.expect(requestTo("https://api.resend.test/emails"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer re_test"))
                .andExpect(header("Idempotency-Key", org.hamcrest.Matchers.notNullValue()))
                .andExpect(jsonPath("$.to[0]").value("ana@beeznoo.test"))
                .andExpect(jsonPath("$.subject").value("Identidade verificada"))
                .andExpect(jsonPath("$.html").value(org.hamcrest.Matchers.containsString("Olá, Ana.")))
                .andRespond(withSuccess("{\"id\":\"email_1\"}", org.springframework.http.MediaType.APPLICATION_JSON));

        mail.service.kycApproved(renter);
        assertThat(mail.events).hasSize(1);
        mail.dispatcher.deliver(mail.events.getFirst());

        mail.server.verify();
        Notification n = only(renter);
        assertThat(n.getEmailStatus()).isEqualTo(EmailStatus.SENT);
        assertThat(n.getEmailedAt()).isNotNull();
    }

    @Test
    void email_perfilSemEmail_ficaSkippedSemChamarResend() {
        Mail mail = mailWithEnabledEmail();
        Profile noEmail = profile("Telma Sebastião", UserRole.RENTER, null);

        assertThatCode(() -> mail.service.kycApproved(noEmail)).doesNotThrowAnyException();

        Notification n = only(noEmail);
        assertThat(n.getEmailStatus()).isEqualTo(EmailStatus.SKIPPED);
        assertThat(n.getEmailError()).isEqualTo("sem email");
        assertThat(mail.events).isEmpty();
        mail.server.verify(); // nenhum pedido ao Resend
    }

    @Test
    void email_resendDevolve429_ficaFailedSemLancar() {
        Mail mail = mailWithEnabledEmail();
        mail.server.expect(requestTo("https://api.resend.test/emails"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        mail.service.kycApproved(renter);
        assertThatCode(() -> mail.dispatcher.deliver(mail.events.getFirst())).doesNotThrowAnyException();

        Notification n = only(renter);
        assertThat(n.getEmailStatus()).isEqualTo(EmailStatus.FAILED);
        assertThat(n.getEmailError()).isEqualTo("HTTP 429");
    }

    @Test
    void template_escapaConteudoDoUtilizador() {
        String html = renderer.render("Ana", "<script>alert(1)</script>", List.of("Câmara <b>nova</b>"),
                "Ver reserva", "https://beeznoo.ao/reservas/1");

        assertThat(html).doesNotContain("<script>alert(1)</script>").contains("&lt;script&gt;");
        assertThat(html).doesNotContain("<b>nova</b>");
        // botão âmbar com texto verde (nunca branco sobre âmbar)
        assertThat(html).contains("background:#F0A22E;color:#0E2A1F");
    }

    @Test
    void formatos_kwanzasEPeriodo() {
        assertThat(Formats.kz(new BigDecimal("331000.00"))).isEqualTo("331.000 Kz");
        assertThat(Formats.kz(new BigDecimal("950"))).isEqualTo("950 Kz");
        assertThat(Formats.period(LocalDate.of(2026, 10, 16), LocalDate.of(2026, 10, 18))).isEqualTo("16 a 18 out");
        assertThat(Formats.period(LocalDate.of(2026, 10, 30), LocalDate.of(2026, 11, 2))).isEqualTo("30 out a 2 nov");
    }

    // ── Histórico ─────────────────────────────────────────────────────────

    @Test
    void historico_soMostraAsMinhasEMarcaComoLidas() {
        notificationService.kycApproved(renter);
        notificationService.kycInfoRequested(renter, "Envia o verso do BI");
        notificationService.kycApproved(owner);

        List<NotificationResponse> mine = notificationService.listMine(renter.getId());
        assertThat(mine).hasSize(2);
        assertThat(notificationService.countUnread(renter.getId())).isEqualTo(2);

        var ownersNotification = notificationService.listMine(owner.getId()).getFirst().id();
        assertThatThrownBy(() -> notificationService.markRead(renter.getId(), ownersNotification))
                .isInstanceOf(AccessDeniedException.class);

        notificationService.markRead(renter.getId(), mine.getFirst().id());
        assertThat(notificationService.countUnread(renter.getId())).isEqualTo(1);
        assertThat(notificationService.markAllRead(renter.getId())).isEqualTo(1);
        assertThat(notificationService.countUnread(renter.getId())).isZero();
        assertThat(notificationService.countUnread(owner.getId())).isEqualTo(1);
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    // NotificationService + EmailDispatcher com email ligado e o Resend simulado
    private record Mail(NotificationService service, EmailDispatcher dispatcher, MockRestServiceServer server,
                        List<EmailRequested> events) {}

    private Mail mailWithEnabledEmail() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ResendEmailSender sender = new ResendEmailSender(builder, new NotificationProperties(
                new NotificationProperties.Email(true, "https://api.resend.test", "re_test", "Beeznoo <noreply@beeznoo.ao>")));
        List<EmailRequested> events = new ArrayList<>();
        NotificationService service = new NotificationService(notificationRepository, profileRepository, renderer, sender,
                event -> events.add((EmailRequested) event), "https://beeznoo.test");
        return new Mail(service, new EmailDispatcher(notificationRepository, sender), server, events);
    }

    private Notification only(Profile p) {
        List<Notification> list = notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(p.getId());
        assertThat(list).as("notificações de " + p.getFullName()).hasSize(1);
        return list.getFirst();
    }

    private Booking booking(BookingStatus status) {
        int offset = (int) (bookingRepository.count() * 10) + 1;
        return bookingRepository.save(Booking.builder()
                .item(item)
                .renter(renter)
                .owner(owner)
                .startDate(LocalDate.now().plusDays(offset))
                .endDate(LocalDate.now().plusDays(offset + 3))
                .totalPrice(new BigDecimal("15000.00"))
                .depositAmount(new BigDecimal("20000.00"))
                .status(status)
                .build());
    }

    private Map<DocumentType, MultipartFile> individualFiles() {
        Map<DocumentType, MultipartFile> files = new EnumMap<>(DocumentType.class);
        for (DocumentType t : List.of(DocumentType.BI_FRONT, DocumentType.BI_BACK, DocumentType.SELFIE)) {
            files.put(t, new MockMultipartFile(t.name(), t.name() + ".jpg", "image/jpeg", JPEG));
        }
        return files;
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
