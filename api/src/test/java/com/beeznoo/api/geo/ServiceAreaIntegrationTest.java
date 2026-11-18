package com.beeznoo.api.geo;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.geo.dto.GeoDtos.Heatmap;
import com.beeznoo.api.geo.dto.GeoDtos.HeatmapScope;
import com.beeznoo.api.geo.entity.LocationContext;
import com.beeznoo.api.geo.entity.LocationEvent;
import com.beeznoo.api.geo.repository.LocationEventRepository;
import com.beeznoo.api.geo.service.HeatmapService;
import com.beeznoo.api.geo.service.LocationService;
import com.beeznoo.api.geo.service.ServiceAreaService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Zonas de serviço, gate de publicar e mapa (decisoes-produto.md 2026-11-17, itens 4–6). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class ServiceAreaIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final AtomicInteger PHONE = new AtomicInteger(924700000);

    // Luanda (Mutamba), Caxito (Bengo), Huambo (fora do piloto)
    private static final double[] LUANDA = {-8.81563, 13.23142};
    private static final double[] CAXITO = {-8.58, 13.66};
    private static final double[] HUAMBO = {-12.7761, 15.7392};

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired LocationEventRepository eventRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired ServiceAreaService serviceAreaService;
    @Autowired LocationService locationService;
    @Autowired HeatmapService heatmapService;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.beeznoo.api.geo.scheduler.LocationRetentionScheduler retentionScheduler;
    @Autowired EntityManager em;

    private Profile owner;
    private Profile admin;
    private UUID categoryId;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", UserRole.OWNER, null);
        approveKyc(owner);
        admin = profile("Equipa Beeznoo", UserRole.ADMIN, null);
        categoryId = categoryRepository.findBySlug("fotografia")
                .map(Category::getId)
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()).getId());
    }

    // ---- Pertença ----

    @Test
    void luandaECaxitoEstaoNoPilotoHuamboNao() {
        assertThat(serviceAreaService.findActiveContaining(LUANDA[0], LUANDA[1]))
                .hasValueSatisfying(a -> assertThat(a.getProvince()).isEqualTo("Luanda"));
        assertThat(serviceAreaService.findActiveContaining(CAXITO[0], CAXITO[1]))
                .hasValueSatisfying(a -> {
                    assertThat(a.getProvince()).isEqualTo("Bengo");
                    assertThat(a.getCity()).isEqualTo("Caxito");
                });
        assertThat(serviceAreaService.findActiveContaining(HUAMBO[0], HUAMBO[1])).isEmpty();
        // Luanda → Huambo ~ 520 km em linha reta
        assertThat(ServiceAreaService.distanceKm(LUANDA[0], LUANDA[1], HUAMBO[0], HUAMBO[1])).isBetween(480.0, 560.0);
    }

    @Test
    void zonaPublicaSoMostraAtivasEAdminGereComAuditoria() throws Exception {
        String body = """
                {"province":"Benguela","city":"Lobito","lat":-12.3644,"lng":13.5361,"radiusKm":25,"active":false}""";
        String created = mvc.perform(post("/api/v1/admin/service-areas").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.radiusKm").value(25))
                .andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(created.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1"));

        mvc.perform(post("/api/v1/admin/service-areas").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body.replace("Lobito", "lobito")))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/admin/service-areas").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/service-areas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.city == 'Lobito')]").isEmpty())
                .andExpect(jsonPath("$[?(@.city == 'Caxito')]").isNotEmpty());

        mvc.perform(put("/api/v1/admin/service-areas/" + id).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body.replace("false", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        mvc.perform(get("/api/v1/service-areas")).andExpect(jsonPath("$[?(@.city == 'Lobito')]").isNotEmpty());
        assertThat(serviceAreaService.findActiveContaining(-12.36, 13.54)).isPresent();
        assertThat(auditLogRepository.findAll()).filteredOn(a -> id.equals(a.getEntityId()))
                .extracting(a -> a.getAction()).containsOnly(AuditAction.SERVICE_AREA_CHANGED).hasSize(2);
    }

    // ---- Gate de publicar ----

    @Test
    void publicarDentroDaZona_criaItemERegistaEvento() throws Exception {
        mvc.perform(publish(location(LUANDA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        List<LocationEvent> events = eventRepository.findByUserIdAndContextOrderByCreatedAtDesc(owner.getId(), LocationContext.PUBLISH);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().isInArea()).isTrue();
        assertThat(events.getFirst().getLat()).isEqualByComparingTo("-8.82");   // nunca a posição exata
        assertThat(events.getFirst().getLng()).isEqualByComparingTo("13.23");
    }

    @Test
    void publicarEmCaxito_permitido() throws Exception {
        mvc.perform(publish(location(CAXITO))).andExpect(status().isCreated());
    }

    @Test
    void publicarForaDaZona_403AreaNotAvailable_semItemMasComEvento() throws Exception {
        long before = itemRepository.count();
        mvc.perform(publish(location(HUAMBO)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("area_not_available"));

        assertThat(itemRepository.count()).isEqualTo(before);
        List<LocationEvent> events = eventRepository.findByUserIdAndContextOrderByCreatedAtDesc(owner.getId(), LocationContext.PUBLISH);
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().isInArea()).isFalse();
        assertThat(events.getFirst().getAreaId()).isNull();
    }

    @Test
    void publicarSemLocalizacao_422LocationRequired() throws Exception {
        mvc.perform(publish(""))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("location_required"));
        mvc.perform(publish(",\"location\":{\"lat\":95,\"lng\":13.2}")).andExpect(status().isBadRequest());
        assertThat(eventRepository.findByUserIdAndContextOrderByCreatedAtDesc(owner.getId(), LocationContext.PUBLISH)).isEmpty();
    }

    // ---- Consentimento na conta (2026-11-18): outro dispositivo não pergunta outra vez ----

    @Test
    void consentimentoFicaNaContaEPublicaComZonaGuardada() throws Exception {
        mvc.perform(get("/api/v1/me/location").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consented").value(false))
                .andExpect(jsonPath("$.storedZoneUsable").value(false));
        mvc.perform(post("/api/v1/me/location").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lat\":" + LUANDA[0] + ",\"lng\":" + LUANDA[1] + ",\"context\":\"APP\"}"))
                .andExpect(status().isOk());

        // "outro dispositivo": só o token, sem nada no browser
        mvc.perform(get("/api/v1/profiles/me").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.consented").value(true))
                .andExpect(jsonPath("$.location.area.province").value("Luanda"))
                .andExpect(jsonPath("$.location.storedZoneUsable").value(true))
                .andExpect(jsonPath("$.location.lat").doesNotExist());

        // publicar sem localização do browser usa a zona guardada e não inventa um evento PUBLISH
        mvc.perform(publish("")).andExpect(status().isCreated());
        assertThat(eventRepository.findByUserIdAndContextOrderByCreatedAtDesc(owner.getId(), LocationContext.PUBLISH)).isEmpty();

        // a zona guardada caduca ao fim de 30 dias
        em.flush();
        jdbc.update("UPDATE profiles SET last_location_at = now() - interval '31 days' WHERE id = ?", owner.getId());
        em.clear();
        mvc.perform(publish(""))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("location_required"));
    }

    @Test
    void zonaEscolhidaAMao_soAtivaENaoContraOBrowserRecente() throws Exception {
        UUID luanda = serviceAreaService.findActiveContaining(LUANDA[0], LUANDA[1]).orElseThrow().getId();
        mvc.perform(publish(",\"areaId\":\"" + luanda + "\"")).andExpect(status().isCreated());
        mvc.perform(publish(",\"areaId\":\"" + UUID.randomUUID() + "\""))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("area_not_available"));
        // sem coordenadas não há evento (o mapa não recebe pontos inventados)
        assertThat(eventRepository.findByUserIdAndContextOrderByCreatedAtDesc(owner.getId(), LocationContext.PUBLISH)).isEmpty();

        // o browser acabou de dizer Huambo: escolher Luanda à mão não passa
        mvc.perform(publish(location(HUAMBO))).andExpect(status().isForbidden());
        mvc.perform(publish(",\"areaId\":\"" + luanda + "\""))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("area_not_available"));
    }

    @Test
    void reativarExigeZona() throws Exception {
        Item item = itemRepository.saveAndFlush(Item.builder()
                .owner(owner).category(categoryRepository.getReferenceById(categoryId)).title("Sony A7 III")
                .condition(ItemCondition.LIKE_NEW).pricePerDay(new BigDecimal("5000.00")).status(ItemStatus.INACTIVE).build());
        String url = "/api/v1/items/" + item.getId() + "/activate";

        mvc.perform(patch(url).header("Authorization", bearer(owner)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("location_required"));
        mvc.perform(patch(url).header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{" + location(HUAMBO).substring(1) + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("area_not_available"));
        mvc.perform(patch(url).header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{" + location(LUANDA).substring(1) + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void elegibilidadeSoConsulta() throws Exception {
        mvc.perform(get("/api/v1/me/publish-eligibility").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.allowed").value(false))
                .andExpect(jsonPath("$.reason").value("location_required"))
                .andExpect(jsonPath("$.areas.length()").value(2));
        mvc.perform(get("/api/v1/me/publish-eligibility?lat=-12.77&lng=15.73").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.reason").value("area_not_available"));
        mvc.perform(get("/api/v1/me/publish-eligibility?lat=-8.84&lng=13.29").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.allowed").value(true));
        assertThat(eventRepository.count()).isZero();
    }

    // ---- Localização ----

    @Test
    void enviarLocalizacao_guardaArredondadoNoPerfil() throws Exception {
        mvc.perform(post("/api/v1/me/location").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lat\":-8.83912,\"lng\":13.28945,\"accuracyM\":20,\"context\":\"APP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inServiceArea").value(true))
                .andExpect(jsonPath("$.area.province").value("Luanda"));
        mvc.perform(post("/api/v1/me/location").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":-8.8,\"lng\":200,\"context\":\"APP\"}"))
                .andExpect(status().isBadRequest());

        em.flush();
        em.clear();
        Profile saved = profileRepository.findById(owner.getId()).orElseThrow();
        assertThat(saved.getLastLat()).isEqualByComparingTo("-8.84");
        assertThat(saved.getLastLng()).isEqualByComparingTo("13.29");
        assertThat(saved.getInServiceArea()).isTrue();
        assertThat(saved.getLocationConsentAt()).isNotNull();
        // a BD também só tem 2 casas
        assertThat(jdbc.queryForObject("SELECT scale(last_lat) FROM profiles WHERE id = ?", Integer.class, owner.getId()))
                .isEqualTo(2);
    }

    @Test
    void registoGuardaSoAPrimeiraEKycSubstitui() {
        Profile p = profile("Ana Domingos", UserRole.RENTER, null);
        locationService.record(p, LocationContext.SIGNUP, -8.9, 13.2);
        locationService.record(p, LocationContext.SIGNUP, -8.5, 13.6);
        locationService.record(p, LocationContext.KYC, HUAMBO[0], HUAMBO[1]);
        assertThat(p.getSignupLat()).isEqualByComparingTo("-8.90");
        assertThat(p.getKycLat()).isEqualByComparingTo("-12.78");
        assertThat(p.getInServiceArea()).isFalse();
    }

    @Test
    void retencaoApagaLocalizacoesComMaisDe12Meses() {
        String insert = "INSERT INTO location_events (user_id, context, lat, lng, in_area, created_at) "
                + "VALUES (?, 'APP', -8.84, 13.29, true, now() - CAST(? AS interval))";
        jdbc.update(insert, owner.getId(), "13 months");
        jdbc.update(insert, owner.getId(), "11 months");
        jdbc.update(insert, owner.getId(), "0 days");

        assertThat(retentionScheduler.purgeOld()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM location_events WHERE user_id = ?", Long.class,
                owner.getId())).isEqualTo(2);
        // continua sem se poder alterar
        assertThatThrownBy(() -> jdbc.update("UPDATE location_events SET lat = 0 WHERE user_id = ?", owner.getId()))
                .hasMessageContaining("append-only");
    }

    // ---- Mapa ----

    @Test
    void mapaEscondeCelulasComMenosDe3() throws Exception {
        Heatmap before = heatmapService.heatmap(HeatmapScope.KYC_SUBMITTED);

        // Namibe: 3 pessoas na mesma célula → aparece; Lubango: 2 → escondida; 1 sem localização
        for (int i = 0; i < 3; i++) located("Namibe " + i, "Namibe", -15.19, 12.15);
        for (int i = 0; i < 2; i++) located("Lubango " + i, "Huíla", -14.92, 13.49);
        Profile none = profile("Sem Local", UserRole.RENTER, "Luanda");
        submitKyc(none);
        // sem KYC: não conta
        Profile noKyc = profile("Sem KYC", UserRole.RENTER, "Namibe");
        locationService.record(noKyc, LocationContext.APP, -15.19, 12.15);
        em.flush();

        Heatmap after = heatmapService.heatmap(HeatmapScope.KYC_SUBMITTED);
        assertThat(after.cellSizeDeg()).isEqualTo(0.05);
        assertThat(after.minCount()).isEqualTo(3);
        assertThat(after.cells()).anySatisfy(c -> {
            assertThat(c.lat()).isEqualTo(-15.175);
            assertThat(c.lng()).isEqualTo(12.175);
            assertThat(c.count()).isEqualTo(3);
        });
        assertThat(after.cells()).allMatch(c -> c.count() >= 3);
        assertThat(after.suppressed() - before.suppressed()).isEqualTo(2);
        assertThat(after.outsideAreas() - before.outsideAreas()).isEqualTo(5);
        assertThat(after.withoutLocation() - before.withoutLocation()).isEqualTo(1);
        assertThat(after.byProvince()).anySatisfy(p -> {
            assertThat(p.province()).isEqualTo("Namibe");
            assertThat(p.count()).isEqualTo(3);
        });
        assertThat(after.byProvince()).noneMatch(p -> p.province().equals("Huíla"));

        mvc.perform(get("/api/v1/admin/metrics/heatmap?scope=KYC_SUBMITTED").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cellSizeDeg").value(0.05))
                .andExpect(jsonPath("$.cells[?(@.lat == -15.175)].count").value(3));
        mvc.perform(get("/api/v1/admin/metrics/heatmap").header("Authorization", bearer(owner)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/metrics/heatmap?scope=SIGNUP").header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
    }

    // ---- Helpers ----

    private MockHttpServletRequestBuilder publish(String locationJson) {
        return post("/api/v1/items").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"Canon EOS R5","categoryId":"%s","itemCondition":"LIKE_NEW","pricePerDay":5000%s}"""
                        .formatted(categoryId, locationJson));
    }

    private static String location(double[] point) {
        return ",\"location\":{\"lat\":" + point[0] + ",\"lng\":" + point[1] + "}";
    }

    private void located(String name, String province, double lat, double lng) {
        Profile p = profile(name, UserRole.RENTER, province);
        submitKyc(p);
        locationService.record(p, LocationContext.KYC, lat, lng);
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private void approveKyc(Profile p) {
        kycVerificationRepository.saveAndFlush(KycVerification.builder()
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private void submitKyc(Profile p) {
        kycVerificationRepository.saveAndFlush(KycVerification.builder()
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.PENDING)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private Profile profile(String name, UserRole role, String province) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .province(province).role(role).isVerified(true).build());
    }
}
