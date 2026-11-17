package com.beeznoo.api.profile.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.profile.dto.AdminUserDtos.*;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin › Utilizadores: pesquisa, ficha e suspensão de contas (decisoes-produto.md 2026-11-15 — ações de admin).
 * A suspensão revoga as sessões; a entrada fica bloqueada em AuthService e o equipamento sai do Explorar.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final int RECENT_BOOKINGS = 10;

    private static final String SUMMARY_COLUMNS = """
            p.id, p.full_name, p.phone, p.email, p.role, p.is_verified, p.created_at, p.suspended_at, p.suspension_reason,
            (SELECT k.status FROM kyc_verifications k WHERE k.profile_id = p.id ORDER BY k.submitted_at DESC LIMIT 1) AS kyc,
            (SELECT count(*) FROM items i WHERE i.owner_id = p.id AND i.status <> 'DELETED') AS items,
            (SELECT count(*) FROM bookings b WHERE b.renter_id = p.id) AS as_renter,
            (SELECT count(*) FROM bookings b WHERE b.owner_id = p.id) AS as_owner
            """;

    // nome ou email (ILIKE) ou telefone (só dígitos); suspended=true → só contas suspensas
    private static final String FILTER = """
            FROM profiles p
            WHERE (?::text IS NULL OR p.full_name ILIKE ? ESCAPE '\\' OR p.email ILIKE ? ESCAPE '\\'
                   OR (?::text IS NOT NULL AND regexp_replace(p.phone, '\\D', '', 'g') LIKE ?))
              AND (? = false OR p.suspended_at IS NOT NULL)
              AND (?::text IS NULL OR p.role = ?)
            """;

    private static final RowMapper<AdminUserSummary> SUMMARY = (rs, i) -> new AdminUserSummary(
            rs.getObject("id", UUID.class),
            rs.getString("full_name"),
            rs.getString("phone"),
            rs.getString("email"),
            rs.getString("role"),
            rs.getBoolean("is_verified"),
            rs.getString("kyc"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("suspended_at", OffsetDateTime.class),
            rs.getString("suspension_reason"),
            rs.getLong("items"),
            rs.getLong("as_renter"),
            rs.getLong("as_owner"));

    private final JdbcTemplate jdbc;
    private final ProfileRepository profileRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Page<AdminUserSummary> search(String query, boolean suspendedOnly, int page, int size) {
        return search(query, suspendedOnly, null, page, size);
    }

    /** role != null → só esse papel (ex.: ADMIN para a lista da equipa). */
    @Transactional(readOnly = true)
    public Page<AdminUserSummary> search(String query, boolean suspendedOnly, UserRole role, int page, int size) {
        String roleName = role == null ? null : role.name();
        String q = query == null || query.isBlank() ? null : query.strip();
        String like = q == null ? null : "%" + escapeLike(q) + "%";
        String digits = q == null ? null : q.replaceAll("\\D", "");
        String phoneLike = digits == null || digits.length() < 3 ? null : "%" + digits + "%";
        Object[] filterArgs = {q, like, like, phoneLike, phoneLike, suspendedOnly, roleName, roleName};

        long total = jdbc.queryForObject("SELECT count(*) " + FILTER, Long.class, filterArgs);
        List<Object> args = new ArrayList<>(java.util.Arrays.asList(filterArgs)); // List.of não aceita null
        args.add(size);
        args.add((long) page * size);
        List<AdminUserSummary> rows = jdbc.query(
                "SELECT " + SUMMARY_COLUMNS + FILTER + " ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
                SUMMARY, args.toArray());
        return new PageImpl<>(rows, PageRequest.of(page, size), total);
    }

    @Transactional(readOnly = true)
    public AdminUserDetail detail(UUID userId) {
        AdminUserSummary user = summary(userId);
        String city = jdbc.queryForObject("SELECT city FROM profiles WHERE id = ?", String.class, userId);
        List<AdminUserItem> items = jdbc.query("""
                SELECT id, title, status, price_per_day, featured_at IS NOT NULL AS featured
                FROM items WHERE owner_id = ? AND status <> 'DELETED' ORDER BY created_at DESC
                """, (rs, i) -> new AdminUserItem(rs.getObject("id", UUID.class), rs.getString("title"),
                        rs.getString("status"), rs.getBigDecimal("price_per_day").longValue(), rs.getBoolean("featured")),
                userId);
        List<AdminUserBooking> bookings = jdbc.query("""
                SELECT b.id, i.title, CASE WHEN b.renter_id = ? THEN 'RENTER' ELSE 'OWNER' END AS side,
                       b.status, b.start_date, b.end_date, b.created_at
                FROM bookings b JOIN items i ON i.id = b.item_id
                WHERE b.renter_id = ? OR b.owner_id = ?
                ORDER BY b.created_at DESC LIMIT ?
                """, (rs, i) -> new AdminUserBooking(rs.getObject("id", UUID.class), rs.getString("title"),
                        rs.getString("side"), rs.getString("status"), rs.getObject("start_date", java.time.LocalDate.class),
                        rs.getObject("end_date", java.time.LocalDate.class), rs.getObject("created_at", OffsetDateTime.class)),
                userId, userId, userId, RECENT_BOOKINGS);
        return new AdminUserDetail(user, city, items, bookings);
    }

    @Transactional
    public AdminUserSummary suspend(UUID adminId, UUID userId, String reason) {
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Indica o motivo da suspensão");
        if (userId.equals(adminId)) throw new IllegalArgumentException("Não podes suspender a tua própria conta");
        Profile profile = find(userId);
        if (profile.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Contas da equipa não se suspendem por aqui");
        }
        if (profile.isSuspended()) throw new IllegalStateException("Esta conta já está suspensa");

        profile.setSuspendedAt(OffsetDateTime.now());
        profile.setSuspensionReason(reason.strip());
        profile.setSuspendedBy(adminId);
        profileRepository.saveAndFlush(profile);
        refreshTokenRepository.revokedAllForProfile(userId); // fecha as sessões; o token de acesso dura ≤ 15 min
        auditService.record(adminId, AuditAction.ACCOUNT_SUSPENDED, AuditService.ACCOUNT, userId, reason.strip(), Map.of());
        return summary(userId);
    }

    @Transactional
    public AdminUserSummary reinstate(UUID adminId, UUID userId, String reason) {
        Profile profile = find(userId);
        if (!profile.isSuspended()) throw new IllegalStateException("Esta conta não está suspensa");
        profile.setSuspendedAt(null);
        profile.setSuspensionReason(null);
        profile.setSuspendedBy(null);
        profileRepository.saveAndFlush(profile);
        auditService.record(adminId, AuditAction.ACCOUNT_REINSTATED, AuditService.ACCOUNT, userId,
                reason == null || reason.isBlank() ? null : reason.strip(), Map.of());
        return summary(userId);
    }

    /**
     * Promove a ADMIN ou retira o papel (decisoes-produto.md 2026-11-17). Ao retirar, o papel volta a BOTH e as
     * sessões são revogadas (o token de acesso já emitido deixa de valer como ADMIN no JwtAuthFiltter, que confirma
     * o papel na BD para tokens ADMIN). Sem mudança (já é/não é admin) → devolve o estado atual, sem auditoria.
     */
    @Transactional
    public AdminUserSummary changeRole(UUID adminId, UUID userId, boolean makeAdmin) {
        if (!makeAdmin && userId.equals(adminId)) {
            throw ApiException.conflict("self_demotion", "Não podes retirar o teu próprio papel de admin");
        }
        Profile profile = find(userId);
        UserRole from = profile.getRole();
        if (makeAdmin == (from == UserRole.ADMIN)) return summary(userId);

        if (makeAdmin) {
            if (profile.isSuspended()) {
                throw ApiException.conflict("account_suspended", "Reativa a conta antes de lhe dar papel de admin");
            }
            profile.setRole(UserRole.ADMIN);
        } else {
            // bloqueia as linhas dos admins: dois admins a retirarem-se um ao outro ao mesmo tempo não deixam zero
            List<UUID> admins = jdbc.queryForList(
                    "SELECT id FROM profiles WHERE role = 'ADMIN' AND suspended_at IS NULL ORDER BY id FOR UPDATE", UUID.class);
            if (admins.size() <= 1) {
                throw ApiException.conflict("last_admin", "Tem de ficar pelo menos um admin");
            }
            profile.setRole(UserRole.BOTH);
        }
        profileRepository.saveAndFlush(profile);
        // o papel vai no token: obriga a entrar outra vez (com 2FA de admin, na promoção) para ter um token novo
        refreshTokenRepository.revokedAllForProfile(userId);
        auditService.record(adminId, AuditAction.USER_ROLE_CHANGED, AuditService.ACCOUNT, userId, null,
                Map.of("from", from.name(), "to", profile.getRole().name()));
        return summary(userId);
    }

    private AdminUserSummary summary(UUID userId) {
        List<AdminUserSummary> rows = jdbc.query("SELECT " + SUMMARY_COLUMNS + " FROM profiles p WHERE p.id = ?",
                SUMMARY, userId);
        if (rows.isEmpty()) throw new IllegalArgumentException("Utilizador não encontrado");
        return rows.getFirst();
    }

    private Profile find(UUID userId) {
        return profileRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("Utilizador não encontrado"));
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
