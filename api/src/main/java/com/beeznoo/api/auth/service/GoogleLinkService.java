package com.beeznoo.api.auth.service;

import com.beeznoo.api.common.util.Emails;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.service.SecurityEventService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.Serializable;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Associar uma conta Google a um perfil existente, com a sessão Beeznoo iniciada (decisoes-produto.md 2026-11-11).
 * A intenção fica na sessão HTTP do fluxo OAuth2 (cookie httpOnly, SameSite=Lax) — nunca num token no URL.
 */
@Slf4j
@Service
public class GoogleLinkService {

    static final String SESSION_ATTR = "bz.google.link";
    static final Duration INTENT_TTL = Duration.ofMinutes(10);

    public enum LinkResult {
        LINKED("linked"),
        ALREADY_LINKED("already"),     // este perfil já tem outra conta Google
        GOOGLE_IN_USE("conflict");     // esta conta Google já está noutro perfil

        public final String code;

        LinkResult(String code) {
            this.code = code;
        }
    }

    record LinkIntent(UUID profileId, Instant expiresAt) implements Serializable {}

    private final ProfileRepository profileRepository;
    private final SecurityEventService securityEvents;

    public GoogleLinkService(ProfileRepository profileRepository, SecurityEventService securityEvents) {
        this.profileRepository = profileRepository;
        this.securityEvents = securityEvents;
    }

    /** Passo 1 (autenticado): guarda "o próximo login Google associa-se a este perfil" na sessão. */
    @Transactional(readOnly = true)
    public void start(UUID profileId, HttpServletRequest request) {
        Profile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
        if (profile.getGoogleId() != null) {
            throw new IllegalStateException("A tua conta já tem uma conta Google associada");
        }
        HttpSession session = request.getSession(true);
        session.setAttribute(SESSION_ATTR, new LinkIntent(profileId, Instant.now().plus(INTENT_TTL)));
    }

    /** No regresso do Google: lê e apaga a intenção (uso único). Vazia se não houver ou tiver expirado. */
    public Optional<UUID> consume(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return Optional.empty();
        Object value = session.getAttribute(SESSION_ATTR);
        session.removeAttribute(SESSION_ATTR);
        if (value instanceof LinkIntent intent && intent.expiresAt().isAfter(Instant.now())) {
            return Optional.of(intent.profileId());
        }
        return Optional.empty();
    }

    /**
     * Passo 2: associa. Se o Google confirmou o mesmo email do perfil, o email fica verificado; se o perfil não tinha
     * email, fica com o do Google (quando não pertence a outra conta).
     */
    @Transactional
    public LinkResult link(UUID profileId, String googleId, String googleVerifiedEmail) {
        Profile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
        Optional<Profile> owner = profileRepository.findByGoogleId(googleId);
        if (owner.isPresent() && !owner.get().getId().equals(profileId)) return LinkResult.GOOGLE_IN_USE;
        if (profile.getGoogleId() != null && !profile.getGoogleId().equals(googleId)) return LinkResult.ALREADY_LINKED;

        profile.setGoogleId(googleId);
        String email = Emails.normalize(googleVerifiedEmail);
        if (email != null) {
            if (profile.getEmail() == null && !profileRepository.existsByEmailIgnoreCase(email)) {
                profile.setEmail(email);
                profile.setEmailVerifiedAt(OffsetDateTime.now());
            } else if (email.equalsIgnoreCase(profile.getEmail()) && profile.getEmailVerifiedAt() == null) {
                profile.setEmail(email);
                profile.setEmailVerifiedAt(OffsetDateTime.now());
            }
        }
        securityEvents.record(SecurityEventType.GOOGLE_LINKED, profileId, null, Map.of("withSession", true));
        log.info("Google associado com sessão iniciada — profileId={}", profileId);
        return LinkResult.LINKED;
    }
}
