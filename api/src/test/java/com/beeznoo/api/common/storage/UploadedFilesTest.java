package com.beeznoo.api.common.storage;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

/** Imagens grandes são descodificadas já reduzidas (memória do contentor de 512 MB no Render). */
class UploadedFilesTest {

    @Test
    void fotoDe24MP_eGuardadaComOLadoMaiorEm3000px_eMantemAProporcao() throws Exception {
        byte[] jpeg = jpeg(6000, 4000);
        assertThat(jpeg.length).isLessThan((int) UploadedFiles.MAX_BYTES);

        var valid = UploadedFiles.validate(new MockMultipartFile("f", "f.jpg", "image/jpeg", jpeg), "A foto", UploadedFiles.IMAGES);

        BufferedImage out = ImageIO.read(new ByteArrayInputStream(valid.content()));
        assertThat(Math.max(out.getWidth(), out.getHeight())).isLessThanOrEqualTo(UploadedFiles.MAX_STORED_SIDE);
        assertThat(out.getWidth() / (double) out.getHeight()).isCloseTo(1.5, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    void fotoPequena_naoEReduzida() throws Exception {
        var valid = UploadedFiles.validate(new MockMultipartFile("f", "f.jpg", "image/jpeg", jpeg(1600, 1200)), "A foto", UploadedFiles.IMAGES);
        BufferedImage out = ImageIO.read(new ByteArrayInputStream(valid.content()));
        assertThat(out.getWidth()).isEqualTo(1600);
        assertThat(out.getHeight()).isEqualTo(1200);
    }

    static byte[] jpeg(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0x1F5C42));
        g.fillRect(0, 0, w, h);
        g.setColor(new Color(0xF0A22E));
        g.fillOval(w / 4, h / 4, w / 2, h / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "jpeg", out);
        return out.toByteArray();
    }
}
