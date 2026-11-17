package com.beeznoo.api.auth.security;

import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFiltter  extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final ProfileRepository profileRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            Claims claims = jwtService.validateAndExtract(token);
            // UUID (não String): os controllers recebem @AuthenticationPrincipal UUID profileId
            UUID profileId = UUID.fromString(claims.getSubject());
            String role = claims.get("role", String.class);
            if (role == null || role.isBlank()) throw new JwtException("Token sem papel");
            if (UserRole.ADMIN.name().equals(role)) {
                // O papel vem no token (15 min). Para ADMIN confirma-se na BD em cada pedido: um admin despromovido
                // ou suspenso perde os poderes já, não quando o token expirar (decisoes-produto.md 2026-11-17)
                role = profileRepository.findActiveRoleById(profileId).map(Enum::name)
                        .orElseThrow(() -> new JwtException("Conta inexistente ou suspensa"));
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            profileId,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (JwtException | IllegalArgumentException e) {
            // sem o token nem o motivo detalhado no log; o pedido segue sem autenticação (→ 401 nas rotas protegidas)
            SecurityContextHolder.clearContext();
            log.debug("JWT recusado ({})", e.getClass().getSimpleName());
        }

        filterChain.doFilter(request, response);
    }
}
