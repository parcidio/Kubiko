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

    Page<Item> findByStatus(ItemStatus status, Pageable pageable);

    Page<Item> findByCategoryIdAndStatus(UUID categoryId, ItemStatus status, Pageable pageable);

    Page<Item> findByOwnerIdAndStatusNot(UUID ownerId, ItemStatus status, Pageable pageable);

    @Query("SELECT i FROM Item i WHERE i.id = :id AND i.status <> 'DELETED'")
    Optional<Item> findActiveById(UUID id);
}
