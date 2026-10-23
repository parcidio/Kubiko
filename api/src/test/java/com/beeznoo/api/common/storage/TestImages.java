package com.beeznoo.api.common.storage;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;

// Imagens reais (descodificáveis) para os testes — o servidor recodifica todas as imagens enviadas
public final class TestImages {

    public static final byte[] JPEG = image("jpeg", 8, 8);
    public static final byte[] PNG = image("png", 8, 8);

    private TestImages() {}

    public static byte[] image(String format, int width, int height) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        img.setRGB(0, 0, 0xF0A22E);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(img, format, out);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }
}
