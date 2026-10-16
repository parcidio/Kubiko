package com.beeznoo.api.transaction;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.dto.PaymentDtos.PaymentResponse;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.entity.EntryType;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import com.beeznoo.api.transaction.gateway.PaymentGateway;
import com.beeznoo.api.transaction.gateway.PaymentGateway.GatewayStatus;
import com.beeznoo.api.transaction.gateway.PaymentGateway.IssuedReference;
import com.beeznoo.api.transaction.repository.AccountRepository;
import com.beeznoo.api.transaction.repository.LedgerEntryRepository;
import com.beeznoo.api.transaction.repository.PaymentRepository;
import com.beeznoo.api.transaction.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

@SpringBootTest
@Testcontainers
@Transactional
class PaymentServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean PaymentGateway gateway;

    @Autowired PaymentService paymentService;
    @Autowired BookingService bookingService;
    @Autowired PaymentRepository paymentRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired LedgerEntryRepository ledgerEntryRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProfileRepository profileRepository;

    // 3 dias × 5.000 = 15.000 · taxa 8% = 1.200 · caução 20.000 → 36.200
    private static final BigDecimal TOTAL = new BigDecimal("15000.00");
    private static final BigDecimal DEPOSIT = new BigDecimal("20000.00");
    private static final BigDecimal FEE = new BigDecimal("1200.00");
    private static final BigDecimal AMOUNT = new BigDecimal("36200.00");

    private static final AtomicInteger PHONE = new AtomicInteger(923200000);

    private Profile owner;
    private Profile renter;
    private Profile admin;
    private Item item;
    private Booking booking;

    @BeforeEach
    void setup() {
        owner = profile("Dono Equipamento", UserRole.OWNER);
        renter = profile("Arrendatário", UserRole.RENTER);
        admin = profile("Admin Beeznoo", UserRole.ADMIN);

        // O arrendatário começa sem saldo: o pagamento por referência é que o financia
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

        booking = booking(BookingStatus.ACCEPTED);

        given(gateway.provider()).willReturn("TEST");
        given(gateway.issueReference(any(), any()))
                .willAnswer(inv -> new IssuedReference("00000", String.format("%09d", PHONE.incrementAndGet())));
        given(gateway.checkStatus(any())).willReturn(GatewayStatus.pending());
    }

    @Test
    void createReference_reservaAceite_emiteReferenciaComTaxaECaucao() {
        PaymentResponse p = paymentService.createReference(renter.getId(), booking.getId());

        assertThat(p.status()).isEqualTo("AWAITING_PAYMENT");
        assertThat(p.entity()).isEqualTo("00000");
        assertThat(p.reference()).hasSize(9);
        assertThat(p.rentalAmount()).isEqualByComparingTo(TOTAL);
        assertThat(p.serviceFee()).isEqualByComparingTo(FEE);
        assertThat(p.depositAmount()).isEqualByComparingTo(DEPOSIT);
        assertThat(p.amount()).isEqualByComparingTo(AMOUNT);
        assertThat(p.expiresAt()).isAfter(OffsetDateTime.now().plusHours(23));
    }

    @Test
    void createReference_chamadaDuasVezes_devolveAMesmaReferencia() {
        PaymentResponse first = paymentService.createReference(renter.getId(), booking.getId());
        PaymentResponse second = paymentService.createReference(renter.getId(), booking.getId());

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(paymentRepository.findAll()).filteredOn(p -> p.getBooking().getId().equals(booking.getId())).hasSize(1);
    }

    @Test
    void createReference_referenciaExpirada_marcaExpiradaEEmiteNova() {
        PaymentResponse first = paymentService.createReference(renter.getId(), booking.getId());
        Payment stored = paymentRepository.findById(first.id()).orElseThrow();
        stored.setExpiresAt(OffsetDateTime.now().minusMinutes(1));

        PaymentResponse second = paymentService.createReference(renter.getId(), booking.getId());

        assertThat(second.id()).isNotEqualTo(first.id());
        assertThat(paymentRepository.findById(first.id()).orElseThrow().getStatus()).isEqualTo(PaymentStatus.EXPIRED);
    }

    @Test
    void createReference_reservaAindaPendente_lancaIllegalState() {
        Booking pending = booking(BookingStatus.PENDING_OWNER);

        assertThatThrownBy(() -> paymentService.createReference(renter.getId(), pending.getId()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void createReference_porQuemNaoEArrendatario_lancaAccessDenied() {
        assertThatThrownBy(() -> paymentService.createReference(owner.getId(), booking.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void check_gatewayAindaSemPagamento_continuaAEspera() {
        PaymentResponse p = paymentService.createReference(renter.getId(), booking.getId());

        PaymentResponse checked = paymentService.check(renter.getId(), p.id());

        assertThat(checked.status()).isEqualTo("AWAITING_PAYMENT");
        assertThat(bookingRepository.findById(booking.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.ACCEPTED);
    }

    @Test
    void check_gatewayConfirma_liquidaLedgerEReservaFicaActive() {
        PaymentResponse p = paymentService.createReference(renter.getId(), booking.getId());
        given(gateway.checkStatus(any())).willReturn(GatewayStatus.paid("TX-1"));

        PaymentResponse checked = paymentService.check(renter.getId(), p.id());

        assertThat(checked.status()).isEqualTo("CONFIRMED");
        assertThat(checked.confirmedAt()).isNotNull();
        assertThat(bookingRepository.findById(booking.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.ACTIVE);

        Account renterAccount = accountRepository.findByProfileId(renter.getId()).orElseThrow();
        Account ownerAccount = accountRepository.findByProfileId(owner.getId()).orElseThrow();
        // tudo o que entrou saiu: taxa debitada, aluguer pago ao dono, caução retida
        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo(DEPOSIT);
        assertThat(ownerAccount.getAvailableBalance()).isEqualByComparingTo(TOTAL);

        for (EntryType type : new EntryType[]{EntryType.TOPUP, EntryType.SERVICE_FEE, EntryType.HOLD,
                EntryType.DEPOSIT_HOLD, EntryType.PAYMENT_DEBIT, EntryType.PAYMENT_CREDIT}) {
            assertThat(ledgerEntryRepository.existsByBookingIdAndType(booking.getId(), type)).as(type.name()).isTrue();
        }
    }

    @Test
    void check_referenciaExpirada_marcaExpiradaSemLiquidar() {
        PaymentResponse p = paymentService.createReference(renter.getId(), booking.getId());
        paymentRepository.findById(p.id()).orElseThrow().setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        given(gateway.checkStatus(any())).willReturn(GatewayStatus.paid("TX-2"));

        PaymentResponse checked = paymentService.check(renter.getId(), p.id());

        assertThat(checked.status()).isEqualTo("EXPIRED");
        assertThat(ledgerEntryRepository.existsByBookingIdAndType(booking.getId(), EntryType.TOPUP)).isFalse();
    }

    @Test
    void adminConfirmaManualmente_liquidaReferenciaAberta() {
        PaymentResponse p = paymentService.createReference(renter.getId(), booking.getId());

        bookingService.confirmPayment(admin.getId(), booking.getId());

        assertThat(paymentRepository.findById(p.id()).orElseThrow().getStatus()).isEqualTo(PaymentStatus.CONFIRMED);
        assertThat(bookingRepository.findById(booking.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.ACTIVE);
    }

    @Test
    void donoCancelaReservaAceite_cancelaReferenciaAberta() {
        PaymentResponse p = paymentService.createReference(renter.getId(), booking.getId());

        bookingService.cancel(owner.getId(), booking.getId(), null);

        assertThat(paymentRepository.findById(p.id()).orElseThrow().getStatus()).isEqualTo(PaymentStatus.CANCELLED);
    }

    @Test
    void donoAceita_arrendatarioSemSaldo_passaAAccepted() {
        Booking pending = booking(BookingStatus.PENDING_OWNER);

        bookingService.accept(owner.getId(), pending.getId(), null);

        assertThat(bookingRepository.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(BookingStatus.ACCEPTED);
        assertThat(ledgerEntryRepository.existsByBookingIdAndType(pending.getId(), EntryType.HOLD)).isFalse();
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.save(Profile.builder()
                .fullName(name)
                .phone("+244" + PHONE.incrementAndGet())
                .passwordHash("$2a$10$hash")
                .role(role)
                .isVerified(true)
                .build());
    }

    // Datas diferentes por reserva para não colidir com a verificação de sobreposição
    private Booking booking(BookingStatus status) {
        int offset = (int) (bookingRepository.count() * 10) + 1;
        return bookingRepository.save(Booking.builder()
                .item(item)
                .renter(renter)
                .owner(owner)
                .startDate(LocalDate.now().plusDays(offset))
                .endDate(LocalDate.now().plusDays(offset + 3))
                .totalPrice(TOTAL)
                .depositAmount(DEPOSIT)
                .status(status)
                .build());
    }
}
