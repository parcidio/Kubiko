package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.entity.GooglePendingSignup;
import com.beeznoo.api.auth.repository.GooglePendingSignupRepository;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OAuth2SuccessHandlerTest {

    @Mock private ProfileRepository profileRepository;
    @Mock private HttpServletRequest request;
    @Mock private HttpServletResponse response;
    @Mock private Authentication authentication;
    @Mock private OidcUser oidcUser;
    @Mock private GooglePendingSignupRepository googlePendingSignupRepository;
    @Mock private AuthService authService;

    @InjectMocks
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    private final String googleId = "google-user-123";
    private final String email = "user@example.com";

    @BeforeEach
    void setUp() {
        when(authentication.getPrincipal()).thenReturn(oidcUser);
        when(oidcUser.getSubject()).thenReturn(googleId);
        when(oidcUser.getEmail()).thenReturn(email);
        when(oidcUser.getEmailVerified()).thenReturn(true);
        when(oidcUser.getPicture()).thenReturn("https://example.com/avatar.jpg");
    }

    @Test
    @DisplayName("Perfil já associado: redirect com código de uso único, nunca com tokens na URL")
    void linkedProfile_redirectsWithOneTimeCode() throws Exception {
        UUID profileId = UUID.randomUUID();
        when(profileRepository.findByGoogleId(googleId))
                .thenReturn(Optional.of(Profile.builder().id(profileId).googleId(googleId).build()));
        when(authService.issueLoginCode(profileId)).thenReturn("one-time-code");

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(response).sendRedirect(url.capture());
        assertThat(url.getValue()).isEqualTo("/oauth2/callback?status=success&code=one-time-code");
        assertThat(url.getValue()).doesNotContain("accessToken", "refreshToken");
        verify(response).setHeader("Referrer-Policy", "no-referrer");
    }

    @Test
    @DisplayName("Email do Google já usado noutra conta: NÃO associa (pré-sequestro de conta)")
    void emailInUse_doesNotAutoLink() throws Exception {
        Profile other = Profile.builder().id(UUID.randomUUID()).email(email).build();
        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.empty());
        when(profileRepository.findByEmail(email)).thenReturn(Optional.of(other));

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        verify(response).sendRedirect("/oauth2/callback?status=email_in_use");
        verify(profileRepository, never()).save(any());
        verify(authService, never()).issueLoginCode(any());
        assertThat(other.getGoogleId()).isNull();
    }

    @Test
    @DisplayName("Parâmetro state com o UUID de outro perfil é ignorado (não associa contas)")
    void stateWithProfileId_isIgnored() throws Exception {
        when(request.getParameter("state")).thenReturn(UUID.randomUUID().toString());
        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.empty());
        when(profileRepository.findByEmail(email)).thenReturn(Optional.empty());
        when(googlePendingSignupRepository.save(any())).thenAnswer(inv -> {
            GooglePendingSignup p = inv.getArgument(0);
            p.setToken(UUID.randomUUID());
            return p;
        });

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        verify(authService, never()).issueLoginCode(any());
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(response).sendRedirect(url.capture());
        assertThat(url.getValue()).startsWith("/oauth2/callback?status=pending_phone&pendingToken=");
    }

    @Test
    @DisplayName("Sem perfil: cria registo pendente; email não verificado pelo Google não é guardado")
    void noProfile_createsPendingSignupWithoutUnverifiedEmail() throws Exception {
        when(oidcUser.getEmailVerified()).thenReturn(false);
        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.empty());
        when(googlePendingSignupRepository.save(any())).thenAnswer(inv -> {
            GooglePendingSignup p = inv.getArgument(0);
            p.setToken(UUID.randomUUID());
            return p;
        });

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        ArgumentCaptor<GooglePendingSignup> saved = ArgumentCaptor.forClass(GooglePendingSignup.class);
        verify(googlePendingSignupRepository).save(saved.capture());
        assertThat(saved.getValue().getEmail()).isNull();
        verify(profileRepository, never()).findByEmail(any());
    }
}
