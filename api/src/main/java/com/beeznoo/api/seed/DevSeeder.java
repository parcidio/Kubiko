package com.beeznoo.api.seed;

import com.beeznoo.api.booking.dto.BookingDtos.BookingActionRequest;
import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.claim.entity.IncidentType;
import com.beeznoo.api.claim.service.IncidentService;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.handover.entity.ChecklistType;
import com.beeznoo.api.handover.service.ChecklistService;
import com.beeznoo.api.item.dto.ItemDtos.PublishItemRequest;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.service.ItemService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.repository.AccountRepository;
import com.beeznoo.api.transaction.service.PaymentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dados de demonstração para desenvolvimento. Só corre com o perfil "seed" e termina a aplicação no fim.
 * <p>
 * Usa os serviços reais (publicar, reservar, aceitar, pagar, concluir) em vez de SQL directo,
 * para o ledger, os pagamentos e os estados ficarem coerentes com as regras do backend.
 * Idempotente: se o admin de seed já existir, não faz nada.
 * <p>
 * NUNCA activar o perfil "seed" em staging ou produção — as passwords são conhecidas.
 */
@Slf4j
@Component
@org.springframework.context.annotation.Profile("seed")
public class DevSeeder implements ApplicationRunner {

    static final String ADMIN_PHONE = "+244900000000";

    private final ProfileRepository profileRepository;
    private final AccountRepository accountRepository;
    private final KycVerificationRepository kycVerificationRepository;
    private final CategoryRepository categoryRepository;
    private final ItemService itemService;
    private final BookingService bookingService;
    private final PaymentService paymentService;
    private final ContractService contractService;
    private final ChecklistService checklistService;
    private final IncidentService incidentService;
    private final ApplicationContext context;
    private final String password;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final Map<String, UUID> items = new HashMap<>();

    public DevSeeder(ProfileRepository profileRepository, AccountRepository accountRepository,
                     KycVerificationRepository kycVerificationRepository,
                     CategoryRepository categoryRepository, ItemService itemService,
                     BookingService bookingService, PaymentService paymentService,
                     ContractService contractService, ChecklistService checklistService,
                     IncidentService incidentService,
                     ApplicationContext context, @Value("${SEED_PASSWORD:beeznoo123}") String password) {
        this.profileRepository = profileRepository;
        this.accountRepository = accountRepository;
        this.kycVerificationRepository = kycVerificationRepository;
        this.categoryRepository = categoryRepository;
        this.itemService = itemService;
        this.bookingService = bookingService;
        this.paymentService = paymentService;
        this.contractService = contractService;
        this.checklistService = checklistService;
        this.incidentService = incidentService;
        this.context = context;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (profileRepository.existsByPhone(ADMIN_PHONE)) {
            log.info("Seed: já existe ({}), nada a fazer.", ADMIN_PHONE);
        } else {
            seed();
            log.info("Seed concluído. Password de todas as contas: a de SEED_PASSWORD (por omissão beeznoo123).");
        }
        // Perfil de seed não serve pedidos: sai assim que acaba
        System.exit(SpringApplication.exit(context, () -> 0));
    }

    private void seed() throws Exception {
        // ── Pessoas ──────────────────────────────────────────────────────────
        UUID admin = person("Equipa Beeznoo", ADMIN_PHONE, "admin@beeznoo.test", UserRole.ADMIN, "Talatona", null);
        UUID edson = person("Edson Manuel", "+244900000001", "edson@beeznoo.test", UserRole.OWNER, "Talatona", "4.90");
        UUID luzia = person("Luzia Kiala Produções", "+244900000002", "luzia@beeznoo.test", UserRole.OWNER, "Maianga", "4.70");
        UUID paulo = person("Paulo Neto", "+244900000003", "paulo@beeznoo.test", UserRole.BOTH, "Kilamba", "4.80");
        UUID ana = person("Ana Domingos", "+244900000004", "ana@beeznoo.test", UserRole.RENTER, "Miramar", null);
        UUID mauro = person("Mauro Fernandes", "+244900000005", "mauro@beeznoo.test", UserRole.RENTER, "Viana", null);
        UUID telma = person("Telma Sebastião", "+244900000006", "telma@beeznoo.test", UserRole.RENTER, "Ingombota", null);

        // ── Equipamento (caução = menor entre 10% do valor e 3 diárias) ──────
        item(edson, "sony", "fotografia", "Sony A7 III com lente 28-70mm", ItemCondition.LIKE_NEW, 25_000, 75_000, "Talatona",
                "Full-frame, ótima em pouca luz. Inclui 2 baterias, carregador, cartão SD 128 GB e mala.");
        item(edson, "canon", "fotografia", "Canon EOS R6 + RF 24-105mm f/4", ItemCondition.LIKE_NEW, 30_000, 90_000, "Talatona",
                "Estabilização no corpo, vídeo 4K. Ideal para casamentos. Inclui 2 baterias e mala Peli.");
        item(edson, "ronin", "video", "DJI Ronin RS3 (estabilizador)", ItemCondition.GOOD, 12_000, 36_000, "Talatona",
                "Aguenta câmaras até 3 kg. Inclui placa de engate rápido e cabos.");
        item(edson, "godox", "iluminacao", "Godox AD600 Pro (flash de estúdio)", ItemCondition.GOOD, 10_000, 30_000, "Talatona",
                "600 Ws com bateria. Inclui refletor, softbox octogonal 120 cm e disparador X2T.");
        item(luzia, "rode", "audio", "Rode Wireless GO II (2 microfones)", ItemCondition.NEW, 8_000, 24_000, "Maianga",
                "Sistema sem fios com 2 emissores. Para entrevistas e vlogs. Inclui lapelas e cabos.");
        item(luzia, "jbl", "audio", "JBL PartyBox 710", ItemCondition.LIKE_NEW, 15_000, 45_000, "Maianga",
                "800 W, luzes, entrada de microfone e guitarra. Para festas até 150 pessoas.");
        item(luzia, "bmpcc", "video", "Blackmagic Pocket Cinema 6K", ItemCondition.GOOD, 35_000, 105_000, "Maianga",
                "RAW 6K, encaixe EF. Inclui 3 baterias NP-F, monitor e SSD 1 TB.");
        item(luzia, "aputure", "iluminacao", "Aputure 300d II com softbox", ItemCondition.GOOD, 14_000, 42_000, "Maianga",
                "LED 300 W, luz do dia. Inclui Light Dome II e tripé.");
        item(luzia, "epson", "eventos", "Projetor Epson EB-X51 + tela 3 m", ItemCondition.GOOD, 12_000, 36_000, "Maianga",
                "3.800 lumens, HDMI. Para conferências e casamentos. Inclui tela com tripé e cabo de 10 m.");
        item(paulo, "fuji", "fotografia", "Fujifilm X-T4 + XF 18-55mm", ItemCondition.LIKE_NEW, 18_000, 54_000, "Kilamba",
                "Simulações de filme, ecrã articulado. Inclui 3 baterias.");
        item(paulo, "zoom", "audio", "Gravador Zoom H6", ItemCondition.FAIR, 7_000, 21_000, "Kilamba",
                "6 pistas, com cápsula XY. Tem sinais de uso na carcaça, funciona a 100%.");
        item(paulo, "tenda", "eventos", "Tenda 6 x 3 m com laterais", ItemCondition.GOOD, 9_000, 27_000, "Kilamba",
                "Estrutura de alumínio, montagem em 20 min. Inclui pesos e laterais.");
        item(edson, "drone", "video", "DJI Mini 4 Pro (drone)", ItemCondition.NEW, 20_000, 60_000, "Talatona",
                "4K/60, 249 g. Inclui comando com ecrã e 3 baterias. Voo só com licença do arrendatário.");
        // Pausado pelo dono — não aparece em Explorar
        UUID nikon = item(paulo, "nikon", "fotografia", "Nikon Z6 II (corpo)", ItemCondition.GOOD, 22_000, 66_000, "Kilamba",
                "Em manutenção até ao fim do mês.");
        itemService.deactivate(paulo, nikon);

        // ── Reservas em todos os estados ─────────────────────────────────────
        // À espera do dono
        book(ana, "sony", 5, 8, "Casamento em Talatona no sábado. Entrega: levanto no local do dono, às 10:00.");
        book(mauro, "jbl", 3, 4, "Aniversário em Viana. Entrega: peço entrega em Viana, às 15:00.");

        // Aceite, ainda sem referência
        UUID r3 = book(telma, "canon", 6, 9, "Sessão de moda para uma marca local.");
        bookingService.accept(edson, r3, new BookingActionRequest("Levanta em Talatona, perto do Belas Shopping."));

        // Aceite, com referência emitida
        UUID r4 = book(ana, "godox", 2, 4, "Retratos em estúdio.");
        bookingService.accept(edson, r4, null);
        contractService.acceptAsRenter(ana, r4);
        paymentService.createReference(ana, r4);

        // Paga, à espera da entrega
        UUID r11 = book(ana, "drone", 1, 3, "Imagens aéreas de um evento na Ilha.");
        pay(admin, edson, ana, r11);

        // Paga e entregue (em curso)
        UUID r5 = book(mauro, "ronin", -1, 2, "Videoclipe no Mussulo.");
        pay(admin, edson, mauro, r5);
        deliver(edson, mauro, r5);

        // Devolvida, caução à espera da equipa
        UUID r12 = book(paulo, "jbl", -6, -4, "Festa de fim de ano da empresa.");
        pay(admin, luzia, paulo, r12);
        deliver(luzia, paulo, r12);
        giveBack(paulo, luzia, r12);

        // Concluídas (caução devolvida)
        UUID r6 = book(ana, "rode", -12, -9, "Entrevistas para um documentário.");
        pay(admin, luzia, ana, r6);
        deliver(luzia, ana, r6);
        giveBack(ana, luzia, r6);
        bookingService.complete(admin, r6, "Seed: devolvido em bom estado");

        UUID r7 = book(telma, "aputure", -20, -17, "Campanha de fotografia de produto.");
        pay(admin, luzia, telma, r7);
        deliver(luzia, telma, r7);
        giveBack(telma, luzia, r7);
        bookingService.complete(admin, r7, "Seed: devolvido em bom estado");

        // Recusada pelo dono
        UUID r8 = book(telma, "bmpcc", 10, 12, "Curta-metragem.");
        bookingService.cancel(luzia, r8, new BookingActionRequest("Já está alugado nessas datas — tenho livre a partir de dia 20."));

        // Cancelada pelo arrendatário
        UUID r9 = book(mauro, "zoom", 7, 8, "Podcast.");
        bookingService.cancel(mauro, r9, null);

        // Problema reportado (Paulo também aluga)
        UUID r10 = book(paulo, "epson", -3, 1, "Conferência no Kilamba.");
        pay(admin, luzia, paulo, r10);
        deliver(luzia, paulo, r10);
        incidentService.report(paulo, r10, IncidentType.DAMAGE,
                "A tela rasgou num canto durante a montagem. O projetor está bom.", null);

        log.info("Seed: 7 pessoas, {} equipamentos, 12 reservas.", items.size());
    }

    // Dono aceita (gera o contrato), arrendatário aceita o contrato, equipa confirma o pagamento
    private void pay(UUID admin, UUID owner, UUID renter, UUID bookingId) {
        bookingService.accept(owner, bookingId, null);
        contractService.acceptAsRenter(renter, bookingId);
        bookingService.confirmPayment(admin, bookingId, "Seed: pagamento de demonstração");
    }

    // Entrega: o dono regista, o arrendatário confirma
    private void deliver(UUID owner, UUID renter, UUID bookingId) {
        checklistService.create(owner, bookingId, ChecklistType.DELIVERY, "Entregue completo, sem marcas.", seedPhotos());
        checklistService.confirm(renter, bookingId, ChecklistType.DELIVERY);
    }

    // Devolução: o arrendatário regista, o dono confirma
    private void giveBack(UUID renter, UUID owner, UUID bookingId) {
        checklistService.create(renter, bookingId, ChecklistType.RETURN, "Devolvido no estado em que foi entregue.", seedPhotos());
        checklistService.confirm(owner, bookingId, ChecklistType.RETURN);
    }

    // JPEG real e pequeno (o servidor recodifica as imagens) — as checklists exigem 2 fotos; vão para o B2 configurado
    private static List<MultipartFile> seedPhotos() {
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(64, 48, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        try {
            javax.imageio.ImageIO.write(img, "jpeg", out);
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
        byte[] jpeg = out.toByteArray();
        return List.of(new SeedFile("frente.jpg", jpeg), new SeedFile("verso.jpg", jpeg));
    }

    private record SeedFile(String filename, byte[] content) implements MultipartFile {
        public String getName() { return "photos"; }
        public String getOriginalFilename() { return filename; }
        public String getContentType() { return "image/jpeg"; }
        public boolean isEmpty() { return content.length == 0; }
        public long getSize() { return content.length; }
        public byte[] getBytes() { return content; }
        public InputStream getInputStream() { return new ByteArrayInputStream(content); }
        public void transferTo(File dest) { throw new UnsupportedOperationException(); }
    }

    private UUID person(String name, String phone, String email, UserRole role, String city, String rating) {
        Profile profile = profileRepository.save(Profile.builder()
                .fullName(name)
                .phone(phone)
                .email(email)
                .passwordHash(encoder.encode(password))
                .role(role)
                .province("Luanda")
                .city(city)
                .isVerified(true) // telefone confirmado (não é KYC)
                .ratingAvg(rating == null ? null : new BigDecimal(rating))
                .build());
        accountRepository.save(Account.builder().profile(profile).build());
        // KYC aprovado sem documentos: só para o seed conseguir publicar e reservar (o gate exige-o)
        kycVerificationRepository.save(KycVerification.builder()
                .profile(profile)
                .accountType(AccountType.INDIVIDUAL)
                .status(KycStatus.APPROVED)
                .submittedAt(OffsetDateTime.now())
                .reviewedAt(OffsetDateTime.now())
                .build());
        return profile.getId();
    }

    private UUID item(UUID owner, String key, String categorySlug, String title, ItemCondition condition,
                      long pricePerDay, long deposit, String city, String description) throws Exception {
        UUID categoryId = categoryRepository.findBySlug(categorySlug)
                .orElseThrow(() -> new IllegalStateException("Categoria em falta: " + categorySlug))
                .getId();
        UUID id = itemService.publish(owner, new PublishItemRequest(
                title, description, categoryId, condition,
                BigDecimal.valueOf(pricePerDay), BigDecimal.valueOf(deposit), "Luanda", city)).id();
        items.put(key, id);
        return id;
    }

    /** Datas relativas a hoje: book(ana, "sony", 5, 8) → levanta daqui a 5 dias, devolve daqui a 8. */
    private UUID book(UUID renter, String itemKey, int startOffset, int endOffset, String message) {
        LocalDate today = LocalDate.now();
        return bookingService.create(renter, new CreateBookingRequest(
                items.get(itemKey), today.plusDays(startOffset), today.plusDays(endOffset), message)).id();
    }
}
