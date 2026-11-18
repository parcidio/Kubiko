package com.beeznoo.api.common.util;

/**
 * Telefones em E.164 (decisoes-produto.md 2026-11-17, decisão 3). Normaliza antes da validação dos DTOs para que o
 * mesmo número escrito de formas diferentes ("+351 912 345 678", "00351912345678", "923 456 789") dê sempre o mesmo
 * valor — o que conta para a unicidade, o login e a recuperação.
 * Não inventa: o que não for um número (letras, símbolos) fica como está e a validação (AuthDtos.PHONE) recusa.
 */
public final class Phones {

    private Phones() {}

    public static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.strip();
        if (s.isEmpty() || !s.matches("[0-9+\\s().\\-]+") || s.indexOf('+', 1) >= 0) return s;
        boolean intl = s.startsWith("+");
        String digits = s.replaceAll("\\D", "");
        if (!intl && digits.startsWith("00")) {
            digits = digits.substring(2);
            intl = true;
        }
        if (intl) return "+" + digits;
        // sem indicativo: número angolano (9 dígitos a começar por 9), com ou sem 244 à frente
        if (digits.length() == 9 && digits.startsWith("9")) return "+244" + digits;
        if (digits.length() == 12 && digits.startsWith("2449")) return "+" + digits;
        return s;
    }
}
