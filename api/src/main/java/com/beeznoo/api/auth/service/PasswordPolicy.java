package com.beeznoo.api.auth.service;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Política de passwords (OWASP A07): 8–72 bytes (bcrypt ignora o resto), não pode ser uma das mais comuns,
 * nem conter o telefone ou o nome, nem ser um só carácter repetido. Ver claude/decisoes-produto.md.
 */
@Component
public class PasswordPolicy {

    static final int MIN_CHARS = 8;
    static final int MAX_BYTES = 72;

    private final Set<String> common;

    public PasswordPolicy() {
        try {
            String list = new ClassPathResource("security/common-passwords.txt").getContentAsString(StandardCharsets.UTF_8);
            this.common = list.lines()
                    .map(String::strip)
                    .filter(l -> !l.isEmpty() && !l.startsWith("#"))
                    .map(PasswordPolicy::normalize)
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new UncheckedIOException("Lista de passwords comuns em falta", e);
        }
    }

    public void validate(String password, String phone, String fullName) {
        if (password == null || password.codePointCount(0, password.length()) < MIN_CHARS) {
            throw new IllegalArgumentException("A password tem de ter pelo menos 8 caracteres.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new IllegalArgumentException("A password pode ter no máximo 72 caracteres.");
        }
        String normalized = normalize(password);
        if (common.contains(normalized) || normalized.chars().distinct().count() == 1) {
            throw new IllegalArgumentException("Essa password é demasiado comum. Escolhe outra.");
        }
        if (phone != null) {
            String digits = phone.replaceAll("\\D", "");
            String local = digits.length() > 9 ? digits.substring(digits.length() - 9) : digits;
            if (local.length() >= 6 && normalized.contains(local)) {
                throw new IllegalArgumentException("A password não pode conter o teu número de telefone.");
            }
        }
        if (fullName != null) {
            for (String part : normalize(fullName).split("\\s+")) {
                if (part.length() >= 4 && normalized.contains(part)) {
                    throw new IllegalArgumentException("A password não pode conter o teu nome.");
                }
            }
        }
    }

    // minúsculas e sem acentos: "Ângola" = "angola"
    private static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
