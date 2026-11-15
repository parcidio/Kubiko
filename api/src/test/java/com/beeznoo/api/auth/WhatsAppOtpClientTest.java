package com.beeznoo.api.auth;

import com.beeznoo.api.auth.service.WhatsAppOtpClient;
import com.beeznoo.api.config.WhatsAppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

/** Cliente do Losambo (WhatsApp) contra um servidor simulado — decisoes-produto.md 2026-11-15. */
class WhatsAppOtpClientTest {

    private static final String URL = "https://message.test/v1";

    private record Setup(WhatsAppOtpClient client, MockRestServiceServer server) {}

    private Setup setup(String env, String prd, String tst) {
        WhatsAppProperties props = new WhatsAppProperties(URL, prd, tst, env, "Beeznoo");
        RestClient.Builder builder = RestClient.builder().baseUrl(props.apiUrl())
                .defaultHeader("Authorization", "Bearer " + props.apiKey());
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        return new Setup(new WhatsAppOtpClient(builder.build(), props), server);
    }

    @Test
    void envia_comAChaveDoAmbiente_eLeReferenciaEValidade() {
        Setup s = setup("tst", "lsb_live_prd", "lsb_live_tst");
        s.server().expect(requestTo(URL + "/otp/send")).andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer lsb_live_tst"))
                .andExpect(jsonPath("$.to").value("+244923000111"))
                .andExpect(jsonPath("$.app").value("Beeznoo"))
                .andRespond(withStatus(HttpStatus.ACCEPTED).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"id\":\"otp_8f2c\",\"status\":\"sent\",\"via\":\"beeznoo-01\",\"expires_in\":300}"));

        WhatsAppOtpClient.OtpSent sent = s.client().send("+244923000111");
        assertThat(sent.id()).isEqualTo("otp_8f2c");
        assertThat(sent.expiresInSeconds()).isEqualTo(300);
        s.server().verify();
    }

    @Test
    void numeroSemWhatsApp_lancaNotOnWhatsApp_eOutrosErrosUnavailable() {
        Setup s = setup("prd", "lsb_live_prd", null);
        s.server().expect(requestTo(URL + "/otp/send")).andExpect(header("Authorization", "Bearer lsb_live_prd"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"not_on_whatsapp\"}"));
        assertThatThrownBy(() -> s.client().send("+244923000111")).isInstanceOf(WhatsAppOtpClient.NotOnWhatsAppException.class);

        s.server().reset();
        s.server().expect(requestTo(URL + "/otp/send"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"number_capped\"}"));
        assertThatThrownBy(() -> s.client().send("+244923000111")).isInstanceOf(WhatsAppOtpClient.UnavailableException.class);
    }

    @Test
    void valida_enviaReferenciaNumeroECodigo() {
        Setup s = setup("tst", null, "lsb_live_tst");
        s.server().expect(requestTo(URL + "/otp/verify"))
                .andExpect(jsonPath("$.id").value("otp_8f2c"))
                .andExpect(jsonPath("$.to").value("+244923000111"))
                .andExpect(jsonPath("$.code").value("123456"))
                .andRespond(withSuccess("{\"status\":\"verified\"}", MediaType.APPLICATION_JSON));
        assertThat(s.client().verify("otp_8f2c", "+244923000111", "123456")).isTrue();

        s.server().reset();
        s.server().expect(requestTo(URL + "/otp/verify"))
                .andRespond(withSuccess("{\"valid\":false}", MediaType.APPLICATION_JSON));
        assertThat(s.client().verify("otp_8f2c", "+244923000111", "000000")).isFalse();

        s.server().reset();
        s.server().expect(requestTo(URL + "/otp/verify"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_code\"}"));
        assertThat(s.client().verify("otp_8f2c", "+244923000111", "000000")).isFalse();

        s.server().reset();
        s.server().expect(requestTo(URL + "/otp/verify")).andRespond(withServerError());
        assertThatThrownBy(() -> s.client().verify("otp_8f2c", "+244923000111", "123456"))
                .isInstanceOf(WhatsAppOtpClient.UnavailableException.class);
    }

    @Test
    void semChaveDoAmbiente_naoEstaConfigurado_eNaoFazPedidos() {
        Setup s = setup("prd", "", "lsb_live_tst");
        assertThat(s.client().configured()).isFalse();
        assertThatThrownBy(() -> s.client().send("+244923000111")).isInstanceOf(WhatsAppOtpClient.UnavailableException.class);
        assertThatThrownBy(() -> new WhatsAppProperties(URL, "a", "b", "producao", null)).isInstanceOf(IllegalArgumentException.class);
    }
}
