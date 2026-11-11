package com.beeznoo.api.booking;

import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.AvailabilityService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.notification.entity.NotificationType;
import com.beeznoo.api.notification.repository.NotificationRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;

/** Gap #11: pedido sem resposta expira em 24 h ou no dia de levantamento. */
@SpringBootTest
@Testcontainers
@Transactional
class BookingExpiryIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final AtomicInteger PHONE = new AtomicInteger(923800000);

    @Autowired BookingService bookingService;
    @Autowired AvailabilityService availabilityService;
    @Autowired BookingRepository bookingRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;

    private Profile owner;
    private Profile renter;
    private Item item;
    private final LocalDate today = LocalDate.now(ZoneId.of("Africa/Luanda"));

    @BeforeEach
    void setup() {
        owner = verified(UserRole.OWNER, "Dono Prazo");
        renter = verified(UserRole.RENTER, "Arrendatário Prazo");
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        item = itemRepository.save(Item.builder()
                .owner(owner).category(category).title("Sony FX3 " + UUID.randomUUID())
                .condition(ItemCondition.GOOD).pricePerDay(new BigDecimal("8000.00"))
                .depositAmount(new BigDecimal("30000.00")).province("Luanda").build());
    }

    @Test
    void pedidoCom25h_expira_eAvisaAsDuasPartes() {
        UUID id = request(today.plusDays(10), today.plusDays(12));
        ageHours(id, 25);

        assertThat(bookingService.findOverduePendingIds()).contains(id);
        bookingService.expire(id);

        assertThat(status(id)).isEqualTo(BookingStatus.EXPIRED);
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(renter.getId()))
                .extracting(n -> n.getType()).contains(NotificationType.BOOKING_EXPIRED);
        assertThat(notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(owner.getId()))
                .extracting(n -> n.getType()).contains(NotificationType.BOOKING_EXPIRED);
    }

    @Test
    void pedidoRecente_naoExpira() {
        UUID id = request(today.plusDays(10), today.plusDays(12));
        ageHours(id, 23);

        assertThat(bookingService.findOverduePendingIds()).doesNotContain(id);
        bookingService.expire(id); // chamado à toa (corrida com o agendador): não muda nada
        assertThat(status(id)).isEqualTo(BookingStatus.PENDING_OWNER);
    }

    @Test
    void pedidoRecente_cujoDiaDeLevantamentoJaPassou_expira() {
        UUID id = request(today, today.plusDays(2));
        // simula "ontem": o dia de levantamento ficou para trás antes das 24 h
        bookingRepository.flush();
        jdbc.update("UPDATE bookings SET start_date = ?, end_date = ? WHERE id = ?",
                today.minusDays(1), today.plusDays(1), id);
        em.clear();

        assertThat(bookingService.findOverduePendingIds()).contains(id);
        bookingService.expire(id);
        assertThat(status(id)).isEqualTo(BookingStatus.EXPIRED);
    }

    @Test
    void levantamentoHoje_aindaNaoExpira() {
        UUID id = request(today, today.plusDays(1));
        assertThat(bookingService.findOverduePendingIds()).doesNotContain(id);
    }

    @Test
    void aceitarForaDoPrazo_eRecusado_mesmoAntesDoAgendador() {
        UUID id = request(today.plusDays(10), today.plusDays(12));
        ageHours(id, 30);

        assertThatThrownBy(() -> bookingService.accept(owner.getId(), id, null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("expirou");

        bookingService.expire(id);
        assertThatThrownBy(() -> bookingService.accept(owner.getId(), id, null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("expirou");
        assertThatThrownBy(() -> bookingService.cancel(renter.getId(), id, null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void reservaAceite_naoExpira_eExpiradaNaoOcupaDatas() {
        UUID accepted = request(today.plusDays(10), today.plusDays(12));
        bookingService.accept(owner.getId(), accepted, null);
        ageHours(accepted, 48);
        assertThat(bookingService.findOverduePendingIds()).doesNotContain(accepted);
        bookingService.expire(accepted);
        assertThat(status(accepted)).isEqualTo(BookingStatus.ACCEPTED);

        UUID stale = request(today.plusDays(20), today.plusDays(22));
        ageHours(stale, 30);
        bookingService.expire(stale);
        assertThat(availabilityService.availability(item.getId(), today.plusDays(20), today.plusDays(22)).unavailable()).isEmpty();
        // as datas ficam livres para um pedido novo
        assertThat(request(today.plusDays(20), today.plusDays(22))).isNotNull();
    }

    // ─── apoio ───

    private UUID request(LocalDate start, LocalDate end) {
        return bookingService.create(renter.getId(), new CreateBookingRequest(item.getId(), start, end, null)).id();
    }

    private void ageHours(UUID bookingId, int hours) {
        bookingRepository.flush();
        jdbc.update("UPDATE bookings SET created_at = ? WHERE id = ?", OffsetDateTime.now().minusHours(hours), bookingId);
        em.clear(); // o contexto de persistência tinha o created_at antigo
    }

    private BookingStatus status(UUID id) {
        bookingRepository.flush(); // enviar o que está pendente antes de limpar o contexto
        em.clear();
        return bookingRepository.findById(id).map(Booking::getStatus).orElseThrow();
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
