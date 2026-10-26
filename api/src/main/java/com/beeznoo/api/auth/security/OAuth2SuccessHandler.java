package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.entity.GooglePendingSignup;
import com.beeznoo.api.auth.repository.GooglePendingSignupRepository;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.service.SecurityEventService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Chamado pelo Spring Security depois do login Google. Ver claude/decisoes-produto.md (2026-10-23, segurança).
 *
 * 1. Já existe perfil com este googleId → redirect com um código de uso único (60 s), trocado por tokens em
 *    POST /auth/google/exchange. Os tokens nunca vão na URL (ficariam no histórico, nos logs e no Referer).
 * 2. O email do Google já pertence a um perfil:
 *    - email verificado na Beeznoo E no Google, e o perfil sem Google → associa e entra (mesma pessoa provada dos dois lados);
 *    - caso contrário NÃO associa (pré-sequestro: alguém podia ter registado o email de outra pessoa). Pede telefone.
 * 3. Caso contrário → registo pendente; o frontend pede o telefone e confirma por OTP.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private static final long PENDING_SIGNUP_TTL_MINUTES = 15;

    private final ProfileRepository profileRepository;
    private final AuthService authService;
    private final GooglePendingSignupRepository googlePendingSignupRepository;
    private final SecurityEventService securityEvents;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OidcUser oidcUser = (OidcUser) authentication.getPrincipal();
        String googleId = oidcUser.getSubject();
        // Só usamos o email do Google se o próprio Google o deu como verificado
        String email = Boolean.TRUE.equals(oidcUser.getEmailVerified()) ? oidcUser.getEmail() : null;

        Optional<Profile> existing = profileRepository.findByGoogleId(googleId);
        if (existing.isPresent()) {
            log.info("Google OAuth: login — profileId={}", existing.get().getId());
            redirect(response, "status=success&code=" + encode(authService.issueLoginCode(existing.get().getId())));
            return;
        }

        Optional<Profile> byEmail = email == null ? Optional.empty() : profileRepository.findByEmail(email);
        if (byEmail.isPresent()) {
            Profile profile = byEmail.get();
            if (profile.getEmailVerifiedAt() != null && profile.getGoogleId() == null) {
                profile.setGoogleId(googleId);
                profileRepository.save(profile);
                securityEvents.record(SecurityEventType.GOOGLE_LINKED, profile.getId(), null, Map.of());
                log.info("Google OAuth: associado por email verificado — profileId={}", profile.getId());
                redirect(response, "status=success&code=" + encode(authService.issueLoginCode(profile.getId())));
                return;
            }
            securityEvents.record(SecurityEventType.GOOGLE_EMAIL_IN_USE, profile.getId(), null, Map.of());
            log.info("Google OAuth: email já usado por outra conta — sem associação automática");
            redirect(response, "status=email_in_use");
            return;
        }

        GooglePendingSignup pending = googlePendingSignupRepository.save(GooglePendingSignup.builder()
                .googleId(googleId)
                .email(email)
                .fullName(oidcUser.getFullName())
                .avatarUrl(oidcUser.getPicture())
                .expiresAt(OffsetDateTime.now().plusMinutes(PENDING_SIGNUP_TTL_MINUTES))
                .build());

        // sem o pendingToken no log: é uma credencial temporária
        log.info("Google OAuth: registo pendente criado — id interno {}", pending.getToken().toString().substring(0, 8));
        redirect(response, "status=pending_phone&pendingToken=" + pending.getToken());
    }

    private void redirect(HttpServletResponse response, String query) throws IOException {
        String base = frontendUrl != null && !frontendUrl.isBlank() ? frontendUrl : "";
        // no-referrer: o código no URL de destino não passa para terceiros
        response.setHeader("Referrer-Policy", "no-referrer");
        response.sendRedirect(base + "/oauth2/callback?" + query);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
