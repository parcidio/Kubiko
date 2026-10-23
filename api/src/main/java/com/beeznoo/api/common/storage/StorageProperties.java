package com.beeznoo.api.common.storage;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

// Backblaze B2 pela API S3. Sem valores por omissão: a API não arranca sem storage configurado.
@Validated
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        @NotBlank String endpoint,
        @NotBlank String region,
        @NotBlank String accessKey,
        @NotBlank String secretKey,
        @NotBlank String bucket,
        @NotNull Duration signedUrlTtl
) {}
