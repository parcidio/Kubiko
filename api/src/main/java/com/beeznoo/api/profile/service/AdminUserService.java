package com.beeznoo.api.profile.service;

import com.beeznoo.api.audit.dto.AuditDtos.AuditLogResponse;
import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
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

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * Admin › Utilizadores: pesquisa com filtros, ficha e ações sobre contas (decisoes-produto.md 2026-11-15 e 2026-11-18).
 * Cada ação tem motivo obrigatório e fica em audit_logs na mesma transação. O acesso ao Admin não se dá aqui
 * (só por convite, TeamAccessService).
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final int RECENT_BOOKINGS = 10;
    private static final ZoneId LUANDA = ZoneId.of("Africa/Luanda");

    /** Filtros da lista. Tudo opcional; kyc aceita os estados do KYC ou NONE (nunca submeteu). */
    public record UserSearch(String q, UserRole role, String kyc, Boolean suspended, Boolean phoneVerified,
                             LocalDate createdFrom, LocalDate createdTo, String sort, String direction) {}

    public static final Set<String> KYC_FILTERS = Set.of("NONE", "PENDING", "IN_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED");

    // ordenação: só colunas desta lista (o cliente nunca escreve SQL)
    private static final Map<String, String> SORTS = Map.of(
            "createdAt", "p.created_at",
            "name", "lower(p.full_name)",
            "items", "items");

    private static final String SUMMARY_COLUMNS = """
            p.id, p.full_name, p.phone, p.email, p.role, p.admin_role, p.is_verified, p.created_at, p.suspended_at,
            p.suspension_reason, kyc.status AS kyc,
            (SELECT count(*) FROM items i WHERE i.owner_id = p.id AND i.status <> 'DELETED') AS items,
            (SELECT count(*) FROM bookings b WHERE b.renter_id = p.id) AS as_renter,
            (SELECT count(*) FROM bookings b WHERE b.owner_id = p.id) AS as_owner
            """;

    private static final String FROM = """
            FROM profiles p
            LEFT JOIN LATERAL (SELECT k.status FROM kyc_verifications k WHERE k.profile_id = p.id
                               ORDER BY k.submitted_at DESC LIMIT 1) kyc ON true
            """;

    private static final RowMapper<AdminUserSummary> SUMMARY = (rs, i) -> new AdminUserSummary(
            rs.getObject("id", UUID.class),
            rs.getString("full_name"),
            rs.getString("phone"),
            rs.getString("email"),
            rs.getString("role"),
            rs.getString("admin_role"),
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
    private final AuditLogRepository auditLogRepository;
    private final AvatarUrls avatarUrls;

    // ---- Pesquisa ----

    @Transactional(readOnly = true)
    public Page<AdminUserSummary> search(String query, boolean suspendedOnly, int page, int size) {
        return search(query, suspendedOnly, null, page, size);
    }

    /** Compatível com a versão anterior: suspendedOnly + papel. */
    @Transactional(readOnly = true)
    public Page<AdminUserSummary> search(String query, boolean suspendedOnly, UserRole role, int page, int size) {
        return search(new UserSearch(query, role, null, suspendedOnly ? Boolean.TRUE : null, null, null, null, null, null),
                page, size);
    }

    @Transactional(readOnly = true)
    public Page<AdminUserSummary> search(UserSearch s, int page, int size) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();

        String q = s.q() == null || s.q().isBlank() ? null : s.q().strip();
        if (q != null) {
            String like = "%" + escapeLike(q) + "%";
            String digits = q.replaceAll("\\D", "");
            where.append(" AND (p.full_name ILIKE ? ESCAPE '\\' OR p.email ILIKE ? ESCAPE '\\'");
            args.add(like);
            args.add(like);
            if (digits.length() >= 3) {
                where.append(" OR regexp_replace(p.phone, '\\D', '', 'g') LIKE ?");
                args.add("%" + digits + "%");
            }
            where.append(")");
        }
        if (s.role() != null) {
            where.append(" AND p.role = ?");
            args.add(s.role().name());
        }
        if (s.kyc() != null) {
            if (!KYC_FILTERS.contains(s.kyc())) throw new IllegalArgumentException("Estado de KYC inválido");
            if ("NONE".equals(s.kyc())) {
                where.append(" AND kyc.status IS NULL");
            } else {
                where.append(" AND kyc.status = ?");
                args.add(s.kyc());
            }
        }
        if (s.suspended() != null) where.append(s.suspended() ? " AND p.suspended_at IS NOT NULL" : " AND p.suspended_at IS NULL");
        if (s.phoneVerified() != null) {
            where.append(" AND p.is_verified = ?");
            args.add(s.phoneVerified());
        }
        if (s.createdFrom() != null && s.createdTo() != null && s.createdTo().isBefore(s.createdFrom())) {
            throw new IllegalArgumentException("A data final é anterior à inicial");
        }
        if (s.createdFrom() != null) {
            where.append(" AND p.created_at >= ?");
            args.add(s.createdFrom().atStartOfDay(LUANDA).toOffsetDateTime());
        }
        if (s.createdTo() != null) {
            where.append(" AND p.created_at < ?");
            args.add(s.createdTo().plusDays(1).atStartOfDay(LUANDA).toOffsetDateTime());
        }

        String sortKey = s.sort() == null || s.sort().isBlank() ? "createdAt" : s.sort();
        String column = SORTS.get(sortKey);
        if (column == null) throw new IllegalArgumentException("Ordenação inválida");
        String dir = s.direction() == null || s.direction().isBlank() ? ("name".equals(sortKey) ? "ASC" : "DESC")
                : switch (s.direction().toLowerCase(Locale.ROOT)) {
                    case "asc" -> "ASC";
                    case "desc" -> "DESC";
                    default -> throw new IllegalArgumentException("Direção de ordenação inválida");
                };

        long total = jdbc.queryForObject("SELECT count(*) " + FROM + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        List<AdminUserSummary> rows = jdbc.query(
                "SELECT " + SUMMARY_COLUMNS + FROM + where + " ORDER BY " + column + " " + dir + ", p.id LIMIT ? OFFSET ?",
                SUMMARY, pageArgs.toArray());
        return new PageImpl<>(rows, PageRequest.of(page, size), total);
    }

    // ---- Ficha ----

    @Transactional(readOnly = true)
    public AdminUserDetail detail(UUID userId) {
        AdminUserSummary user = summary(userId);
        Map<String, Object> extra = jdbc.queryForMap("""
                SELECT p.city, p.province, p.avatar_storage_key, p.avatar_url,
                       p.email_verified_at IS NOT NULL AS email_verified, p.account_type,
                       (SELECT s.full_name FROM profiles s WHERE s.id = p.suspended_by) AS suspended_by,
                       (SELECT count(*) FROM refresh_tokens r
                        WHERE r.profile_id = p.id AND r.revoked_at IS NULL AND r.expires_at > now()) AS sessions,
                       (SELECT max(r.created_at) FROM refresh_tokens r WHERE r.profile_id = p.id) AS last_session,
                       (SELECT count(*) FROM admin_user_notes n WHERE n.profile_id = p.id) AS notes
                FROM profiles p WHERE p.id = ?
                """, userId);
        String avatarUrl = avatarUrls.of((String) extra.get("avatar_storage_key"), (String) extra.get("avatar_url"));
        List<AdminUserKyc> kyc = jdbc.query("""
                SELECT id, status, account_type, submitted_at, reviewed_at FROM kyc_verifications
                WHERE profile_id = ? ORDER BY submitted_at DESC LIMIT 1
                """, (rs, i) -> new AdminUserKyc(rs.getObject("id", UUID.class), rs.getString("status"),
                rs.getString("account_type"), rs.getObject("submitted_at", OffsetDateTime.class),
                rs.getObject("reviewed_at", OffsetDateTime.class)), userId);
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
                        rs.getString("side"), rs.getString("status"), rs.getObject("start_date", LocalDate.class),
                        rs.getObject("end_date", LocalDate.class), rs.getObject("created_at", OffsetDateTime.class)),
                userId, userId, userId, RECENT_BOOKINGS);
        return new AdminUserDetail(user, (String) extra.get("city"), (String) extra.get("province"), avatarUrl,
                Boolean.TRUE.equals(extra.get("email_verified")), (String) extra.get("account_type"),
                (String) extra.get("suspended_by"), ((Number) extra.get("sessions")).longValue(),
                extra.get("last_session") == null ? null : toOffset(extra.get("last_session")),
                kyc.isEmpty() ? null : kyc.getFirst(), items, bookings, ((Number) extra.get("notes")).longValue());
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> history(UUID userId, int page, int size) {
        requireExists(userId);
        return auditLogRepository.historyOfAccount(userId, PageRequest.of(page, size)).map(AuditLogResponse::from);
    }

    // ---- Ações ----

    @Transactional
    public AdminUserSummary suspend(UUID adminId, UUID userId, String reason) {
        String why = requireReason(reason);
        if (userId.equals(adminId)) throw ApiException.conflict("self_action", "Não podes suspender a tua própria conta");
        Profile profile = find(userId);
        if (profile.getRole() == UserRole.ADMIN) {
            throw ApiException.conflict("team_account", "Contas da equipa não se suspendem por aqui. Retira primeiro o acesso em Equipa.");
        }
        if (profile.isSuspended()) throw ApiException.conflict("already_suspended", "Esta conta já está suspensa");

        profile.setSuspendedAt(OffsetDateTime.now());
        profile.setSuspensionReason(why);
        profile.setSuspendedBy(adminId);
        profileRepository.saveAndFlush(profile);
        refreshTokenRepository.revokedAllForProfile(userId); // fecha as sessões; o token de acesso dura ≤ 15 min
        auditService.record(adminId, AuditAction.ACCOUNT_SUSPENDED, AuditService.ACCOUNT, userId, why, Map.of());
        return summary(userId);
    }

    @Transactional
    public AdminUserSummary reinstate(UUID adminId, UUID userId, String reason) {
        String why = requireReason(reason);
        Profile profile = find(userId);
        if (!profile.isSuspended()) throw ApiException.conflict("not_suspended", "Esta conta não está suspensa");
        profile.setSuspendedAt(null);
        profile.setSuspensionReason(null);
        profile.setSuspendedBy(null);
        profileRepository.saveAndFlush(profile);
        auditService.record(adminId, AuditAction.ACCOUNT_REINSTATED, AuditService.ACCOUNT, userId, why, Map.of());
        return summary(userId);
    }

    /** Termina todas as sessões (refresh tokens). O token de acesso já emitido dura ≤ 15 min. */
    @Transactional
    public AdminUserSummary revokeSessions(UUID adminId, UUID userId, String reason) {
        String why = requireReason(reason);
        if (userId.equals(adminId)) throw ApiException.conflict("self_action", "Para sair das tuas sessões usa Conta › Sair");
        requireExists(userId);
        Long active = jdbc.queryForObject("""
                SELECT count(*) FROM refresh_tokens WHERE profile_id = ? AND revoked_at IS NULL AND expires_at > now()
                """, Long.class, userId);
        refreshTokenRepository.revokedAllForProfile(userId);
        auditService.record(adminId, AuditAction.SESSIONS_REVOKED, AuditService.ACCOUNT, userId, why,
                Map.of("sessions", active == null ? 0 : active));
        return summary(userId);
    }

    /**
     * Obriga a confirmar o telefone outra vez (ex.: número reatribuído, conta partilhada). Termina as sessões.
     * No login seguinte a API envia um código novo (AuthService, `phone_unverified`).
     */
    @Transactional
    public AdminUserSummary resetPhoneVerification(UUID adminId, UUID userId, String reason) {
        String why = requireReason(reason);
        if (userId.equals(adminId)) throw ApiException.conflict("self_action", "Não podes repor o teu próprio telefone");
        Profile profile = find(userId);
        if (profile.getRole() == UserRole.ADMIN) {
            throw ApiException.conflict("team_account", "Contas da equipa não se alteram por aqui.");
        }
        if (!profile.isVerified()) throw ApiException.conflict("phone_not_verified", "O telefone desta conta já está por confirmar");
        profile.setVerified(false);
        profileRepository.saveAndFlush(profile);
        refreshTokenRepository.revokedAllForProfile(userId);
        auditService.record(adminId, AuditAction.PHONE_VERIFICATION_RESET, AuditService.ACCOUNT, userId, why, Map.of());
        return summary(userId);
    }

    // ---- Notas internas ----

    @Transactional(readOnly = true)
    public List<AdminUserNote> notes(UUID userId) {
        requireExists(userId);
        return jdbc.query("""
                SELECT n.id, n.body, n.author_id, a.full_name AS author, n.created_at
                FROM admin_user_notes n JOIN profiles a ON a.id = n.author_id
                WHERE n.profile_id = ? ORDER BY n.created_at DESC LIMIT 200
                """, (rs, i) -> new AdminUserNote(rs.getObject("id", UUID.class), rs.getString("body"),
                rs.getObject("author_id", UUID.class), rs.getString("author"),
                rs.getObject("created_at", OffsetDateTime.class)), userId);
    }

    @Transactional
    public AdminUserNote addNote(UUID adminId, UUID userId, String body) {
        if (body == null || body.isBlank()) throw new IllegalArgumentException("Escreve a nota");
        requireExists(userId);
        String text = body.strip();
        UUID id = jdbc.queryForObject("""
                INSERT INTO admin_user_notes (profile_id, author_id, body) VALUES (?, ?, ?) RETURNING id
                """, UUID.class, userId, adminId, text);
        // o texto da nota não vai para a auditoria (pode ter dados pessoais); fica só a referência
        auditService.record(adminId, AuditAction.USER_NOTE_ADDED, AuditService.ACCOUNT, userId, null,
                Map.of("noteId", String.valueOf(id)));
        return notes(userId).stream().filter(n -> n.id().equals(id)).findFirst().orElseThrow();
    }

    // ---- Auxiliares ----

    private AdminUserSummary summary(UUID userId) {
        List<AdminUserSummary> rows = jdbc.query("SELECT " + SUMMARY_COLUMNS + FROM + " WHERE p.id = ?", SUMMARY, userId);
        if (rows.isEmpty()) throw ApiException.notFound("user_not_found", "Utilizador não encontrado");
        return rows.getFirst();
    }

    private void requireExists(UUID userId) {
        if (!profileRepository.existsById(userId)) throw ApiException.notFound("user_not_found", "Utilizador não encontrado");
    }

    private Profile find(UUID userId) {
        return profileRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found", "Utilizador não encontrado"));
    }

    private static String requireReason(String reason) {
        if (reason == null || reason.strip().length() < 5) throw new IllegalArgumentException("Indica o motivo (fica no registo)");
        return reason.strip();
    }

    private static OffsetDateTime toOffset(Object v) {
        if (v instanceof OffsetDateTime o) return o;
        if (v instanceof java.sql.Timestamp t) return t.toInstant().atOffset(java.time.ZoneOffset.UTC);
        if (v instanceof java.time.Instant i) return i.atOffset(java.time.ZoneOffset.UTC);
        return null;
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
