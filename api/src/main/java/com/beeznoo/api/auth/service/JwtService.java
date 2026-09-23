package com.beeznoo.api.auth.service;

import com.beeznoo.api.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.awt.dnd.DropTarget;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {

    private final JwtProperties jwtProperties;

    public String generateAccessToken(UUID profileId, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtProperties.expirationMinutes() * 60_000L);

        return Jwts.builder()
                .subject(profileId.toString())
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims validateAndExtract(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
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
