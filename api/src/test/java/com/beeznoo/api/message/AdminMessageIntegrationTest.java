package com.beeznoo.api.message;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.auth.service.WhatsAppOtpClient;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.message.dto.MessageDtos.*;
import com.beeznoo.api.message.entity.DeliveryStatus;
import com.beeznoo.api.message.entity.MessageChannel;
import com.beeznoo.api.message.service.MessageDispatcher;
import com.beeznoo.api.message.service.MessageService;
import com.beeznoo.api.notification.email.ResendEmailSender;
import com.beeznoo.api.profile.entity.AccountType;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Admin › Mensagens (decisoes-produto.md 2026-11-17, decisão 2). Gateways simulados. */
@SpringBootTest(properties = {"app.messages.max-whatsapp-recipients=3", "app.messages.whatsapp-hourly-cap=3"})
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class AdminMessageIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923600000);

    @MockitoBean WhatsAppOtpClient whatsApp;
    @MockitoBean OmbalaSmsService sms;
    @MockitoBean ResendEmailSender email;

    @Autowired MessageService messageService;
    @Autowired MessageDispatcher dispatcher;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired JwtService jwtService;
    @Autowired MockMvc mvc;

    private Profile admin;
    private Profile ana;      // angolana, verificada, com email
    private Profile john;     // estrangeiro (+351), sem email
    private Profile carla;    // registo por acabar (telefone não confirmado)

    @BeforeEach
    void setup() {
        when(whatsApp.configured()).thenReturn(true);
        when(sms.configured()).thenReturn(true);
        when(email.isEnabled()).thenReturn(true);
        admin = profile("Equipa Beeznoo", "+244" + PHONE.incrementAndGet(), null, UserRole.ADMIN, true);
        ana = profile("Ana Maria Domingos", "+244" + PHONE.incrementAndGet(), "ana@exemplo.ao", UserRole.RENTER, true);
        john = profile("John Smith", "+351912345678", null, UserRole.OWNER, true);
        carla = profile("Carla Neto", "+244" + PHONE.incrementAndGet(), "carla@exemplo.ao", UserRole.RENTER, false);
        approveKyc(ana);
    }

    @Test
    void modelosPredefinidos_semeados_eNaoSeApagam() {
        List<TemplateResponse> templates = messageService.templates();
        assertThat(templates).filteredOn(TemplateResponse::predefined).hasSize(6)
                .extracting(TemplateResponse::key)
                .contains("kyc_incomplete", "kyc_approved", "booking_pending_owner", "welcome", "publish_first_item",
                        "area_not_available");
        assertThat(templates).allSatisfy(t -> assertThat(t.body().toLowerCase()).doesNotContain("seguro"));

        UUID predefined = templates.getFirst().id();
        assertThatThrownBy(() -> messageService.deleteTemplate(predefined))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("predefined_template");

        TemplateResponse own = messageService.createTemplate(admin.getId(),
                new TemplateRequest("Lembrete", null, "Olá {{nome}}", MessageChannel.WHATSAPP));
        messageService.deleteTemplate(own.id());
        assertThat(messageService.templates()).extracting(TemplateResponse::id).doesNotContain(own.id());
    }

    @Test
    void sms_ignoraEstrangeiros_eContasPorConfirmar() {
        PreviewResponse preview = messageService.preview(new SendRequest(MessageChannel.SMS,
                users(ana, john, carla), null, null, "Olá {{primeiro_nome}}, tudo bem?"));
        assertThat(preview.recipients()).isEqualTo(3);
        assertThat(preview.reachable()).isEqualTo(1);
        assertThat(preview.skipped()).containsEntry("foreignSms", 1).containsEntry("unconfirmed", 1);
        assertThat(preview.sample().body()).isEqualTo("Olá Ana, tudo bem?");
        assertThat(preview.sample().subject()).isNull();
    }

    @Test
    void whatsapp_chegaAEstrangeiros_enviaEMarcaEntregas() {
        doThrow(new WhatsAppOtpClient.UnavailableException("Losambo 503")).when(whatsApp)
                .sendText(eq(john.getPhone()), anyString());

        SendResponse sent = messageService.send(admin.getId(), new SendRequest(MessageChannel.WHATSAPP,
                users(ana, john, carla), null, null, "Olá {{nome}}!"));
        assertThat(sent.recipients()).isEqualTo(3);
        assertThat(sent.reachable()).isEqualTo(2);
        verifyNoInteractions(sms); // nada sai antes do commit
        verify(whatsApp, never()).sendText(anyString(), anyString());

        dispatcher.dispatch(sent.id());

        verify(whatsApp).sendText(ana.getPhone(), "Olá Ana Maria Domingos!");
        MessageDetail detail = messageService.detail(sent.id());
        assertThat(detail.sent()).isEqualTo(1);
        assertThat(detail.failed()).isEqualTo(1);
        assertThat(detail.skipped()).isEqualTo(1);
        assertThat(detail.pending()).isZero();
        assertThat(detail.finishedAt()).isNotNull();
        assertThat(detail.deliveries()).allSatisfy(d -> {
            if (d.destinationMasked() != null) assertThat(d.destinationMasked()).contains("***");
        });
        assertThat(detail.deliveries()).filteredOn(d -> d.userId().equals(john.getId()))
                .singleElement().satisfies(d -> {
                    assertThat(d.status()).isEqualTo(DeliveryStatus.FAILED);
                    assertThat(d.error()).isEqualTo("Losambo 503");
                    assertThat(d.destinationMasked()).isEqualTo("+351912***678");
                });

        var logs = auditLogRepository.search("MESSAGE", sent.id(), AuditAction.MESSAGE_SENT, null,
                PageRequest.of(0, 10)).getContent();
        assertThat(logs).singleElement().satisfies(l -> assertThat(l.getMetadata()).containsEntry("channel", "WHATSAPP"));

        assertThat(messageService.list(0, 20).getContent()).extracting(MessageSummary::id).contains(sent.id());
    }

    @Test
    void email_usaModelo_escapaHtml_eIgnoraSemEmail() {
        UUID welcome = messageService.templates().stream().filter(t -> "welcome".equals(t.key())).findFirst()
                .orElseThrow().id();
        Profile hacker = profile("<b>Zé</b>", "+244" + PHONE.incrementAndGet(), "ze@exemplo.ao", UserRole.RENTER, true);

        SendResponse sent = messageService.send(admin.getId(), new SendRequest(MessageChannel.EMAIL,
                users(ana, john, hacker), welcome, null, null));
        assertThat(sent.reachable()).isEqualTo(2);
        dispatcher.dispatch(sent.id());

        verify(email).send(eq("ana@exemplo.ao"), eq("Que bom ter-te na Beeznoo"), contains("Olá Ana, que bom"), anyString());
        verify(email).send(eq("ze@exemplo.ao"), anyString(), argThat(html -> html.contains("&lt;b&gt;Zé&lt;/b&gt;")
                && !html.contains("<b>Zé")), anyString());
        assertThat(messageService.detail(sent.id()).deliveries())
                .filteredOn(d -> d.userId().equals(john.getId())).singleElement()
                .satisfies(d -> assertThat(d.error()).isEqualTo("no_email"));
    }

    @Test
    void limitesEErros_viaApi() throws Exception {
        // limite de WhatsApp nos testes = 3
        Profile p1 = profile("P Um", "+244" + PHONE.incrementAndGet(), null, UserRole.RENTER, true);
        Profile p2 = profile("P Dois", "+244" + PHONE.incrementAndGet(), null, UserRole.RENTER, true);
        String body = """
                {"channel":"WHATSAPP","audience":{"type":"USERS","userIds":["%s","%s","%s","%s"]},"body":"Olá"}
                """.formatted(ana.getId(), john.getId(), p1.getId(), p2.getId());
        mvc.perform(post("/api/v1/admin/messages").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("too_many_recipients"));

        mvc.perform(post("/api/v1/admin/messages").header("Authorization", bearer(ana))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        // sem texto nem modelo → 400; canal desconhecido → 400
        mvc.perform(post("/api/v1/admin/messages/preview").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"channel\":\"SMS\",\"audience\":{\"type\":\"ALL\"}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/admin/messages/preview").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"channel\":\"FAX\",\"audience\":{\"type\":\"ALL\"},\"body\":\"x\"}"))
                .andExpect(status().isBadRequest());

        // canal sem configuração → 503 channel_unavailable
        when(sms.configured()).thenReturn(false);
        mvc.perform(post("/api/v1/admin/messages").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channel\":\"SMS\",\"audience\":{\"type\":\"VERIFIED\"},\"body\":\"Olá\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("channel_unavailable"));

        // CITY com zona inexistente → 404 (ou 422 sem zona); nunca 500
        mvc.perform(post("/api/v1/admin/messages/preview").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channel\":\"WHATSAPP\",\"audience\":{\"type\":\"CITY\",\"areaId\":\"" + UUID.randomUUID() + "\"},\"body\":\"Olá\"}"))
                .andExpect(r -> assertThat(r.getResponse().getStatus()).isIn(404, 422));
    }

    @Test
    void limiteHorarioDeWhatsApp_porAdmin_429() throws Exception {
        // limite horário nos testes = 3; a Carla (por confirmar) não conta
        messageService.send(admin.getId(), new SendRequest(MessageChannel.WHATSAPP, users(ana, john, carla),
                null, null, "Olá"));
        String body = """
                {"channel":"WHATSAPP","audience":{"type":"USERS","userIds":["%s","%s"]},"body":"Outra vez"}
                """.formatted(ana.getId(), john.getId());
        mvc.perform(post("/api/v1/admin/messages").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("whatsapp_hourly_cap"));

        // o limite é por admin, e o email não conta
        Profile other = profile("Outra Admin", "+244" + PHONE.incrementAndGet(), null, UserRole.ADMIN, true);
        assertThat(messageService.send(other.getId(), new SendRequest(MessageChannel.WHATSAPP, users(ana, john),
                null, null, "Olá")).reachable()).isEqualTo(2);
        assertThat(messageService.send(admin.getId(), new SendRequest(MessageChannel.EMAIL, users(ana),
                null, null, "Olá")).reachable()).isEqualTo(1);
    }

    @Test
    void segmentoVerificados_eWhatsAppCheck() throws Exception {
        PreviewResponse preview = messageService.preview(new SendRequest(MessageChannel.WHATSAPP,
                new Audience(AudienceType.VERIFIED, null, null), null, null, "Olá"));
        assertThat(preview.recipients()).isEqualTo(1);

        when(whatsApp.hasWhatsApp("+351912345678")).thenReturn(true);
        mvc.perform(get("/api/v1/admin/messages/whatsapp-check").param("phone", "+351912345678")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasWhatsApp").value(true))
                .andExpect(jsonPath("$.international").value(true));
        mvc.perform(get("/api/v1/admin/messages/whatsapp-check").param("phone", "923")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
    }

    private static Audience users(Profile... profiles) {
        return new Audience(AudienceType.USERS, java.util.Arrays.stream(profiles).map(Profile::getId).toList(), null);
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private void approveKyc(Profile p) {
        kycVerificationRepository.saveAndFlush(KycVerification.builder()
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private Profile profile(String name, String phone, String mail, UserRole role, boolean phoneConfirmed) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone(phone).email(mail).passwordHash("$2a$10$hash")
                .role(role).adminRole(role == UserRole.ADMIN ? com.beeznoo.api.profile.entity.AdminRole.SUPER_ADMIN : null).isVerified(phoneConfirmed).build());
    }
}
