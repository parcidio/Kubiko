package com.beeznoo.api.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({ JwtProperties.class, OmbalaProperties.class})
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
