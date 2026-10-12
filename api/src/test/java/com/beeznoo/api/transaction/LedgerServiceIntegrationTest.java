package com.beeznoo.api.transaction;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.dto.LedgerDtos.*;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.entity.EntryType;
import com.beeznoo.api.transaction.repository.AccountRepository;
import com.beeznoo.api.transaction.service.LedgerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Testcontainers
@Transactional
class LedgerServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired LedgerService ledgerService;
    @Autowired AccountRepository accountRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProfileRepository profileRepository;

    private static final BigDecimal TOTAL = new BigDecimal("15000.00");
    private static final BigDecimal DEPOSIT = new BigDecimal("20000.00");

    private Account renterAccount;
    private Account ownerAccount;
    private Booking booking;

    @BeforeEach
    void setup() {
        Profile owner = profileRepository.save(Profile.builder()
                .fullName("Dono Equipamento")
                .phone("+244923100001")
                .passwordHash("$2a$10$hash")
                .role(UserRole.OWNER)
                .isVerified(true)
                .build());

        Profile renter = profileRepository.save(Profile.builder()
                .fullName("Arrendatário")
                .phone("+244923100002")
                .passwordHash("$2a$10$hash")
                .role(UserRole.RENTER)
                .isVerified(true)
                .build());

        ownerAccount = accountRepository.save(Account.builder()
                .profile(owner)
                .build());

        renterAccount = accountRepository.save(Account.builder()
                .profile(renter)
                .availableBalance(new BigDecimal("100000.00"))
                .build());

        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder()
                        .name("Fotografia")
                        .slug("fotografia")
                        .build()));

        Item item = itemRepository.save(Item.builder()
                .owner(owner)
                .category(category)
                .title("Canon EOS R5")
                .condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00"))
                .depositAmount(DEPOSIT)
                .build());

        booking = bookingRepository.save(Booking.builder()
                .item(item)
                .renter(renter)
                .owner(owner)
                .startDate(LocalDate.now().plusDays(1))
                .endDate(LocalDate.now().plusDays(4))
                .totalPrice(TOTAL)
                .depositAmount(DEPOSIT)
                .status(BookingStatus.ACCEPTED)
                .build());
    }

    @Test
    void hold_movesTotalAndDepositFromAvailableToHeld() {
        ledgerService.holdForBooking(booking.getId());

        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo("65000.00");
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo("35000.00");
        assertThat(entryTypes(renterAccount))
                .containsExactlyInAnyOrder(EntryType.HOLD.name(), EntryType.DEPOSIT_HOLD.name());
    }

    @Test
    void hold_withInsufficientBalance_throwsAndKeepsBalance() {
        renterAccount.setAvailableBalance(new BigDecimal("30000.00"));

        assertThatThrownBy(() -> ledgerService.holdForBooking(booking.getId()))
                .isInstanceOf(IllegalStateException.class);

        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo("30000.00");
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo("0.00");
        assertThat(entryTypes(renterAccount)).isEmpty();
    }

    @Test
    void release_returnsHeldToAvailable() {
        ledgerService.holdForBooking(booking.getId());

        ledgerService.releaseHold(booking.getId());

        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo("100000.00");
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo("0.00");
        assertThat(entryTypes(renterAccount))
                .contains(EntryType.HOLD_RELEASE.name(), EntryType.DEPOSIT_RETURN.name());
        assertThat(ledgerService.hasActiveHold(booking.getId())).isFalse();
    }

    @Test
    void confirmPayment_debitsRenterAndCreditsOwner_depositStaysHeld() {
        ledgerService.holdForBooking(booking.getId());

        ledgerService.confirmPayment(booking.getId());

        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo("65000.00");
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo(DEPOSIT);
        assertThat(ownerAccount.getAvailableBalance()).isEqualByComparingTo(TOTAL);
        assertThat(entryTypes(renterAccount)).contains(EntryType.PAYMENT_DEBIT.name());
        assertThat(entryTypes(ownerAccount)).containsExactly(EntryType.PAYMENT_CREDIT.name());
    }

    @Test
    void complete_returnsDepositToRenter() {
        ledgerService.holdForBooking(booking.getId());
        ledgerService.confirmPayment(booking.getId());

        ledgerService.completeBooking(booking.getId());

        assertThat(renterAccount.getAvailableBalance()).isEqualByComparingTo("85000.00");
        assertThat(renterAccount.getHeldBalance()).isEqualByComparingTo("0.00");
        assertThat(entryTypes(renterAccount)).contains(EntryType.DEPOSIT_RETURN.name());
    }

    @Test
    void statement_returnsEntriesOrderedByCreatedAtDesc() {
        ledgerService.holdForBooking(booking.getId());
        ledgerService.confirmPayment(booking.getId());
        ledgerService.completeBooking(booking.getId());

        Page<LedgerEntryResponse> page = ledgerService.getStatement(renterAccount.getId(), Pageable.ofSize(10));

        assertThat(page.getContent()).hasSize(4);
        assertThat(page.getContent())
                .extracting(LedgerEntryResponse::createdAt)
                .isSortedAccordingTo(Comparator.reverseOrder());
        // o movimento mais recente aparece primeiro
        assertThat(page.getContent().get(0).type()).isEqualTo(EntryType.DEPOSIT_RETURN.name());
    }

    @Test
    void adminAdjustment_changesBalanceAndRecordsAdjustmentEntry() {
        AccountResponse credited = ledgerService.adjust(ownerAccount.getId(),
                new AdjustmentRequest(new BigDecimal("5000.00"), "Bónus de boas-vindas"));

        assertThat(credited.availableBalance()).isEqualByComparingTo("5000.00");

        AccountResponse debited = ledgerService.adjust(ownerAccount.getId(),
                new AdjustmentRequest(new BigDecimal("-2000.00"), "Correcção de saldo"));

        assertThat(debited.availableBalance()).isEqualByComparingTo("3000.00");

        List<LedgerEntryResponse> entries = ledgerService
                .getStatement(ownerAccount.getId(), Pageable.ofSize(10)).getContent();
        assertThat(entries).hasSize(2).allMatch(e -> e.type().equals(EntryType.ADJUSTMENT.name()));
        assertThat(entries).extracting(LedgerEntryResponse::amount)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactlyInAnyOrder(new BigDecimal("5000.00"), new BigDecimal("2000.00"));
    }

    private List<String> entryTypes(Account account) {
        return ledgerService.getStatement(account.getId(), Pageable.ofSize(50))
                .map(LedgerEntryResponse::type)
                .getContent();
    }
}
