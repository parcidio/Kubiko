    package com.beeznoo.api.config;
    
    import com.beeznoo.api.auth.security.JwtAuthFiltter;
    import lombok.RequiredArgsConstructor;
    import org.springframework.context.annotation.Bean;
    import org.springframework.context.annotation.Configuration;
    import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
    import org.springframework.security.config.annotation.web.builders.HttpSecurity;
    import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
    import org.springframework.security.config.http.SessionCreationPolicy;
    import org.springframework.security.web.SecurityFilterChain;
    import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
    
    @Configuration
    @EnableWebSecurity
    @EnableMethodSecurity
    @RequiredArgsConstructor
    public class SecurityConfig {
    
        private final JwtAuthFiltter jwtAuthFiltter;
    
        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http)  throws Exception {
            return http
                    .csrf(csrf -> csrf.disable())
                    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                    .authorizeHttpRequests(auth -> auth
                            .requestMatchers(
                                    "/api/v1/auth/**",
                                    "/api/v1/items/**",
                                    "/swagger-ui/**",
                                    "/swagger-ui.html",
                                    "/v3/api-docs",
                                    "/v3/api-docs/**",
                                    "/swagger-resources/",
                                    "/webjars/**",
                                    "/actuator/health"
                            ).permitAll()
                            .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "MODERADOR")
                            .anyRequest().authenticated()
                    )
                    .oauth2Login(oauth2 -> oauth2
                            .successHandler((request, response, authentication) -> {
                                response.sendRedirect("/api/v1/auth/oauth/success");
                            })
                    )
                    .addFilterBefore(jwtAuthFiltter, UsernamePasswordAuthenticationFilter.class)
                    .build();
        }
    }
