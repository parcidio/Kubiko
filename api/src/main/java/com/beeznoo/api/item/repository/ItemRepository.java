package com.beeznoo.api.item.repository;

import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface ItemRepository extends JpaRepository<Item, UUID> {

    // SELECT ... FOR UPDATE — aceitar reservas do mesmo item em série (sem sobreposição por corrida)
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT i FROM Item i WHERE i.id = :id")
    java.util.Optional<Item> findByIdForUpdate(UUID id);

    Page<Item> findByStatus(ItemStatus status, Pageable pageable);

    Page<Item> findByCategoryIdAndStatus(UUID categoryId, ItemStatus status, Pageable pageable);

    Page<Item> findByOwnerIdAndStatusNot(UUID ownerId, ItemStatus status, Pageable pageable);

    // Lista pública. featured=true → só destaques; ordem fixa no servidor (o cliente não escolhe colunas)
    String PUBLIC_FILTER = """
            FROM Item i WHERE i.status = 'ACTIVE'
              AND (:categoryId IS NULL OR i.category.id = :categoryId)
              AND (:featured = false OR i.featuredAt IS NOT NULL)
            """;

    @Query(value = "SELECT i " + PUBLIC_FILTER + " ORDER BY i.featuredAt DESC NULLS LAST, i.createdAt DESC",
            countQuery = "SELECT COUNT(i) " + PUBLIC_FILTER)
    Page<Item> findPublicRecent(UUID categoryId, boolean featured, Pageable pageable);

    @Query(value = "SELECT i " + PUBLIC_FILTER + """
             ORDER BY (SELECT COUNT(b) FROM Booking b WHERE b.item = i AND b.status = 'COMPLETED') DESC, i.createdAt DESC
            """, countQuery = "SELECT COUNT(i) " + PUBLIC_FILTER)
    Page<Item> findPublicPopular(UUID categoryId, boolean featured, Pageable pageable);

    @Query(value = "SELECT i " + PUBLIC_FILTER + """
             ORDER BY (SELECT AVG(r.rating) FROM Review r WHERE r.item = i) DESC NULLS LAST,
                      (SELECT COUNT(r) FROM Review r WHERE r.item = i) DESC, i.createdAt DESC
            """, countQuery = "SELECT COUNT(i) " + PUBLIC_FILTER)
    Page<Item> findPublicByRating(UUID categoryId, boolean featured, Pageable pageable);

    @Query("SELECT i FROM Item i WHERE i.id = :id AND i.status <> 'DELETED'")
    Optional<Item> findActiveById(UUID id);
}
