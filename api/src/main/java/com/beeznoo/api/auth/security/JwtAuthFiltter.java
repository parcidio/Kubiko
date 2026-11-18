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
import com.beeznoo.api.profile.entity.AdminPermission;

import java.util.ArrayList;
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
            List<SimpleGrantedAuthority> authorities = new ArrayList<>();
            if (UserRole.ADMIN.name().equals(role)) {
                // O papel vem no token (15 min). Para ADMIN confirma-se na BD em cada pedido: um admin despromovido
                // ou suspenso perde os poderes já, não quando o token expirar (decisoes-produto.md 2026-11-17).
                // As permissões da área vêm do papel de equipa (decisoes-produto.md 2026-11-18); sem papel de
                // equipa, só ROLE_ADMIN (menor privilégio: nenhuma área além do que pedir só ROLE_ADMIN).
                ProfileRepository.ActiveAccess access = profileRepository.findActiveAccessById(profileId)
                        .orElseThrow(() -> new JwtException("Conta inexistente ou suspensa"));
                role = access.getRole().name();
                if (access.getRole() == UserRole.ADMIN && access.getAdminRole() != null) {
                    for (AdminPermission p : access.getAdminRole().permissions()) {
                        authorities.add(new SimpleGrantedAuthority(p.authority()));
                    }
                }
            }
            authorities.addFirst(new SimpleGrantedAuthority("ROLE_" + role));

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            profileId,
                            null,
                            authorities
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
