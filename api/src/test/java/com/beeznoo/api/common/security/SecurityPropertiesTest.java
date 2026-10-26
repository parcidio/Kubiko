package com.beeznoo.api.common.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityPropertiesTest {

    private static SecurityProperties props(String sameSite, String origins) {
        return new SecurityProperties(true, "memory", 0, 1_048_576, true, true, sameSite, origins);
    }

    @Test
    void refreshCookieIsStrictUnlessConfigured() {
        assertThat(props(null, null).refreshCookieSameSite()).isEqualTo("Strict");
        assertThat(props("whatever", null).refreshCookieSameSite()).isEqualTo("Strict");
        assertThat(props("none", null).refreshCookieSameSite()).isEqualTo("None");
        assertThat(props("None", null).crossSiteCookie()).isTrue();
        assertThat(props("Lax", null).crossSiteCookie()).isFalse();
    }

    @Test
    void corsOriginsAreTrimmedAndEmptyMeansNone() {
        assertThat(props(null, "").corsOrigins()).isEmpty();
        assertThat(props(null, null).corsOrigins()).isEmpty();
        assertThat(props(null, " https://staging.beeznoo.ao , https://beeznoo.ao,").corsOrigins())
                .containsExactly("https://staging.beeznoo.ao", "https://beeznoo.ao");
    }
}
