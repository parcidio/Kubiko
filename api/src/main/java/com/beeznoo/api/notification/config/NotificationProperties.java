package com.beeznoo.api.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.notifications")
public record NotificationProperties(Email email) {

    // enabled=false: notificações ficam só na app (email_status SKIPPED)
    public record Email(boolean enabled, String apiUrl, String apiKey, String from) {}
}
