package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class JwtAuthFiltterTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final ProfileRepository profileRepository = mock(ProfileRepository.class);
    private final JwtAuthFiltter filter = new JwtAuthFiltter(jwtService, profileRepository);

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    // Regressão: os controllers usam @AuthenticationPrincipal UUID — com String chegava null
    @Test
    void tokenValido_principalEUuid() throws Exception {
        UUID profileId = UUID.randomUUID();
        Claims claims = Jwts.claims().subject(profileId.toString()).add("role", "RENTER").build();
        given(jwtService.validateAndExtract("tok")).willReturn(claims);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth.getPrincipal()).isEqualTo(profileId);
        assertThat(auth.getName()).isEqualTo(profileId.toString());
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_RENTER");
    }

    @Test
    void subjectQueNaoEUuid_ficaSemAutenticacao() throws Exception {
        Claims claims = Jwts.claims().subject("nao-e-uuid").add("role", "RENTER").build();
        given(jwtService.validateAndExtract("tok")).willReturn(claims);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    // Admin despromovido: o token ainda diz ADMIN, mas o papel vem da BD
    @Test
    void tokenAdmin_papelConfirmadoNaBd() throws Exception {
        UUID profileId = UUID.randomUUID();
        Claims claims = Jwts.claims().subject(profileId.toString()).add("role", "ADMIN").build();
        given(jwtService.validateAndExtract("tok")).willReturn(claims);
        given(profileRepository.findActiveRoleById(profileId)).willReturn(java.util.Optional.of(UserRole.BOTH));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting("authority").containsExactly("ROLE_BOTH");
    }

    @Test
    void tokenAdmin_contaSuspensaOuApagada_ficaSemAutenticacao() throws Exception {
        UUID profileId = UUID.randomUUID();
        Claims claims = Jwts.claims().subject(profileId.toString()).add("role", "ADMIN").build();
        given(jwtService.validateAndExtract("tok")).willReturn(claims);
        given(profileRepository.findActiveRoleById(profileId)).willReturn(java.util.Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
