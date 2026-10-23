package com.beeznoo.api.review.dto;

import com.beeznoo.api.review.entity.Review;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public class ReviewDtos {

    public record CreateReviewRequest(
            @Min(1) @Max(5) int rating,
            @Size(max = 1000) String comment
    ) {}

    // Nome encurtado ("Ana D.") — a avaliação é pública
    public record ReviewResponse(
            UUID id,
            UUID bookingId,
            int rating,
            String comment,
            String reviewerName,
            OffsetDateTime createdAt
    ) {
        public static ReviewResponse from(Review r) {
            return new ReviewResponse(r.getId(), r.getBooking().getId(), r.getRating(), r.getComment(),
                    shortName(r.getReviewer().getFullName()), r.getCreatedAt());
        }

        static String shortName(String fullName) {
            if (fullName == null || fullName.isBlank()) return "Arrendatário";
            String[] parts = fullName.strip().split("\\s+");
            return parts.length == 1 ? parts[0] : parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
        }
    }

    /** Média arredondada a 1 casa; null sem avaliações. */
    public record RatingSummary(Double average, long count) {
        public static final RatingSummary NONE = new RatingSummary(null, 0);
    }
}
