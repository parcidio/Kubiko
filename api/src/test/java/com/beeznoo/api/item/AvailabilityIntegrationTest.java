package com.beeznoo.api.item;

import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.item.dto.AvailabilityDtos.*;
import com.beeznoo.api.item.dto.ItemDtos.ItemSummaryResponse;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.dto.ItemDtos.ItemOrder;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.AvailabilityService;
import com.beeznoo.api.item.service.ItemService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;

/** Gap #8: bloqueios do dono, datas ocupadas por reservas, pedir/aceitar e filtro por datas no Explorar. */
@SpringBootTest
@Testcontainers
@Transactional
class AvailabilityIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final AtomicInteger PHONE = new AtomicInteger(923700000);

    @Autowired AvailabilityService availabilityService;
    @Autowired BookingService bookingService;
    @Autowired ItemService itemService;
    @Autowired BookingRepository bookingRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycRepository;

    private Profile owner;
    private Profile renter;
    private Item item;
    // longe no futuro, para não colidir com outros testes nem com "hoje"
    private final LocalDate base = LocalDate.now(ZoneId.of("Africa/Luanda")).plusDays(40);

    @BeforeEach
    void setup() {
        owner = verified(UserRole.OWNER, "Dono Datas");
        renter = verified(UserRole.RENTER, "Arrendatário Datas");
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.save(Item.builder()
                .owner(owner).category(category).title("Canon R6 datas " + UUID.randomUUID())
                .condition(ItemCondition.GOOD).pricePerDay(new BigDecimal("5000.00"))
                .depositAmount(new BigDecimal("20000.00")).province("Luanda").build());
    }

    @Test
    void donoBloqueia_eAparecemComoBlockedSemNota() {
        BlockResponse block = availabilityService.createBlock(owner.getId(), item.getId(),
                new CreateBlockRequest(base, base.plusDays(2), "  Viagem a Benguela  "));

        assertThat(block.note()).isEqualTo("Viagem a Benguela");
        assertThat(availabilityService.listBlocks(owner.getId(), item.getId())).extracting(BlockResponse::id).containsExactly(block.id());

        AvailabilityResponse a = availabilityService.availability(item.getId(), base.minusDays(5), base.plusDays(10));
        assertThat(a.unavailable()).containsExactly(new UnavailableRange(base, base.plusDays(2), UnavailableReason.BLOCKED));
    }

    @Test
    void bloqueio_validacoesEDono() {
        var ok = new CreateBlockRequest(base, base, null);
        assertThatThrownBy(() -> availabilityService.createBlock(renter.getId(), item.getId(), ok))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> availabilityService.listBlocks(renter.getId(), item.getId()))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> availabilityService.createBlock(owner.getId(), item.getId(),
                new CreateBlockRequest(base, base.minusDays(1), null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> availabilityService.createBlock(owner.getId(), item.getId(),
                new CreateBlockRequest(LocalDate.now().minusDays(3), base, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> availabilityService.createBlock(owner.getId(), item.getId(),
                new CreateBlockRequest(base, base.plusDays(400), null))).isInstanceOf(IllegalArgumentException.class);

        // um dia só (início = fim) é válido
        assertThat(availabilityService.createBlock(owner.getId(), item.getId(), ok).startDate()).isEqualTo(base);
    }

    @Test
    void pedirReserva_emDiasBloqueados_eRecusado_masODiaDeDevolucaoPodeSerOPrimeiroBloqueado() {
        availabilityService.createBlock(owner.getId(), item.getId(), new CreateBlockRequest(base.plusDays(5), base.plusDays(7), null));

        assertThatThrownBy(() -> request(base.plusDays(3), base.plusDays(6)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("bloqueou");
        assertThatThrownBy(() -> request(base.plusDays(7), base.plusDays(9)))
                .isInstanceOf(IllegalStateException.class);

        // devolve no dia 5 (fim exclusivo): não usa nenhum dia bloqueado
        assertThat(request(base.plusDays(2), base.plusDays(5))).isNotNull();
        // começa no dia a seguir ao último bloqueado
        assertThat(request(base.plusDays(8), base.plusDays(10))).isNotNull();
    }

    @Test
    void aceitar_depoisDeODonoBloquear_eRecusado() {
        UUID bookingId = request(base, base.plusDays(3));
        availabilityService.createBlock(owner.getId(), item.getId(), new CreateBlockRequest(base.plusDays(1), base.plusDays(1), null));

        assertThatThrownBy(() -> bookingService.accept(owner.getId(), bookingId, null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Bloqueaste");
    }

    @Test
    void reservaAceite_ocupaDiasSemODiaDeDevolucao_eImpedeBloqueio() {
        UUID bookingId = request(base, base.plusDays(3));
        bookingService.accept(owner.getId(), bookingId, null);

        AvailabilityResponse a = availabilityService.availability(item.getId(), base, base.plusDays(10));
        assertThat(a.unavailable()).containsExactly(new UnavailableRange(base, base.plusDays(2), UnavailableReason.BOOKED));

        assertThatThrownBy(() -> availabilityService.createBlock(owner.getId(), item.getId(),
                new CreateBlockRequest(base.plusDays(2), base.plusDays(4), null)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("reserva aceite");
        // o dia de devolução está livre para bloquear
        assertThat(availabilityService.createBlock(owner.getId(), item.getId(),
                new CreateBlockRequest(base.plusDays(3), base.plusDays(4), null))).isNotNull();
    }

    @Test
    void pedidoPendente_naoOcupa_eDisputaOcupa() {
        UUID pending = request(base, base.plusDays(2));
        assertThat(availabilityService.availability(item.getId(), base, base.plusDays(5)).unavailable()).isEmpty();

        var booking = bookingRepository.findById(pending).orElseThrow();
        booking.setStatus(BookingStatus.DISPUTED);
        bookingRepository.saveAndFlush(booking);
        assertThat(availabilityService.availability(item.getId(), base, base.plusDays(5)).unavailable())
                .extracting(UnavailableRange::reason).containsExactly(UnavailableReason.BOOKED);
    }

    @Test
    void desbloquear_libertaAsDatas_eSoODonoPode() {
        BlockResponse block = availabilityService.createBlock(owner.getId(), item.getId(), new CreateBlockRequest(base, base.plusDays(1), null));
        assertThatThrownBy(() -> availabilityService.deleteBlock(renter.getId(), item.getId(), block.id()))
                .isInstanceOf(AccessDeniedException.class);

        availabilityService.deleteBlock(owner.getId(), item.getId(), block.id());

        assertThat(availabilityService.availability(item.getId(), base, base.plusDays(3)).unavailable()).isEmpty();
        assertThat(request(base, base.plusDays(2))).isNotNull();
    }

    @Test
    void janelaDaDisponibilidade_eRecortadaEValidada() {
        availabilityService.createBlock(owner.getId(), item.getId(), new CreateBlockRequest(base, base.plusDays(20), null));

        var a = availabilityService.availability(item.getId(), base.plusDays(5), base.plusDays(7));
        assertThat(a.unavailable()).containsExactly(new UnavailableRange(base.plusDays(5), base.plusDays(7), UnavailableReason.BLOCKED));

        assertThatThrownBy(() -> availabilityService.availability(item.getId(), base, base.plusDays(400)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> availabilityService.availability(item.getId(), base, base.minusDays(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> availabilityService.availability(UUID.randomUUID(), null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void explorar_filtraPorDatasLivres() {
        availabilityService.createBlock(owner.getId(), item.getId(), new CreateBlockRequest(base.plusDays(10), base.plusDays(12), null));
        UUID accepted = request(base, base.plusDays(3));
        bookingService.accept(owner.getId(), accepted, null);

        assertThat(search(base.plusDays(4), base.plusDays(8))).contains(item.getId());     // livre
        assertThat(search(base.plusDays(3), base.plusDays(5))).contains(item.getId());     // começa no dia de devolução
        assertThat(search(base.plusDays(1), base.plusDays(4))).doesNotContain(item.getId()); // reserva aceite
        assertThat(search(base.plusDays(9), base.plusDays(11))).doesNotContain(item.getId()); // bloqueado
        assertThat(search(null, null)).contains(item.getId());                             // sem datas: todos

        assertThatThrownBy(() -> search(base, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> search(base, base)).isInstanceOf(IllegalArgumentException.class);
    }

    // ─── apoio ───

    private List<UUID> search(LocalDate start, LocalDate end) {
        return itemService.listActive(null, false, ItemOrder.RECENT, start, end, PageRequest.of(0, 100))
                .map(ItemSummaryResponse::id).getContent();
    }

    private UUID request(LocalDate start, LocalDate end) {
        return bookingService.create(renter.getId(), new CreateBookingRequest(item.getId(), start, end, null)).id();
    }

    private Profile verified(UserRole role, String name) {
        Profile p = profileRepository.save(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(role).isVerified(true).build());
        kycRepository.save(KycVerification.builder().profile(p).accountType(AccountType.INDIVIDUAL)
                .status(KycStatus.APPROVED).submittedAt(OffsetDateTime.now()).build());
        return p;
    }
}
