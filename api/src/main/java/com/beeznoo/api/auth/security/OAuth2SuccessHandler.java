package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.ProfileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.beeznoo.api.profile.entity.Profile;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Chamado pelo Spring Security após o Google OAuth2 ser concluído com sucesso.
 *
 * Fluxo:
 * 1. Utilizador já autenticado por OTP (tem JWT no frontend) toca em "Ligar conta Google"
 * 2. O frontend guarda o profileId no estado e inicia o OAuth2 flow
 * 3. Após callback do Google, este handler:
 *    a. Extrai o googleId e email do OidcUser
 *    b. Verifica se já existe perfil com este googleId
 *    c. Se não existe → associa ao perfil do utilizador autenticado (via state param)
 *    d. Redireciona para o frontend com resultado
 *
 * NOTA: o parâmetro "state" é usado para passar o profileId do utilizador
 * autenticado ao longo do OAuth2 flow. O frontend deve incluir o profileId
 * no parâmetro state ao iniciar o flow.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final ProfileService profileService;
    private final ProfileRepository profileRepository;
    private final AuthService authService;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                         HttpServletResponse response,
                                         Authentication authentication) throws IOException {

        OidcUser oidcUser = (OidcUser) authentication.getPrincipal();

        String googleId  = oidcUser.getSubject();
        String email     = oidcUser.getEmail();
        String avatarUrl = oidcUser.getPicture();

        // Caso 1: já existe perfil com este googleId → só emite tokens
        Optional<Profile> existingGoogle = profileRepository.findByGoogleId(googleId);
        if (existingGoogle.isPresent()) {
            Profile profile = existingGoogle.get();
            log.info("Google OAuth: perfil já associado — profileId={}", profile.getId());
            redirectWithSuccess(response, profile.getId());
            return;
        }

        // Caso 2: associar por email existente
        if (email != null && !email.isBlank()) {
            Optional<Profile> existingEmail = profileRepository.findByEmail(email);
            if (existingEmail.isPresent()) {
                Profile profile = existingEmail.get();
                profile.setGoogleId(googleId);
                if (avatarUrl != null && (profile.getAvatarUrl() == null || profile.getAvatarUrl().isBlank())) {
                    profile.setAvatarUrl(avatarUrl);
                }
                profileRepository.save(profile);
                log.info("Google OAuth: conta associada por email — profileId={}", profile.getId());
                redirectWithSuccess(response, profile.getId());
                return;
            }
        }

        // Caso 3: associar ao perfil indicado no state param se for um UUID válido
        String stateParam = request.getParameter("state");
        if (stateParam != null && !stateParam.isBlank()) {
            try {
                UUID profileId = UUID.fromString(stateParam);
                profileService.linkGoogle(profileId, googleId, email, avatarUrl);
                log.info("Google OAuth: conta associada via state — profileId={}", profileId);
                redirectWithSuccess(response, profileId);
                return;
            } catch (IllegalArgumentException e) {
                log.info("Google OAuth: state parâmetro não é UUID de perfil (CSRF state)");
            } catch (IllegalStateException e) {
                log.warn("Google OAuth: falha ao associar via state — {}", e.getMessage());
                redirectWithError(response, "link_failed");
                return;
            }
        }

        log.warn("Google OAuth: nenhum perfil encontrado para associar ao googleId={}", googleId);
        redirectWithError(response, "account_not_found");
    }

    private String getBaseRedirectUrl() {
        return (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl : "";
    }

    private void redirectWithSuccess(HttpServletResponse response, UUID profileId) {
        try {
            response.sendRedirect(getBaseRedirectUrl() + "/oauth2/callback?status=success&profileId=" + profileId);
        } catch (IOException e) {
            log.error("Redirect falhou: {}", e.getMessage());
        }
    }

    private void redirectWithError(HttpServletResponse response, String reason) {
        try {
            response.sendRedirect(getBaseRedirectUrl() + "/oauth2/callback?status=error&reason=" + reason);
        } catch (IOException e) {
            log.error("Redirect de erro falhou: {}", e.getMessage());
        }
    }
}