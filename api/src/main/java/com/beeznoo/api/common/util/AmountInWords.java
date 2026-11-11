package com.beeznoo.api.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Montantes em kwanzas por extenso, em português de Portugal (escala longa: 10^9 = "mil milhões").
 * Ex.: 331000 → "trezentos e trinta e um mil kwanzas"; 1000000 → "um milhão de kwanzas".
 * Só kwanzas inteiros (CLAUDE.md §8) — os cêntimos são arredondados.
 */
public final class AmountInWords {

    private static final String[] UNITS = {"zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito",
            "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove"};
    private static final String[] TENS = {"", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
            "oitenta", "noventa"};
    private static final String[] HUNDREDS = {"", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
            "seiscentos", "setecentos", "oitocentos", "novecentos"};

    private AmountInWords() {}

    public static String kwanzas(BigDecimal amount) {
        long value = amount.setScale(0, RoundingMode.HALF_UP).longValueExact();
        if (value < 0) throw new IllegalArgumentException("Montante negativo");
        if (value >= 1_000_000_000_000L) throw new IllegalArgumentException("Montante demasiado alto");
        if (value == 0) return "zero kwanzas";
        if (value == 1) return "um kwanza";

        String words = number(value);
        // "um milhão de kwanzas", mas "um milhão e cem kwanzas"
        boolean roundMillions = value % 1_000_000 == 0;
        return words + (roundMillions ? " de kwanzas" : " kwanzas");
    }

    static String number(long value) {
        if (value == 0) return UNITS[0];
        long billions = value / 1_000_000_000L;          // mil milhões
        long millions = (value / 1_000_000L) % 1000;
        long thousands = (value / 1000L) % 1000;
        long units = value % 1000;

        List<String> groups = new ArrayList<>();
        List<Long> values = new ArrayList<>();
        if (billions > 0) {
            groups.add(billions == 1 ? "mil milhões" : hundreds(billions) + " mil milhões");
            values.add(billions);
        }
        if (millions > 0) {
            groups.add(millions == 1 ? "um milhão" : hundreds(millions) + " milhões");
            values.add(millions);
        }
        if (thousands > 0) {
            groups.add(thousands == 1 ? "mil" : hundreds(thousands) + " mil");
            values.add(thousands);
        }
        if (units > 0) {
            groups.add(hundreds(units));
            values.add(units);
        }

        StringBuilder out = new StringBuilder(groups.getFirst());
        for (int i = 1; i < groups.size(); i++) {
            long v = values.get(i);
            boolean last = i == groups.size() - 1;
            // "mil e cem", "dois mil e cinco", "mil duzentos e cinquenta"
            out.append(last && (v < 100 || v % 100 == 0) ? " e " : " ").append(groups.get(i));
        }
        return out.toString();
    }

    // 1..999
    private static String hundreds(long n) {
        if (n == 100) return "cem";
        int h = (int) (n / 100);
        int rest = (int) (n % 100);
        String restWords = rest == 0 ? "" : rest < 20 ? UNITS[rest]
                : TENS[rest / 10] + (rest % 10 == 0 ? "" : " e " + UNITS[rest % 10]);
        if (h == 0) return restWords;
        return rest == 0 ? HUNDREDS[h] : HUNDREDS[h] + " e " + restWords;
    }

    public static String capitalized(BigDecimal amount) {
        String s = kwanzas(amount);
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
