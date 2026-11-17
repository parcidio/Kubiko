package com.beeznoo.api.config;

import com.beeznoo.api.common.pdf.CompanyProperties;
import com.beeznoo.api.common.security.SecurityProperties;
import com.beeznoo.api.common.storage.StorageProperties;
import com.beeznoo.api.notification.config.NotificationProperties;
import com.beeznoo.api.transaction.config.PaymentProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({ JwtProperties.class, OmbalaProperties.class, PaymentProperties.class,
        StorageProperties.class, NotificationProperties.class, SecurityProperties.class,
        CompanyProperties.class, WhatsAppProperties.class, OtpProperties.class,
        com.beeznoo.api.message.config.MessageProperties.class })
public class AppConfig {

    @Bean
    public RestClient ombalaRestClient(OmbalaProperties props) {
        return RestClient.builder()
                .baseUrl(props.apiUrl())
                .defaultHeader("Authorization", "Bearer " + props.token())
                .defaultHeader("Content-Type", "Application/json")
                .build();
    }

    // Losambo (WhatsApp). Sem chave o cliente existe na mesma; o AuthService usa SMS (OTP_CHANNEL=auto)
    @Bean
    public RestClient whatsAppRestClient(WhatsAppProperties props) {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        factory.setReadTimeout(java.time.Duration.ofSeconds(15));
        return RestClient.builder()
                .baseUrl(props.apiUrl())
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + props.apiKey())
                .defaultHeader("Content-Type", "application/json")
                .build();
    }
}
