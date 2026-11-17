package com.beeznoo.api.message.service;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Texto das mensagens: variáveis {{nome}} e {{primeiro_nome}} e máscaras de contacto.
 * O texto é sempre simples; no email o HTML é gerado pelo Thymeleaf (th:text escapa tudo).
 */
public final class MessageText {

    private static final Pattern NAME = Pattern.compile("\\{\\{\\s*nome\\s*}}");
    private static final Pattern FIRST_NAME = Pattern.compile("\\{\\{\\s*primeiro_nome\\s*}}");

    private MessageText() {}

    public static String render(String template, String fullName) {
        if (template == null) return null;
        String name = fullName == null || fullName.isBlank() ? "" : fullName.strip();
        String first = name.isEmpty() ? "" : name.split("\\s+")[0];
        String out = NAME.matcher(template).replaceAll(Matcher.quoteReplacement(name));
        return FIRST_NAME.matcher(out).replaceAll(Matcher.quoteReplacement(first));
    }

    /** Assunto numa linha só (sem quebras que permitam injetar cabeçalhos). */
    public static String singleLine(String s) {
        return s == null ? null : s.replaceAll("[\\r\\n]+", " ").strip();
    }

    /** Parágrafos para o email: separados por linha em branco. */
    public static List<String> paragraphs(String text) {
        return Arrays.stream(text.split("\\R\\s*\\R")).map(String::strip).filter(p -> !p.isEmpty()).toList();
    }

    public static String preview(String body) {
        if (body == null) return null;
        String one = body.replaceAll("\\s+", " ").strip();
        return one.length() <= 120 ? one : one.substring(0, 117) + "…";
    }

    /** +244923***789 · a***@exemplo.ao */
    public static String mask(String destination) {
        if (destination == null || destination.isBlank()) return null;
        int at = destination.indexOf('@');
        if (at >= 0) {
            return (at == 0 ? "" : destination.charAt(0)) + "***" + destination.substring(at);
        }
        if (destination.length() < 6) return "***";
        return destination.substring(0, destination.length() - 6) + "***" + destination.substring(destination.length() - 3);
    }

    public static boolean isAngolan(String phone) {
        return phone != null && phone.startsWith("+244");
    }
}
