package com.beeznoo.api.common.util;

import java.util.Locale;

/**
 * Emails guardam-se e comparam-se em minúsculas, sem espaços: "Ana@Gmail.com " e "ana@gmail.com" são a mesma conta.
 * O Google devolve sempre minúsculas. Ver claude/decisoes-produto.md (2026-11-11).
 */
public final class Emails {

    private Emails() {}

    /** null ou vazio → null (sem email). */
    public static String normalize(String email) {
        if (email == null) return null;
        String s = email.strip().toLowerCase(Locale.ROOT);
        return s.isEmpty() ? null : s;
    }
}
