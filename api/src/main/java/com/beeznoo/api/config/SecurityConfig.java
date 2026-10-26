package com.beeznoo.api.config;

import com.beeznoo.api.auth.security.JwtAuthFiltter;
import com.beeznoo.api.auth.security.OAuth2SuccessHandler;
import com.beeznoo.api.common.security.RateLimitFilter;
import com.beeznoo.api.common.security.SecurityProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ContentSecurityPolicyHeaderWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Duration;
import java.util.List;

/**
 * Ver claude/decisoes-produto.md (2026-10-23, segurança) e docs/SEGURANCA.md.
 * API sem estado (JWT no header, sem cookies de sessão) — por isso sem CSRF. A única sessão é a do fluxo OAuth2.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
    // Swagger UI (só em desenvolvimento) precisa de carregar os seus próprios scripts e estilos
    private static final String DOCS_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            + "frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

    private final JwtAuthFiltter jwtAuthFiltter;
    private final RateLimitFilter rateLimitFilter;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final SecurityProperties securityProperties;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        RequestMatcher api = PathPatternRequestMatcher.withDefaults().matcher("/api/**");

        return http
                // Só as origens de CORS_ALLOWED_ORIGINS (vazio = nenhuma): o front em staging chama a API noutro domínio
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/api/v1/auth/register",
                                "/api/v1/auth/register/verify",
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh",
                                "/api/v1/auth/password/reset/request",
                                "/api/v1/auth/password/reset/confirm",
                                "/api/v1/auth/google/register",
                                "/api/v1/auth/google/verify",
                                "/api/v1/auth/google/exchange",
                                "/api/v1/auth/login/mfa",
                                "/oauth2/**",
                                "/login/oauth2/**",
                                // só existem com API_DOCS_ENABLED=true (desligado por omissão)
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/actuator/health"
                        ).permitAll()
                        .requestMatchers("/api/v1/items/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/items/**", "/api/v1/categories/**").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                // API responde 401 (não 302 para o Google) — o frontend renova o token com /auth/refresh
                .exceptionHandling(e -> e.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED), api))
                .headers(h -> h
                        .contentTypeOptions(c -> {})
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .httpStrictTransportSecurity(hsts -> hsts.disable())
                        // sempre (atrás do proxy do Render o pedido chega em HTTP); o browser ignora-o fora de HTTPS
                        .addHeaderWriter(new StaticHeadersWriter("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
                        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"))
                        .addHeaderWriter(new StaticHeadersWriter("Cross-Origin-Opener-Policy", "same-origin"))
                        .addHeaderWriter(new StaticHeadersWriter("Cross-Origin-Resource-Policy", "same-origin"))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(api, new ContentSecurityPolicyHeaderWriter(API_CSP)))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(new NegatedRequestMatcher(api),
                                new ContentSecurityPolicyHeaderWriter(DOCS_CSP))))
                .oauth2Login(oauth2 -> oauth2
                        .successHandler(oAuth2SuccessHandler)
                        .failureHandler((request, response, exception) ->
                                response.sendRedirect(frontendUrl + "/oauth2/callback?status=error")))
                .addFilterBefore(jwtAuthFiltter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, JwtAuthFiltter.class)
                .build();
    }

    CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        List<String> origins = securityProperties.corsOrigins();
        if (origins.isEmpty()) return source;
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Beeznoo-Client", "X-Request-Id"));
        config.setExposedHeaders(List.of("Retry-After", "X-Request-Id"));
        // cookie do refresh (bz_refresh) entre domínios
        config.setAllowCredentials(true);
        config.setMaxAge(Duration.ofHours(1));
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    // Os dois filtros são @Component: sem isto o Spring Boot registava-os também fora da cadeia de segurança
    @Bean
    public FilterRegistrationBean<JwtAuthFiltter> jwtFilterRegistration(JwtAuthFiltter filter) {
        FilterRegistrationBean<JwtAuthFiltter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}
