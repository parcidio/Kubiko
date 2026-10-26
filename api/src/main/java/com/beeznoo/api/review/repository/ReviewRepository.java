package com.beeznoo.api.review.repository;

import com.beeznoo.api.review.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    boolean existsByBookingId(UUID bookingId);

    @EntityGraph(attributePaths = "reviewer")
    Optional<Review> findByBookingId(UUID bookingId);

    @EntityGraph(attributePaths = "reviewer")
    Page<Review> findByItemIdOrderByCreatedAtDesc(UUID itemId, Pageable pageable);

    /** [itemId, média, nº] para uma página de itens — uma query em vez de uma por cartão. */
    @Query("SELECT r.item.id, AVG(r.rating), COUNT(r) FROM Review r WHERE r.item.id IN :itemIds GROUP BY r.item.id")
    List<Object[]> ratingsByItem(Collection<UUID> itemIds);
}
