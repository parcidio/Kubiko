package com.beeznoo.api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {

        final String shcemeName = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Beeznoo API")
                        .version("v1")
                        .description("MarketPlace P2P de aluguer de equipamentos - Luanda, Angola")
                        .contact(new Contact()
                                .name("Beeznoo")
                                .email("dev@beeznoo.ao")))
                .addSecurityItem(new SecurityRequirement().addList(shcemeName))
                .components(new Components()
                        .addSecuritySchemes(shcemeName, new SecurityScheme()
                                .name(shcemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Introduz o access token JWt obtido em /api/v1/auth/otp/verify")));
    }
}
