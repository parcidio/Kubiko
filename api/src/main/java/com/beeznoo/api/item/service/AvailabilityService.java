package com.beeznoo.api.item.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.item.dto.AvailabilityDtos.*;
import com.beeznoo.api.item.entity.AvailabilityBlock;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.repository.AvailabilityBlockRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.profile.repository.ProfileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Disponibilidade do equipamento (gap #8): bloqueios manuais do dono + reservas que ocupam datas.
 * Bloqueios são dias INCLUSIVOS; reservas são [início, fim) — o dia de devolução fica livre.
 * Ver claude/decisoes-produto.md (2026-11-11).
 */
@Slf4j
@Service
@Transactional
public class AvailabilityService {

    static final int DEFAULT_WINDOW_DAYS = 180;
    static final int MAX_WINDOW_DAYS = 366;
    static final int MAX_BLOCK_DAYS = 366;   // = CHECK end - start <= 365 na V21
    static final int MAX_FUTURE_BLOCKS = 100;

    private final AvailabilityBlockRepository blockRepository;
    private final BookingRepository bookingRepository;
    private final ItemRepository itemRepository;
    private final ProfileRepository profileRepository;

    public AvailabilityService(AvailabilityBlockRepository blockRepository, BookingRepository bookingRepository,
                               ItemRepository itemRepository, ProfileRepository profileRepository) {
        this.blockRepository = blockRepository;
        this.bookingRepository = bookingRepository;
        this.itemRepository = itemRepository;
        this.profileRepository = profileRepository;
    }

    static LocalDate today() {
        return LocalDate.now(Formats.LUANDA);
    }

    // ─── Público ────────────────────────────────────────────────────────────

    /** Dias indisponíveis na janela [from, to] (inclusiva). Sem nomes, notas nem ids de reserva. */
    @Transactional(readOnly = true)
    public AvailabilityResponse availability(UUID itemId, LocalDate from, LocalDate to) {
        Item item = itemRepository.findActiveById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        LocalDate start = from != null ? from : today();
        LocalDate end = to != null ? to : start.plusDays(DEFAULT_WINDOW_DAYS);
        if (end.isBefore(start)) throw new IllegalArgumentException("A data final tem de ser igual ou posterior à inicial");
        if (ChronoUnit.DAYS.between(start, end) >= MAX_WINDOW_DAYS) {
            throw new IllegalArgumentException("Pede no máximo " + MAX_WINDOW_DAYS + " dias de cada vez");
        }

        List<UnavailableRange> ranges = new ArrayList<>();
        for (Booking b : bookingRepository.findOccupying(item.getId(), BookingStatus.OCCUPYING, start, end)) {
            // [início, fim) → dias inclusivos [início, fim − 1]
            ranges.add(clip(b.getStartDate(), b.getEndDate().minusDays(1), start, end, UnavailableReason.BOOKED));
        }
        for (AvailabilityBlock a : blockRepository.findInWindow(item.getId(), start, end)) {
            ranges.add(clip(a.getStartDate(), a.getEndDate(), start, end, UnavailableReason.BLOCKED));
        }
        ranges.sort(Comparator.comparing(UnavailableRange::start));
        return new AvailabilityResponse(item.getId(), start, end, ranges);
    }

    private static UnavailableRange clip(LocalDate s, LocalDate e, LocalDate from, LocalDate to, UnavailableReason r) {
        return new UnavailableRange(s.isBefore(from) ? from : s, e.isAfter(to) ? to : e, r);
    }

    /**
     * Gate de pedir e aceitar reserva: o período [start, end) não pode tocar dias bloqueados pelo dono.
     * As reservas já aceites são verificadas à parte (BookingService), com mensagens próprias.
     */
    @Transactional(readOnly = true)
    public boolean isBlocked(UUID itemId, LocalDate start, LocalDate endExclusive) {
        return blockRepository.existsOverlapping(itemId, start, endExclusive);
    }

    // ─── Dono ───────────────────────────────────────────────────────────────

    /** Bloqueios atuais e futuros (os passados não interessam ao dono). */
    @Transactional(readOnly = true)
    public List<BlockResponse> listBlocks(UUID ownerId, UUID itemId) {
        Item item = ownedItem(ownerId, itemId);
        return blockRepository.findByItemIdAndEndDateGreaterThanEqualOrderByStartDateAsc(item.getId(), today())
                .stream().map(AvailabilityService::toResponse).toList();
    }

    public BlockResponse createBlock(UUID ownerId, UUID itemId, CreateBlockRequest request) {
        LocalDate start = request.startDate();
        LocalDate end = request.endDate();
        if (end.isBefore(start)) throw new IllegalArgumentException("A data final tem de ser igual ou posterior à inicial");
        if (start.isBefore(today())) throw new IllegalArgumentException("Não podes bloquear dias que já passaram");
        if (ChronoUnit.DAYS.between(start, end) >= MAX_BLOCK_DAYS) {
            throw new IllegalArgumentException("Bloqueia no máximo " + MAX_BLOCK_DAYS + " dias de cada vez");
        }

        Item item = ownedItem(ownerId, itemId);
        // Lock no item: um "aceitar" para as mesmas datas não passa entre a verificação e a gravação
        itemRepository.findByIdForUpdate(item.getId());
        if (blockRepository.countByItemIdAndEndDateGreaterThanEqual(item.getId(), today()) >= MAX_FUTURE_BLOCKS) {
            throw new IllegalStateException("Já tens " + MAX_FUTURE_BLOCKS + " bloqueios futuros. Remove alguns primeiro");
        }
        // dias inclusivos [start, end] = período [start, end + 1)
        if (bookingRepository.existsOverlapping(item.getId(), start, end.plusDays(1), BookingStatus.OCCUPYING)) {
            throw new IllegalStateException("Já tens uma reserva aceite nalguns destes dias");
        }

        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        AvailabilityBlock block = blockRepository.save(AvailabilityBlock.builder()
                .item(item)
                .startDate(start)
                .endDate(end)
                .note(note)
                .createdBy(profileRepository.getReferenceById(ownerId))
                .build());
        log.info("Bloqueio {} criado no item {} ({} dias)", block.getId(), item.getId(),
                ChronoUnit.DAYS.between(start, end) + 1);
        return toResponse(block);
    }

    public void deleteBlock(UUID ownerId, UUID itemId, UUID blockId) {
        Item item = ownedItem(ownerId, itemId);
        AvailabilityBlock block = blockRepository.findByIdAndItemId(blockId, item.getId())
                .orElseThrow(() -> new IllegalArgumentException("Bloqueio não encontrado"));
        blockRepository.delete(block);
    }

    private Item ownedItem(UUID ownerId, UUID itemId) {
        Item item = itemRepository.findActiveById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));
        if (!item.getOwner().getId().equals(ownerId)) {
            throw new AccessDeniedException("Só o dono gere as datas deste equipamento");
        }
        return item;
    }

    private static BlockResponse toResponse(AvailabilityBlock a) {
        return new BlockResponse(a.getId(), a.getStartDate(), a.getEndDate(), a.getNote(), a.getCreatedAt());
    }
}
