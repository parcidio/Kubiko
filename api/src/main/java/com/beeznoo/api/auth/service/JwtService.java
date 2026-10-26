package com.beeznoo.api.auth.service;

import com.beeznoo.api.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {

    // Verificados em cada pedido: um token de outro sistema (ou de outro tipo) com a mesma chave é recusado
    static final String ISSUER = "beeznoo-api";
    static final String AUDIENCE = "beeznoo-app";
    static final String TYPE_ACCESS = "access";

    private final JwtProperties jwtProperties;

    public String generateAccessToken(UUID profileId, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtProperties.expirationMinutes() * 60_000L);

        return Jwts.builder()
                .issuer(ISSUER)
                .audience().add(AUDIENCE).and()
                .subject(profileId.toString())
                .claim("typ", TYPE_ACCESS)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims validateAndExtract(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .requireIssuer(ISSUER)
                .requireAudience(AUDIENCE)
                .require("typ", TYPE_ACCESS)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID extractProfileId(String token) {
        return UUID.fromString(validateAndExtract(token).getSubject());
    }

    public long accessTokenExpiresInSeconds() {
        return jwtProperties.expirationMinutes() * 60L;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(
                jwtProperties.secret().getBytes(StandardCharsets.UTF_8)
        );
    }
}
