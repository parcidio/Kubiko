package com.beeznoo.api.config;

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
        StorageProperties.class, NotificationProperties.class, SecurityProperties.class })
public class AppConfig {

    @Bean
    public RestClient ombalaRestClient(OmbalaProperties props) {
        return RestClient.builder()
                .baseUrl(props.apiUrl())
                .defaultHeader("Authorization", "Bearer " + props.token())
                .defaultHeader("Content-Type", "Application/json")
                .build();
    }
}
