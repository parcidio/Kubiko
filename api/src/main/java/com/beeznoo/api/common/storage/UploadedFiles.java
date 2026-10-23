package com.beeznoo.api.common.storage;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;

/**
 * Validação de ficheiros enviados pelos utilizadores: tamanho e tipo pelos primeiros bytes
 * (a extensão e o Content-Type do browser não são de confiança).
 */
public final class UploadedFiles {

    public static final long MAX_BYTES = 5L * 1024 * 1024;

    public enum Kind { JPEG, PNG, PDF }

    public static final Set<Kind> IMAGES = Set.of(Kind.JPEG, Kind.PNG);
    public static final Set<Kind> IMAGES_AND_PDF = Set.of(Kind.JPEG, Kind.PNG, Kind.PDF);

    public record ValidFile(byte[] content, String contentType, String extension) {}

    private UploadedFiles() {}

    // label entra na mensagem de erro (ex.: "O documento BI_FRONT", "A foto 2")
    public static ValidFile validate(MultipartFile file, String label, Set<Kind> allowed) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(label + " está vazio");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException(label + " tem mais de 5 MB");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Não foi possível ler " + label);
        }
        ValidFile detected = sniff(content);
        if (detected == null || !allowed.contains(kindOf(detected))) {
            throw new IllegalArgumentException(label + " tem de ser " + describe(allowed));
        }
        return detected;
    }

    public static ValidFile sniff(byte[] c) {
        if (startsWith(c, 0xFF, 0xD8, 0xFF)) return new ValidFile(c, "image/jpeg", "jpg");
        if (startsWith(c, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return new ValidFile(c, "image/png", "png");
        if (startsWith(c, 0x25, 0x50, 0x44, 0x46, 0x2D)) return new ValidFile(c, "application/pdf", "pdf");
        return null;
    }

    private static Kind kindOf(ValidFile f) {
        return switch (f.extension()) {
            case "jpg" -> Kind.JPEG;
            case "png" -> Kind.PNG;
            default -> Kind.PDF;
        };
    }

    private static String describe(Set<Kind> allowed) {
        return allowed.contains(Kind.PDF) ? "JPEG, PNG ou PDF" : "JPEG ou PNG";
    }

    private static boolean startsWith(byte[] content, int... magic) {
        if (content.length < magic.length) return false;
        for (int i = 0; i < magic.length; i++) {
            if ((content[i] & 0xFF) != magic[i]) return false;
        }
        return true;
    }
}
