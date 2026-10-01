    package com.beeznoo.api.config;
    
    import com.beeznoo.api.auth.security.JwtAuthFiltter;
    import com.beeznoo.api.auth.security.OAuth2SuccessHandler;
    import lombok.RequiredArgsConstructor;
    import org.springframework.http.HttpMethod;
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
        private final OAuth2SuccessHandler oAuth2SuccessHandler;
    
        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http)  throws Exception {
            return http
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
                                    "/oauth2/**",
                                    "/swagger-ui/**",
                                    "/swagger-ui.html",
                                    "/v3/api-docs/**",
                                    "/actuator/health"
                            ).permitAll()
                            .requestMatchers("/api/v1/items/me").authenticated()
                            .requestMatchers(HttpMethod.GET, "/api/v1/items/**", "/api/v1/categories/**")
                            .permitAll()
                            .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "MODERADOR")
                            .anyRequest().authenticated()
                    )
                    .oauth2Login(oauth2 -> oauth2.successHandler(oAuth2SuccessHandler))
                    .addFilterBefore(jwtAuthFiltter, UsernamePasswordAuthenticationFilter.class)
                    .build();
        }
    }
