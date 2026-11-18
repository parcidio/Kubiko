package com.beeznoo.api.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/** clientip-xff-trusted-hops-bypass-via-direct-origin: N-ésima entrada a contar da direita, senão remoteAddr. */
class ClientIpTest {

    private static final String REMOTE = "10.0.0.1";

    private static String ip(int trusted, String... xff) {
        ClientIp clientIp = new ClientIp(new SecurityProperties(true, "memory", trusted, 1024, false, true));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(REMOTE);
        for (String h : xff) request.addHeader("X-Forwarded-For", h);
        return clientIp.of(request);
    }

    @Test
    void semProxiesConfiados_ignoraOCabecalho() {
        assertThat(ip(0, "203.0.113.7")).isEqualTo(REMOTE);
    }

    @Test
    void leANesimaEntradaDaDireita_ignorandoAsInventadasAEsquerda() {
        assertThat(ip(1, "198.51.100.1, 203.0.113.7")).isEqualTo("203.0.113.7");
        assertThat(ip(2, "1.2.3.4, 203.0.113.7, 198.51.100.9")).isEqualTo("203.0.113.7");
        assertThat(ip(2, "1.2.3.4, 203.0.113.7", "198.51.100.9")).isEqualTo("203.0.113.7");
        assertThat(ip(1, "2001:db8::1")).isEqualTo("2001:db8::1");
    }

    @Test
    void cadeiaMaisCurtaQueOEsperado_usaRemoteAddr_nuncaAEntradaDaEsquerda() {
        assertThat(ip(2, "203.0.113.7")).isEqualTo(REMOTE);
        assertThat(ip(3, "1.2.3.4, 203.0.113.7")).isEqualTo(REMOTE);
        assertThat(ip(1)).isEqualTo(REMOTE);
        assertThat(ip(1, "")).isEqualTo(REMOTE);
    }

    @Test
    void entradaMalformada_usaRemoteAddr() {
        assertThat(ip(1, "1.2.3.4, evil")).isEqualTo(REMOTE);
        assertThat(ip(2, "1.2.3.4,, 198.51.100.9")).isEqualTo(REMOTE);
        assertThat(ip(1, "999.1.1.1")).isEqualTo(REMOTE);
        assertThat(ip(1, "1.2.3.4\r\nX: y")).isEqualTo(REMOTE);
    }
}
