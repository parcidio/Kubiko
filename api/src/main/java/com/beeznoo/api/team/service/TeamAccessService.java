package com.beeznoo.api.team.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.common.util.Emails;
import com.beeznoo.api.notification.email.EmailTemplateRenderer;
import com.beeznoo.api.notification.service.TransactionalEmail;
import com.beeznoo.api.profile.entity.AdminRole;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.team.dto.TeamDtos.*;
import com.beeznoo.api.team.entity.AdminInvitation;
import com.beeznoo.api.team.entity.AdminInvitation.InvitationStatus;
import com.beeznoo.api.team.repository.AdminInvitationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Acesso ao Admin só por convite; papéis da equipa; retirar acesso (decisoes-produto.md 2026-11-18).
 * Todas as mudanças ficam em audit_logs na mesma transação. O token do convite nunca é guardado nem registado em claro.
 */
@Service
public class TeamAccessService {

    static final Duration INVITE_TTL = Duration.ofHours(72);
    private static final int TOKEN_BYTES = 32;

    private final ProfileRepository profileRepository;
    private final AdminInvitationRepository invitationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditService auditService;
    private final JdbcTemplate jdbc;
    private final RateLimiter rateLimiter;
    private final EmailTemplateRenderer renderer;
    private final ApplicationEventPublisher events;
    private final String frontendUrl;
    private final SecureRandom random = new SecureRandom();

    public TeamAccessService(ProfileRepository profileRepository, AdminInvitationRepository invitationRepository,
                             RefreshTokenRepository refreshTokenRepository, AuditService auditService, JdbcTemplate jdbc,
                             RateLimiter rateLimiter, EmailTemplateRenderer renderer, ApplicationEventPublisher events,
                             @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.profileRepository = profileRepository;
        this.invitationRepository = invitationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.auditService = auditService;
        this.jdbc = jdbc;
        this.rateLimiter = rateLimiter;
        this.renderer = renderer;
        this.events = events;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    // ---- O próprio ----

    @Transactional(readOnly = true)
    public MyAccess myAccess(UUID profileId) {
        Profile p = find(profileId);
        AdminRole role = p.getRole() == UserRole.ADMIN ? p.getAdminRole() : null;
        return new MyAccess(p.getId(), p.getFullName(), role,
                role == null ? List.of() : List.copyOf(new TreeSet<>(role.permissions())));
    }

    // ---- Equipa ----

    @Transactional(readOnly = true)
    public List<TeamMember> members() {
        return jdbc.query("""
                SELECT p.id, p.full_name, p.phone, p.email, p.admin_role, p.created_at,
                       (SELECT max(e.created_at) FROM security_events e
                        WHERE e.profile_id = p.id AND e.type = 'ADMIN_LOGIN') AS last_login
                FROM profiles p
                WHERE p.role = 'ADMIN' AND p.suspended_at IS NULL
                ORDER BY CASE p.admin_role WHEN 'SUPER_ADMIN' THEN 0 ELSE 1 END, p.full_name
                """, (rs, i) -> new TeamMember(
                rs.getObject("id", UUID.class), rs.getString("full_name"), rs.getString("phone"), rs.getString("email"),
                rs.getString("admin_role") == null ? null : AdminRole.valueOf(rs.getString("admin_role")),
                rs.getObject("created_at", OffsetDateTime.class), rs.getObject("last_login", OffsetDateTime.class)));
    }

    /** Muda o papel de outra pessoa da equipa. Nunca o próprio; fica sempre pelo menos um SUPER_ADMIN. */
    @Transactional
    public TeamMember changeRole(UUID actorId, UUID memberId, AdminRole newRole, String reason) {
        if (actorId.equals(memberId)) {
            throw ApiException.conflict("self_change", "Não podes mudar o teu próprio acesso. Pede a outra pessoa da equipa.");
        }
        Profile member = lockedMember(memberId);
        AdminRole from = member.getAdminRole();
        if (from == newRole) return member(memberId);
        if (from == AdminRole.SUPER_ADMIN) requireAnotherSuperAdmin(memberId);

        member.setAdminRole(newRole);
        profileRepository.saveAndFlush(member);
        auditService.record(actorId, AuditAction.ADMIN_ROLE_CHANGED, AuditService.ACCOUNT, memberId, reason,
                Map.of("from", from == null ? "NONE" : from.name(), "to", newRole.name()));
        return member(memberId);
    }

    /** Retira o acesso ao Admin: a conta volta a BOTH e as sessões são revogadas. */
    @Transactional
    public void revokeAccess(UUID actorId, UUID memberId, String reason) {
        if (actorId.equals(memberId)) {
            throw ApiException.conflict("self_change", "Não podes retirar o teu próprio acesso. Pede a outra pessoa da equipa.");
        }
        Profile member = lockedMember(memberId);
        AdminRole from = member.getAdminRole();
        if (from == AdminRole.SUPER_ADMIN) requireAnotherSuperAdmin(memberId);

        member.setRole(UserRole.BOTH);
        member.setAdminRole(null);
        profileRepository.saveAndFlush(member);
        refreshTokenRepository.revokedAllForProfile(memberId);
        auditService.record(actorId, AuditAction.ADMIN_ACCESS_REVOKED, AuditService.ACCOUNT, memberId, reason,
                Map.of("from", from == null ? "NONE" : from.name()));
    }

    // ---- Convites (lado de quem convida) ----

    @Transactional
    public InvitationResponse invite(UUID actorId, InviteRequest request) {
        rateLimiter.check("admin-invite:" + actorId, 20, Duration.ofHours(1),
                "Demasiados convites seguidos. Tenta daqui a uma hora.");
        String email = Emails.normalize(request.email());
        if ((request.userId() == null) == (email == null)) {
            throw new IllegalArgumentException("Indica a conta ou o email da pessoa a convidar (só um dos dois)");
        }

        Profile target = request.userId() != null
                ? profileRepository.findById(request.userId())
                    .orElseThrow(() -> ApiException.notFound("user_not_found", "Utilizador não encontrado"))
                : profileRepository.findByEmailIgnoreCase(email).orElse(null);
        if (target != null) {
            if (target.getId().equals(actorId)) {
                throw ApiException.conflict("self_change", "Não te podes convidar a ti próprio.");
            }
            if (target.getRole() == UserRole.ADMIN) {
                throw ApiException.conflict("already_admin", "Esta pessoa já faz parte da equipa. Muda o papel em Equipa.");
            }
            if (target.isSuspended()) {
                throw ApiException.conflict("account_suspended", "Esta conta está suspensa. Reativa-a antes de a convidar.");
            }
        }
        UUID targetId = request.userId() != null ? target.getId() : null;
        if (invitationRepository.existsPendingFor(targetId, email, OffsetDateTime.now())
                || (target != null && invitationRepository.existsPendingFor(target.getId(), Emails.normalize(target.getEmail()), OffsetDateTime.now()))) {
            throw ApiException.conflict("invite_pending", "Já há um convite pendente para esta pessoa. Revoga-o antes de enviar outro.");
        }

        String token = newToken();
        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        AdminInvitation invitation = invitationRepository.saveAndFlush(AdminInvitation.builder()
                .profileId(targetId)
                .email(email)
                .adminRole(request.adminRole())
                .tokenHash(sha256(token))
                .note(note)
                .invitedBy(actorId)
                .expiresAt(OffsetDateTime.now().plus(INVITE_TTL))
                .build());

        String url = frontendUrl + "/convite-equipa#" + token;
        String sendTo = email != null ? email : target.getEmail();
        boolean emailSent = sendTo != null && !sendTo.isBlank();
        if (emailSent) {
            String inviter = find(actorId).getFullName();
            String html = renderer.render(target == null ? null : firstName(target.getFullName()),
                    "Convite para a equipa Beeznoo",
                    List.of(inviter + " convidou-te para a equipa Beeznoo com o papel " + label(request.adminRole()) + ".",
                            "Entra na tua conta Beeznoo e abre o link para aceitar. O convite vale 72 horas e só pode ser usado uma vez.",
                            "Se não esperavas este convite, ignora este email."),
                    "Ver convite", url);
            events.publishEvent(new TransactionalEmail(sendTo, "Convite para a equipa Beeznoo", html,
                    "admin-invite-" + invitation.getId()));
        }

        Map<String, Object> meta = new HashMap<>();
        meta.put("adminRole", request.adminRole().name());
        meta.put("target", targetId != null ? "ACCOUNT" : "EMAIL");
        if (targetId != null) meta.put("userId", targetId.toString());
        meta.put("expiresAt", invitation.getExpiresAt().toString());
        auditService.record(actorId, AuditAction.ADMIN_INVITED, AuditService.ADMIN_INVITATION, invitation.getId(), note, meta);
        return toResponse(invitation, url, emailSent);
    }

    @Transactional(readOnly = true)
    public Page<InvitationResponse> invitations(int page, int size) {
        return invitationRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(i -> toResponse(i, null, false));
    }

    @Transactional
    public InvitationResponse revokeInvitation(UUID actorId, UUID invitationId, String reason) {
        AdminInvitation invitation = invitationRepository.findByIdForUpdate(invitationId)
                .orElseThrow(() -> ApiException.notFound("invitation_not_found", "Convite não encontrado"));
        if (invitation.statusAt(OffsetDateTime.now()) != InvitationStatus.PENDING) {
            throw ApiException.conflict("invitation_not_pending", "Este convite já não está pendente.");
        }
        invitation.setRevokedAt(OffsetDateTime.now());
        invitation.setRevokedBy(actorId);
        invitationRepository.saveAndFlush(invitation);
        auditService.record(actorId, AuditAction.ADMIN_INVITATION_REVOKED, AuditService.ADMIN_INVITATION, invitationId,
                reason, Map.of("adminRole", invitation.getAdminRole().name()));
        return toResponse(invitation, null, false);
    }

    // ---- Convites (lado de quem é convidado; qualquer sessão) ----

    @Transactional(readOnly = true)
    public InvitationPreview inspect(UUID profileId, String token) {
        rateLimiter.check("admin-invite-token:" + profileId, 10, Duration.ofMinutes(15),
                "Demasiadas tentativas. Tenta daqui a 15 minutos.");
        AdminInvitation inv = invitationRepository.findByTokenHash(sha256(token))
                .orElseThrow(() -> ApiException.notFound("invitation_invalid", "Este convite não existe ou o link está incompleto."));
        Profile me = find(profileId);
        String problem = problemFor(inv, me);
        return new InvitationPreview(inv.getAdminRole(), nameOf(inv.getInvitedBy()), inv.getExpiresAt(),
                inv.statusAt(OffsetDateTime.now()), problem == null, problem);
    }

    @Transactional
    public AcceptResponse accept(UUID profileId, String token) {
        rateLimiter.check("admin-invite-token:" + profileId, 10, Duration.ofMinutes(15),
                "Demasiadas tentativas. Tenta daqui a 15 minutos.");
        AdminInvitation inv = invitationRepository.findByTokenHashForUpdate(sha256(token))
                .orElseThrow(() -> ApiException.notFound("invitation_invalid", "Este convite não existe ou o link está incompleto."));
        Profile me = find(profileId);
        String problem = problemFor(inv, me);
        if (problem != null) throw new ApiException(HttpStatus.CONFLICT, problem, messageFor(problem));

        OffsetDateTime now = OffsetDateTime.now();
        inv.setAcceptedAt(now);
        inv.setAcceptedBy(profileId);
        invitationRepository.saveAndFlush(inv);

        UserRole from = me.getRole();
        me.setRole(UserRole.ADMIN);
        me.setAdminRole(inv.getAdminRole());
        profileRepository.saveAndFlush(me);
        // o papel vai no token: obriga a entrar outra vez, agora com o 2FA de admin
        refreshTokenRepository.revokedAllForProfile(profileId);

        auditService.record(profileId, AuditAction.ADMIN_INVITATION_ACCEPTED, AuditService.ACCOUNT, profileId, null,
                Map.of("invitationId", inv.getId().toString(), "invitedBy", inv.getInvitedBy().toString(),
                        "from", from.name(), "adminRole", inv.getAdminRole().name()));
        return new AcceptResponse(inv.getAdminRole(), true);
    }

    // ---- Auxiliares ----

    /** null = pode aceitar; senão o código do problema. */
    private String problemFor(AdminInvitation inv, Profile me) {
        switch (inv.statusAt(OffsetDateTime.now())) {
            case ACCEPTED: return "invitation_used";
            case REVOKED: return "invitation_revoked";
            case EXPIRED: return "invitation_expired";
            default: break;
        }
        if (me.getRole() == UserRole.ADMIN) return "already_admin";
        if (me.isSuspended()) return "account_suspended";
        if (!me.isVerified()) return "phone_unverified";
        if (inv.getProfileId() != null) {
            return inv.getProfileId().equals(me.getId()) ? null : "not_for_you";
        }
        String myEmail = Emails.normalize(me.getEmail());
        if (myEmail == null || !myEmail.equals(inv.getEmail())) return "not_for_you";
        if (me.getEmailVerifiedAt() == null) return "email_unverified";
        return null;
    }

    private static String messageFor(String code) {
        return switch (code) {
            case "invitation_used" -> "Este convite já foi usado.";
            case "invitation_revoked" -> "Este convite foi cancelado. Pede um novo à equipa.";
            case "invitation_expired" -> "Este convite expirou. Pede um novo à equipa.";
            case "already_admin" -> "Já fazes parte da equipa.";
            case "account_suspended" -> "A tua conta está suspensa.";
            case "phone_unverified" -> "Confirma o teu número de telefone antes de aceitar.";
            case "email_unverified" -> "Confirma o teu email em Conta antes de aceitar o convite.";
            default -> "Este convite é para outra conta. Entra com a conta convidada.";
        };
    }

    private Profile lockedMember(UUID memberId) {
        List<UUID> found = jdbc.queryForList(
                "SELECT id FROM profiles WHERE id = ? AND role = 'ADMIN' FOR UPDATE", UUID.class, memberId);
        if (found.isEmpty()) throw ApiException.notFound("member_not_found", "Esta pessoa não faz parte da equipa");
        return find(memberId);
    }

    // Bloqueia as linhas dos SUPER_ADMIN ativos: dois pedidos ao mesmo tempo não deixam a equipa sem nenhum
    private void requireAnotherSuperAdmin(UUID leaving) {
        List<UUID> supers = jdbc.queryForList("""
                SELECT id FROM profiles
                WHERE role = 'ADMIN' AND admin_role = 'SUPER_ADMIN' AND suspended_at IS NULL
                ORDER BY id FOR UPDATE
                """, UUID.class);
        if (supers.stream().noneMatch(id -> !id.equals(leaving))) {
            throw ApiException.conflict("last_super_admin", "Tem de ficar pelo menos um super admin na equipa.");
        }
    }

    private TeamMember member(UUID id) {
        return members().stream().filter(m -> m.id().equals(id)).findFirst()
                .orElseThrow(() -> ApiException.notFound("member_not_found", "Esta pessoa não faz parte da equipa"));
    }

    private InvitationResponse toResponse(AdminInvitation i, String url, boolean emailSent) {
        String targetName = i.getProfileId() == null ? null : nameOf(i.getProfileId());
        return new InvitationResponse(i.getId(), i.getProfileId(), targetName, maskEmail(i.getEmail()), i.getAdminRole(),
                i.getNote(), i.statusAt(OffsetDateTime.now()), nameOf(i.getInvitedBy()), i.getCreatedAt(),
                i.getExpiresAt(), i.getAcceptedAt(), i.getRevokedAt(), url, emailSent);
    }

    private String nameOf(UUID id) {
        return profileRepository.findById(id).map(Profile::getFullName).orElse("—");
    }

    private Profile find(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("user_not_found", "Utilizador não encontrado"));
    }

    private String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.strip().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // "ana@gmail.com" → "an•••@gmail.com"
    static String maskEmail(String email) {
        if (email == null) return null;
        int at = email.indexOf('@');
        if (at <= 0) return "•••";
        return email.substring(0, Math.min(2, at)) + "•••" + email.substring(at);
    }

    private static String firstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return null;
        return fullName.strip().split("\\s+")[0];
    }

    private static String label(AdminRole role) {
        return switch (role) {
            case SUPER_ADMIN -> "Super admin";
            case OPERATIONS -> "Operações";
            case TRUST -> "Confiança";
            case GROWTH -> "Crescimento";
        };
    }
}
