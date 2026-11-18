package com.beeznoo.api.booking.controller;

import com.beeznoo.api.audit.dto.AuditDtos.AuditLogResponse;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.config.AdminAccess;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Admin › Operação › Reservas: lista paginada (decisoes-produto.md 2026-11-18). Só leitura. */
@RestController
@RequestMapping("/api/v1/admin/bookings")
@RequiredArgsConstructor
@PreAuthorize(AdminAccess.OPERATIONS)
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Reservas", description = "Lista de reservas para a equipa de operação")
public class AdminBookingController {

    private final JdbcTemplate jdbc;
    private final AuditService auditService;

    public record AdminBookingRow(UUID id, UUID itemId, String itemTitle, UUID renterId, String renterName,
                                  UUID ownerId, String ownerName, String status, LocalDate startDate, LocalDate endDate,
                                  long totalPrice, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

    @Operation(summary = "Reservas", description = """
            Mais recentes primeiro. `status` (um estado da reserva), `q` procura no equipamento, no dono e no
            arrendatário (≤ 100 caracteres). Permissão OPERATIONS_DESK.
            """)
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<Page<AdminBookingRow>> list(@RequestParam(required = false) BookingStatus status,
                                                      @RequestParam(required = false) String q,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        if (q != null && q.length() > 100) throw new IllegalArgumentException("Pesquisa demasiado longa");
        int p = Math.clamp(page, 0, 100_000);
        int s = Math.clamp(size, 1, 100);
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (status != null) {
            where.append(" AND b.status = ?");
            args.add(status.name());
        }
        if (q != null && !q.isBlank()) {
            String like = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" AND (i.title ILIKE ? ESCAPE '\\' OR r.full_name ILIKE ? ESCAPE '\\' OR o.full_name ILIKE ? ESCAPE '\\')");
            args.add(like);
            args.add(like);
            args.add(like);
        }
        String from = """
                 FROM bookings b JOIN items i ON i.id = b.item_id
                 JOIN profiles r ON r.id = b.renter_id JOIN profiles o ON o.id = b.owner_id
                """;
        long total = jdbc.queryForObject("SELECT count(*)" + from + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(s);
        pageArgs.add((long) p * s);
        List<AdminBookingRow> rows = jdbc.query("""
                SELECT b.id, b.item_id, i.title, b.renter_id, r.full_name AS renter, b.owner_id, o.full_name AS owner,
                       b.status, b.start_date, b.end_date, b.total_price, b.created_at, b.updated_at
                """ + from + where + " ORDER BY b.created_at DESC, b.id LIMIT ? OFFSET ?",
                (rs, n) -> new AdminBookingRow(rs.getObject("id", UUID.class), rs.getObject("item_id", UUID.class),
                        rs.getString("title"), rs.getObject("renter_id", UUID.class), rs.getString("renter"),
                        rs.getObject("owner_id", UUID.class), rs.getString("owner"), rs.getString("status"),
                        rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class),
                        whole(rs.getBigDecimal("total_price")), rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("updated_at", OffsetDateTime.class)),
                pageArgs.toArray());
        return ResponseEntity.ok(new PageImpl<>(rows, PageRequest.of(p, s), total));
    }

    @Operation(summary = "Histórico de uma reserva", description = """
            Auditoria da reserva (decisões da equipa e das partes). 404 `booking_not_found`. Permissão OPERATIONS_DESK.
            """)
    @GetMapping("/{id}/history")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<AuditLogResponse>> history(@PathVariable UUID id,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "50") int size) {
        Long exists = jdbc.queryForObject("SELECT count(*) FROM bookings WHERE id = ?", Long.class, id);
        if (exists == null || exists == 0) throw ApiException.notFound("booking_not_found", "Reserva não encontrada");
        // por entityId (como antes no ecrã): pagamentos, cauções e documentos da reserva usam o id da reserva
        return ResponseEntity.ok(auditService.list(null, id, null, null,
                PageRequest.of(Math.clamp(page, 0, 100_000), Math.clamp(size, 1, 100))));
    }

    private static long whole(BigDecimal v) {
        return v == null ? 0 : v.setScale(0, java.math.RoundingMode.HALF_UP).longValue();
    }
}
