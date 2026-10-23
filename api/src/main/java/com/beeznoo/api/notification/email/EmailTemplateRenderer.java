package com.beeznoo.api.notification.email;

import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.util.List;
import java.util.Locale;

// Motor Thymeleaf só para emails (sem integração com o Spring MVC). th:text escapa tudo o que vem do utilizador.
@Component
public class EmailTemplateRenderer {

    private final TemplateEngine engine = new TemplateEngine();

    public EmailTemplateRenderer() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/email/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        engine.setTemplateResolver(resolver);
    }

    public String render(String firstName, String title, List<String> paragraphs, String ctaLabel, String ctaUrl) {
        Context ctx = new Context(Locale.forLanguageTag("pt-PT"));
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("title", title);
        ctx.setVariable("paragraphs", paragraphs);
        ctx.setVariable("ctaLabel", ctaLabel);
        ctx.setVariable("ctaUrl", ctaUrl);
        return engine.process("notification", ctx);
    }
}
