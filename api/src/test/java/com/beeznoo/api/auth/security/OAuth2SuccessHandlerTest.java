package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.dto.AuthDtos.AuthResponse;
import com.beeznoo.api.auth.entity.GooglePendingSignup;
import com.beeznoo.api.auth.repository.GooglePendingSignupRepository;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.ProfileService;
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
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OAuth2SuccessHandlerTest {

    @Mock
    private ProfileService profileService;

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private Authentication authentication;

    @Mock
    private OidcUser oidcUser;

    @Mock
    private GooglePendingSignupRepository googlePendingSignupRepository;

    @Mock
    private AuthService authService;

    @InjectMocks
    private OAuth2SuccessHandler oAuth2SuccessHandler;

    private final String googleId = "google-user-123";
    private final String email = "user@example.com";
    private final String avatarUrl = "https://example.com/avatar.jpg";
    private final AuthResponse tokens = new AuthResponse("access-token", "refresh-token", 900L);

    @BeforeEach
    void setUp() {
        when(authentication.getPrincipal()).thenReturn(oidcUser);
        when(oidcUser.getSubject()).thenReturn(googleId);
        when(oidcUser.getEmail()).thenReturn(email);
        when(oidcUser.getPicture()).thenReturn(avatarUrl);
    }

    @Test
    @DisplayName("Deve redirecionar com sucesso quando o perfil já está associado por googleId")
    void shouldRedirectWhenProfileAlreadyLinked() throws Exception {
        UUID profileId = UUID.randomUUID();
        Profile profile = Profile.builder().id(profileId).googleId(googleId).build();

        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.of(profile));
        when(authService.issueTokensForProfile(profileId)).thenReturn(tokens);

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        verify(response).sendRedirect("/oauth2/callback?status=success&profileId=" + profileId
                + "&accessToken=access-token&refreshToken=refresh-token&expiresIn=900");
        verifyNoInteractions(profileService);
    }

    @Test
    @DisplayName("Deve associar automaticamente por email se perfil existir com mesmo email")
    void shouldAutoLinkByEmailWhenProfileExistsWithEmail() throws Exception {
        UUID profileId = UUID.randomUUID();
        Profile profile = Profile.builder().id(profileId).email(email).build();

        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.empty());
        when(profileRepository.findByEmail(email)).thenReturn(Optional.of(profile));
        when(authService.issueTokensForProfile(profileId)).thenReturn(tokens);

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        verify(profileRepository).save(profile);
        verify(response).sendRedirect("/oauth2/callback?status=success&profileId=" + profileId
                + "&accessToken=access-token&refreshToken=refresh-token&expiresIn=900");
    }

    @Test
    @DisplayName("Deve criar registo pendente e redirecionar pending_phone quando state for um CSRF token do Spring e não houver perfil")
    void shouldRedirectPendingPhoneForCsrfStateWhenProfileMissing() throws Exception {
        UUID pendingToken = UUID.randomUUID();
        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.empty());
        when(profileRepository.findByEmail(email)).thenReturn(Optional.empty());
        when(request.getParameter("state")).thenReturn("SpringSecurityOAuth2CsrfStateTokenStringThatIsLongerThan36Chars");
        when(oidcUser.getFullName()).thenReturn("Nova Conta");
        when(googlePendingSignupRepository.save(any(GooglePendingSignup.class)))
                .thenAnswer(invocation -> {
                    GooglePendingSignup pending = invocation.getArgument(0);
                    pending.setToken(pendingToken);
                    return pending;
                });

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        ArgumentCaptor<GooglePendingSignup> captor = ArgumentCaptor.forClass(GooglePendingSignup.class);
        verify(googlePendingSignupRepository).save(captor.capture());
        GooglePendingSignup saved = captor.getValue();
        assertThat(saved.getGoogleId()).isEqualTo(googleId);
        assertThat(saved.getEmail()).isEqualTo(email);
        assertThat(saved.getAvatarUrl()).isEqualTo(avatarUrl);
        assertThat(saved.getExpiresAt()).isAfter(OffsetDateTime.now());

        verify(response).sendRedirect("/oauth2/callback?status=pending_phone&pendingToken=" + pendingToken);
        verifyNoInteractions(profileService);
    }

    @Test
    @DisplayName("Deve associar conta Google via state quando state for um profileId UUID válido")
    void shouldLinkGoogleAccountSuccessfullyWhenStateIsValidUuid() throws Exception {
        UUID profileId = UUID.randomUUID();
        when(profileRepository.findByGoogleId(googleId)).thenReturn(Optional.empty());
        when(profileRepository.findByEmail(email)).thenReturn(Optional.empty());
        when(request.getParameter("state")).thenReturn(profileId.toString());
        when(authService.issueTokensForProfile(profileId)).thenReturn(tokens);

        oAuth2SuccessHandler.onAuthenticationSuccess(request, response, authentication);

        verify(profileService).linkGoogle(profileId, googleId, email, avatarUrl);
        verify(response).sendRedirect("/oauth2/callback?status=success&profileId=" + profileId
                + "&accessToken=access-token&refreshToken=refresh-token&expiresIn=900");
    }
}
