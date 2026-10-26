package com.beeznoo.api.review;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.item.dto.ItemDtos.ItemOrder;
import com.beeznoo.api.item.dto.ItemDtos.ItemSummaryResponse;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.ItemService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.review.dto.ReviewDtos.CreateReviewRequest;
import com.beeznoo.api.review.dto.ReviewDtos.ReviewResponse;
import com.beeznoo.api.review.service.ReviewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Testcontainers
@Transactional
class ReviewServiceIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923700000);

    @Autowired ReviewService reviewService;
    @Autowired ItemService itemService;
    @Autowired ProfileRepository profileRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired AuditLogRepository auditLogRepository;

    private Profile owner;
    private Profile renter;
    private Profile admin;
    private Category category;

    @BeforeEach
    void setup() {
        owner = profile("Edson Manuel", UserRole.OWNER);
        renter = profile("Ana Maria Domingos", UserRole.RENTER);
        admin = profile("Equipa Beeznoo", UserRole.ADMIN);
        category = categoryRepository.save(Category.builder().name("Teste").slug("teste-" + PHONE.get()).build());
    }

    @Test
    void renterReviewsCompletedBookingOnce() {
        Item item = item("Sony A7 III");
        Booking booking = booking(item, BookingStatus.COMPLETED);

        ReviewResponse review = reviewService.create(renter.getId(), booking.getId(),
                new CreateReviewRequest(5, "  Câmara impecável, entrega a horas.  "));

        assertThat(review.rating()).isEqualTo(5);
        assertThat(review.comment()).isEqualTo("Câmara impecável, entrega a horas.");
        assertThat(review.reviewerName()).isEqualTo("Ana D.");
        assertThat(reviewService.forBooking(owner.getId(), booking.getId())).isNotNull();
        assertThatThrownBy(() -> reviewService.create(renter.getId(), booking.getId(), new CreateReviewRequest(4, null)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void onlyRenterOfCompletedBookingCanReview() {
        Item item = item("Godox AD600");
        Booking active = booking(item, BookingStatus.IN_PROGRESS);
        Booking done = booking(item, BookingStatus.COMPLETED);

        assertThatThrownBy(() -> reviewService.create(renter.getId(), active.getId(), new CreateReviewRequest(5, null)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> reviewService.create(owner.getId(), done.getId(), new CreateReviewRequest(5, null)))
                .isInstanceOf(AccessDeniedException.class);
        Profile stranger = profile("Outra Pessoa", UserRole.RENTER);
        assertThatThrownBy(() -> reviewService.forBooking(stranger.getId(), done.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void listingCarriesRatingsRentalsAndOrders() {
        Item popular = item("JBL PartyBox");
        Item rated = item("Rode Wireless GO II");
        Item plain = item("Projetor Epson");
        reviewService.create(renter.getId(), booking(popular, BookingStatus.COMPLETED).getId(), new CreateReviewRequest(3, null));
        reviewService.create(renter.getId(), booking(popular, BookingStatus.COMPLETED).getId(), new CreateReviewRequest(4, null));
        booking(popular, BookingStatus.COMPLETED);
        reviewService.create(renter.getId(), booking(rated, BookingStatus.COMPLETED).getId(), new CreateReviewRequest(5, null));

        List<ItemSummaryResponse> byPopular = list(ItemOrder.POPULAR, false);
        assertThat(byPopular).extracting(ItemSummaryResponse::title)
                .containsSubsequence("JBL PartyBox", "Rode Wireless GO II", "Projetor Epson");
        ItemSummaryResponse first = byPopular.getFirst();
        assertThat(first.completedRentals()).isEqualTo(3);
        assertThat(first.ratingAverage()).isEqualTo(3.5);
        assertThat(first.ratingCount()).isEqualTo(2);

        assertThat(list(ItemOrder.RATING, false)).extracting(ItemSummaryResponse::title)
                .containsSubsequence("Rode Wireless GO II", "JBL PartyBox", "Projetor Epson");
        assertThat(list(ItemOrder.RECENT, false).stream().filter(i -> i.title().equals("Projetor Epson")).findFirst())
                .get().satisfies(i -> {
                    assertThat(i.ratingAverage()).isNull();
                    assertThat(i.ratingCount()).isZero();
                });
        assertThat(plain.getId()).isNotNull();
    }

    @Test
    void adminFeaturesItemWithAudit() {
        Item item = item("DJI Ronin RS3");
        item("Canon EOS R6");

        assertThat(itemService.setFeatured(admin.getId(), item.getId(), true).featured()).isTrue();
        assertThat(list(ItemOrder.RECENT, true)).extracting(ItemSummaryResponse::title).containsExactly("DJI Ronin RS3");
        assertThat(list(ItemOrder.RECENT, false).getFirst().title()).isEqualTo("DJI Ronin RS3");
        assertThat(auditLogRepository.findAll()).anyMatch(a -> a.getAction() == AuditAction.ITEM_FEATURED
                && a.getEntityId().equals(item.getId()));

        assertThat(itemService.setFeatured(admin.getId(), item.getId(), false).featured()).isFalse();
        assertThat(list(ItemOrder.RECENT, true)).isEmpty();
    }

    private List<ItemSummaryResponse> list(ItemOrder order, boolean featured) {
        return itemService.listActive(category.getId(), featured, order, Pageable.ofSize(20)).getContent();
    }

    private Item item(String title) {
        return itemRepository.save(Item.builder()
                .owner(owner)
                .category(category)
                .title(title)
                .condition(ItemCondition.GOOD)
                .pricePerDay(new BigDecimal("5000.00"))
                .build());
    }

    private Booking booking(Item item, BookingStatus status) {
        LocalDate start = LocalDate.now().minusDays(10);
        return bookingRepository.save(Booking.builder()
                .item(item)
                .renter(renter)
                .owner(owner)
                .startDate(start)
                .endDate(start.plusDays(2))
                .totalPrice(new BigDecimal("10000.00"))
                .status(status)
                .build());
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
}
