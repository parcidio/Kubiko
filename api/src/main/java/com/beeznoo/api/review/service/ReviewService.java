package com.beeznoo.api.review.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.review.dto.ReviewDtos.CreateReviewRequest;
import com.beeznoo.api.review.dto.ReviewDtos.RatingSummary;
import com.beeznoo.api.review.dto.ReviewDtos.ReviewResponse;
import com.beeznoo.api.review.entity.Review;
import com.beeznoo.api.review.repository.ReviewRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;

    public ReviewService(ReviewRepository reviewRepository, BookingRepository bookingRepository) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
    }

    public ReviewResponse create(UUID requesterId, UUID bookingId, CreateReviewRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
        if (!booking.getRenter().getId().equals(requesterId)) {
            throw new AccessDeniedException("Só quem alugou pode avaliar esta reserva");
        }
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new IllegalStateException("Só podes avaliar depois de a reserva estar concluída");
        }
        if (reviewRepository.existsByBookingId(bookingId)) {
            throw new IllegalStateException("Já avaliaste esta reserva");
        }

        String comment = request.comment() == null || request.comment().isBlank() ? null : request.comment().strip();
        Review review = reviewRepository.save(Review.builder()
                .booking(booking)
                .item(booking.getItem())
                .reviewer(booking.getRenter())
                .owner(booking.getOwner())
                .rating((short) request.rating())
                .comment(comment)
                .build());
        return ReviewResponse.from(review);
    }

    // Arrendatário ou dono da reserva
    @Transactional(readOnly = true)
    public ReviewResponse forBooking(UUID requesterId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
        if (!booking.getRenter().getId().equals(requesterId) && !booking.getOwner().getId().equals(requesterId)) {
            throw new AccessDeniedException("Sem permissão para ver esta reserva");
        }
        return reviewRepository.findByBookingId(bookingId).map(ReviewResponse::from).orElse(null);
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> forItem(UUID itemId, Pageable pageable) {
        return reviewRepository.findByItemIdOrderByCreatedAtDesc(itemId, pageable).map(ReviewResponse::from);
    }

    @Transactional(readOnly = true)
    public Map<UUID, RatingSummary> ratings(Collection<UUID> itemIds) {
        Map<UUID, RatingSummary> out = new HashMap<>();
        if (itemIds.isEmpty()) return out;
        for (Object[] row : reviewRepository.ratingsByItem(itemIds)) {
            double avg = Math.round(((Number) row[1]).doubleValue() * 10) / 10.0;
            out.put((UUID) row[0], new RatingSummary(avg, ((Number) row[2]).longValue()));
        }
        return out;
    }
}
