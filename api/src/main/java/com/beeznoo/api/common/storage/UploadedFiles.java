package com.beeznoo.api.common.storage;

import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Set;

/**
 * Validação de ficheiros enviados pelos utilizadores: tamanho e tipo pelos primeiros bytes
 * (a extensão e o Content-Type do browser não são de confiança).
 * As imagens são recodificadas no servidor: sai o EXIF (incluindo o GPS de onde a foto foi tirada), saem
 * dados escondidos depois da imagem ("poliglotas") e recusam-se imagens gigantes (bomba de descompressão).
 * Os PDFs ficam como estão. Ver docs/SEGURANCA.md.
 */
public final class UploadedFiles {

    public static final long MAX_BYTES = 5L * 1024 * 1024;
    static final long MAX_PIXELS = 40_000_000L;
    static final int MAX_SIDE = 12_000;

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
        return kindOf(detected) == Kind.PDF ? detected : reencode(detected, label);
    }

    // Lê as dimensões ANTES de descodificar (sem alocar a imagem) e volta a gravar só os píxeis
    static ValidFile reencode(ValidFile file, String label) {
        String format = file.extension().equals("png") ? "png" : "jpeg";
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(file.content()))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) throw new IllegalArgumentException(label + " não é uma imagem válida");
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true); // ignora metadados
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width > MAX_SIDE || height > MAX_SIDE || (long) width * height > MAX_PIXELS) {
                    throw new IllegalArgumentException(label + " tem demasiados píxeis (máx. 40 megapíxeis)");
                }
                BufferedImage image = reader.read(0);
                if (format.equals("jpeg") && image.getColorModel().hasAlpha()) {
                    BufferedImage rgb = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
                    rgb.createGraphics().drawImage(image, 0, 0, null);
                    image = rgb;
                }
                return new ValidFile(write(image, format), file.contentType(), file.extension());
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof IllegalArgumentException iae) throw iae;
            throw new IllegalArgumentException(label + " não é uma imagem válida (exporta-a outra vez como JPEG ou PNG)");
        }
    }

    private static byte[] write(BufferedImage image, String format) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName(format).next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            if (format.equals("jpeg")) {
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(0.9f);
            }
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
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
