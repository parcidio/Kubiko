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
        given(profileRepository.findActiveAccessById(profileId)).willReturn(java.util.Optional.of(access(UserRole.BOTH, null)));

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
        given(profileRepository.findActiveAccessById(profileId)).willReturn(java.util.Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    // Papel de equipa → permissões da área (decisoes-produto.md 2026-11-18)
    @Test
    void tokenAdmin_permissoesVemDoPapelDeEquipa() throws Exception {
        UUID profileId = UUID.randomUUID();
        Claims claims = Jwts.claims().subject(profileId.toString()).add("role", "ADMIN").build();
        given(jwtService.validateAndExtract("tok")).willReturn(claims);
        given(profileRepository.findActiveAccessById(profileId))
                .willReturn(java.util.Optional.of(access(UserRole.ADMIN, com.beeznoo.api.profile.entity.AdminRole.GROWTH)));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting("authority")
                .contains("ROLE_ADMIN", "PERM_OVERVIEW", "PERM_GROWTH_DESK", "PERM_MESSAGES", "PERM_USERS_READ")
                .doesNotContain("PERM_KYC", "PERM_TEAM", "PERM_AUDIT", "PERM_USERS_MANAGE");
    }

    // ADMIN sem papel de equipa: só ROLE_ADMIN (menor privilégio)
    @Test
    void tokenAdmin_semPapelDeEquipa_soRoleAdmin() throws Exception {
        UUID profileId = UUID.randomUUID();
        Claims claims = Jwts.claims().subject(profileId.toString()).add("role", "ADMIN").build();
        given(jwtService.validateAndExtract("tok")).willReturn(claims);
        given(profileRepository.findActiveAccessById(profileId)).willReturn(java.util.Optional.of(access(UserRole.ADMIN, null)));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer tok");
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting("authority").containsExactly("ROLE_ADMIN");
    }

    private static ProfileRepository.ActiveAccess access(UserRole role, com.beeznoo.api.profile.entity.AdminRole adminRole) {
        return new ProfileRepository.ActiveAccess() {
            public UserRole getRole() { return role; }
            public com.beeznoo.api.profile.entity.AdminRole getAdminRole() { return adminRole; }
        };
    }
}
