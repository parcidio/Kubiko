package com.beeznoo.api.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

// Formatos da copy (CLAUDE.md §8): "25.000 Kz", "16 a 18 out", "16 out 2026"
public final class Formats {

    private static final String[] MONTHS = {"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"};

    private Formats() {}

    public static String kz(BigDecimal amount) {
        long value = amount.setScale(0, RoundingMode.HALF_UP).longValueExact();
        String digits = Long.toString(Math.abs(value));
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) out.append('.');
            out.append(digits.charAt(i));
        }
        return (value < 0 ? "-" : "") + out + " Kz";
    }

    public static String period(LocalDate start, LocalDate end) {
        String endText = end.getDayOfMonth() + " " + MONTHS[end.getMonthValue() - 1];
        if (start.getMonth() == end.getMonth() && start.getYear() == end.getYear()) {
            return start.getDayOfMonth() + " a " + endText;
        }
        return start.getDayOfMonth() + " " + MONTHS[start.getMonthValue() - 1] + " a " + endText;
    }

    public static String firstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return null;
        return fullName.strip().split("\\s+")[0];
    }

    public static String date(LocalDate d) {
        return d.getDayOfMonth() + " " + MONTHS[d.getMonthValue() - 1] + " " + d.getYear();
    }

    public static final java.time.ZoneId LUANDA = java.time.ZoneId.of("Africa/Luanda");

    // "11 nov 2026, 14:32" na hora de Luanda
    public static String dateTime(java.time.OffsetDateTime t) {
        var local = t.atZoneSameInstant(LUANDA);
        return date(local.toLocalDate()) + String.format(", %02d:%02d", local.getHour(), local.getMinute());
    }

    // Igual a CONDITION_LABEL no frontend (lib/format.ts)
    public static String condition(com.beeznoo.api.item.entity.ItemCondition c) {
        if (c == null) return "—";
        return switch (c) {
            case NEW -> "Novo";
            case LIKE_NEW -> "Como novo";
            case GOOD -> "Bom estado";
            case FAIR -> "Sinais de uso";
        };
    }
}
