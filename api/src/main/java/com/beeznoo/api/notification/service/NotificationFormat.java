package com.beeznoo.api.notification.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

// Formatos da copy (CLAUDE.md §8): "25.000 Kz", "16 a 18 out"
final class NotificationFormat {

    private static final String[] MONTHS = {"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"};

    private NotificationFormat() {}

    static String kz(BigDecimal amount) {
        long value = amount.setScale(0, RoundingMode.HALF_UP).longValueExact();
        String digits = Long.toString(Math.abs(value));
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) out.append('.');
            out.append(digits.charAt(i));
        }
        return (value < 0 ? "-" : "") + out + " Kz";
    }

    static String period(LocalDate start, LocalDate end) {
        String endText = end.getDayOfMonth() + " " + MONTHS[end.getMonthValue() - 1];
        if (start.getMonth() == end.getMonth() && start.getYear() == end.getYear()) {
            return start.getDayOfMonth() + " a " + endText;
        }
        return start.getDayOfMonth() + " " + MONTHS[start.getMonthValue() - 1] + " a " + endText;
    }

    static String firstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return null;
        return fullName.strip().split("\\s+")[0];
    }
}
