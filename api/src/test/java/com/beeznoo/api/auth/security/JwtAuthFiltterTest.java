package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.service.JwtService;
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
    private final JwtAuthFiltter filter = new JwtAuthFiltter(jwtService);

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
}
