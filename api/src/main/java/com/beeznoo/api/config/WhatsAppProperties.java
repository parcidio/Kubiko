package com.beeznoo.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Gateway de WhatsApp da equipa (Losambo). Ver claude/decisoes-produto.md (2026-11-15).
 *
 * @param apiUrl  URL base, ex. https://message.beeznoo.ao/v1
 * @param apiKeyPrd chave de produção (lsb_live_…)
 * @param apiKeyTst chave de teste (staging e local)
 * @param env     "prd" ou "tst": qual das chaves usar
 * @param appName nome mostrado na mensagem do código
 */
@ConfigurationProperties(prefix = "whatsapp")
public record WhatsAppProperties(String apiUrl, String apiKeyPrd, String apiKeyTst, String env, String appName) {

    public WhatsAppProperties {
        if (apiUrl == null || apiUrl.isBlank()) apiUrl = "https://message.beeznoo.ao/v1";
        if (env == null || env.isBlank()) env = "tst";
        if (!env.equals("prd") && !env.equals("tst")) {
            throw new IllegalArgumentException("WHATSAPP_ENV tem de ser prd ou tst");
        }
        if (appName == null || appName.isBlank()) appName = "Beeznoo";
    }

    /** A chave do ambiente ativo; vazia se não estiver configurada. */
    public String apiKey() {
        String key = "prd".equals(env) ? apiKeyPrd : apiKeyTst;
        return key == null ? "" : key.strip();
    }

    public boolean configured() {
        return !apiKey().isEmpty();
    }
}
