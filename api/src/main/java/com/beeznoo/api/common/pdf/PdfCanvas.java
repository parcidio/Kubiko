package com.beeznoo.api.common.pdf;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.function.Consumer;

/**
 * Página A4 com cursor vertical, quebra de linha e de página, e rodapé "Página X de Y".
 * Usa as fontes base do PDF (Helvetica, WinAnsi): sem ficheiros de fonte no repo. Caracteres fora do WinAnsi
 * (texto do utilizador) são trocados por "?" em vez de rebentar a geração.
 * Coordenadas: x a partir da esquerda; o cursor {@link #y()} desce a partir do topo.
 */
public final class PdfCanvas implements AutoCloseable {

    public static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    public static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    // Identidade Verde v3 (docs/DESIGN_SYSTEM.md, frontend/src/app/globals.css)
    public static final Color VERDE = new Color(0x0E2A1F);
    public static final Color VERDE_MEDIO = new Color(0x1F5C42);
    public static final Color AMBAR = new Color(0xF0A22E);
    public static final Color AMBAR_TINT = new Color(0xFDF0DC);
    public static final Color AREIA = new Color(0xFAF6EF);
    public static final Color SALVIA_TINT = new Color(0xE3F0E9);
    public static final Color TEXTO = new Color(0x2C3A33);
    public static final Color CINZA = new Color(0x5E6B64);
    public static final Color BORDA = new Color(0xE1E5DB);
    public static final Color BRANCO = Color.WHITE;

    public static final float WIDTH = PDRectangle.A4.getWidth();
    public static final float HEIGHT = PDRectangle.A4.getHeight();
    public static final float MARGIN = 48;
    public static final float CONTENT_WIDTH = WIDTH - 2 * MARGIN;
    private static final float FOOTER_SPACE = 24;

    private final PDDocument doc = new PDDocument();
    private final List<PDPage> pages = new ArrayList<>();
    private final Consumer<PdfCanvas> pageHeader;
    private PDPageContentStream cs;
    private float y;

    /** @param pageHeader desenhado no topo de cada página nova (a partir da 2.ª); pode ser null */
    public PdfCanvas(String title, String subject, Consumer<PdfCanvas> pageHeader) {
        this.pageHeader = pageHeader;
        PDDocumentInformation info = doc.getDocumentInformation();
        info.setTitle(title);
        info.setSubject(subject);
        info.setAuthor("Beeznoo");
        info.setCreator("Beeznoo");
        info.setProducer("Beeznoo");
        info.setCreationDate(Calendar.getInstance());
        newPage();
    }

    // ---------------------------------------------------------------- cursor e páginas

    public float y() { return y; }

    public void moveTo(float newY) { this.y = newY; }

    public void gap(float h) { y -= h; }

    /** Garante espaço para h pontos; senão abre página nova. */
    public void ensure(float h) {
        if (y - h < MARGIN + FOOTER_SPACE) {
            newPage();
            if (pageHeader != null) pageHeader.accept(this);
        }
    }

    private void newPage() {
        try {
            if (cs != null) cs.close();
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            pages.add(page);
            cs = new PDPageContentStream(doc, page);
            y = HEIGHT - MARGIN;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---------------------------------------------------------------- texto

    /** Texto numa linha, com a linha de base em baseline (coordenada do PDF, a partir de baixo). */
    public void textAt(String text, PDFont font, float size, Color color, float x, float baseline) {
        String safe = safe(text, font);
        if (safe.isEmpty()) return;
        try {
            cs.beginText();
            cs.setFont(font, size);
            cs.setNonStrokingColor(color);
            cs.newLineAtOffset(x, baseline);
            cs.showText(safe);
            cs.endText();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void textRightAt(String text, PDFont font, float size, Color color, float rightX, float baseline) {
        textAt(text, font, size, color, rightX - width(text, font, size), baseline);
    }

    /** Uma linha no cursor: avança o cursor pela altura da linha. */
    public void line(String text, PDFont font, float size, Color color, float x) {
        float leading = size * 1.4f;
        ensure(leading);
        y -= leading;
        textAt(text, font, size, color, x, y + size * 0.3f);
    }

    /** Parágrafo com quebra de linha dentro de [x, x + maxWidth]. */
    public void paragraph(String text, PDFont font, float size, Color color, float x, float maxWidth) {
        for (String l : wrap(text, font, size, maxWidth)) line(l, font, size, color, x);
    }

    public float width(String text, PDFont font, float size) {
        try {
            return font.getStringWidth(safe(text, font)) / 1000f * size;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Corta o texto com "…" para caber em maxWidth. */
    public String ellipsize(String text, PDFont font, float size, float maxWidth) {
        String s = safe(text, font);
        if (width(s, font, size) <= maxWidth) return s;
        while (s.length() > 1 && width(s + "...", font, size) > maxWidth) s = s.substring(0, s.length() - 1);
        return s.strip() + "...";
    }

    public List<String> wrap(String text, PDFont font, float size, float maxWidth) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String para : text.split("\n", -1)) {
            if (para.isBlank()) {
                out.add("");
                continue;
            }
            StringBuilder current = new StringBuilder();
            for (String word : para.strip().split("\\s+")) {
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (width(candidate, font, size) <= maxWidth) {
                    current.setLength(0);
                    current.append(candidate);
                    continue;
                }
                if (!current.isEmpty()) out.add(current.toString());
                // palavra maior que a linha (um hash, por exemplo): corta à força
                String rest = word;
                while (width(rest, font, size) > maxWidth) {
                    int cut = rest.length() - 1;
                    while (cut > 1 && width(rest.substring(0, cut), font, size) > maxWidth) cut--;
                    out.add(rest.substring(0, cut));
                    rest = rest.substring(cut);
                }
                current.setLength(0);
                current.append(rest);
            }
            if (!current.isEmpty()) out.add(current.toString());
        }
        return out;
    }

    // ---------------------------------------------------------------- formas

    public void fillRect(float x, float bottom, float w, float h, Color color) {
        try {
            cs.setNonStrokingColor(color);
            cs.addRect(x, bottom, w, h);
            cs.fill();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void roundRect(float x, float bottom, float w, float h, float r, Color fill, Color stroke, float strokeWidth) {
        try {
            float k = 0.5523f * r; // aproximação de um quarto de círculo por Bézier
            cs.moveTo(x + r, bottom);
            cs.lineTo(x + w - r, bottom);
            cs.curveTo(x + w - r + k, bottom, x + w, bottom + r - k, x + w, bottom + r);
            cs.lineTo(x + w, bottom + h - r);
            cs.curveTo(x + w, bottom + h - r + k, x + w - r + k, bottom + h, x + w - r, bottom + h);
            cs.lineTo(x + r, bottom + h);
            cs.curveTo(x + r - k, bottom + h, x, bottom + h - r + k, x, bottom + h - r);
            cs.lineTo(x, bottom + r);
            cs.curveTo(x, bottom + r - k, x + r - k, bottom, x + r, bottom);
            cs.closePath();
            if (fill != null) cs.setNonStrokingColor(fill);
            if (stroke != null) {
                cs.setStrokingColor(stroke);
                cs.setLineWidth(strokeWidth);
            }
            if (fill != null && stroke != null) cs.fillAndStroke();
            else if (fill != null) cs.fill();
            else if (stroke != null) cs.stroke();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void hLine(float x1, float x2, float atY, Color color, float lineWidth) {
        try {
            cs.setStrokingColor(color);
            cs.setLineWidth(lineWidth);
            cs.moveTo(x1, atY);
            cs.lineTo(x2, atY);
            cs.stroke();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Hexágono (motivo colmeia) com o centro em (cx, cy). */
    public void hexagon(float cx, float cy, float radius, Color fill) {
        try {
            cs.setNonStrokingColor(fill);
            for (int i = 0; i < 6; i++) {
                double a = Math.toRadians(60 * i - 30);
                float px = cx + (float) (radius * Math.cos(a));
                float py = cy + (float) (radius * Math.sin(a));
                if (i == 0) cs.moveTo(px, py);
                else cs.lineTo(px, py);
            }
            cs.closePath();
            cs.fill();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Marca de água diagonal e clara em todas as páginas (p. ex. "RASCUNHO"). */
    public void watermarkAllPages(String text) {
        forEachPage((page, stream) -> {
            PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
            gs.setNonStrokingAlphaConstant(0.07f);
            stream.setGraphicsStateParameters(gs);
            stream.beginText();
            stream.setFont(BOLD, 96);
            stream.setNonStrokingColor(VERDE);
            stream.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(40), 120, 200));
            stream.showText(safe(text, BOLD));
            stream.endText();
        });
    }

    // ---------------------------------------------------------------- marca

    /**
     * Faixa verde no topo da página: marca "beeznoo" com hexágono âmbar à esquerda, tipo de documento e
     * número à direita. Deixa o cursor por baixo da faixa.
     */
    public void brandBand(String documentLabel, String number) {
        float bandHeight = 84;
        float bottom = HEIGHT - bandHeight;
        fillRect(0, bottom, WIDTH, bandHeight, VERDE);
        // colmeia: um hexágono cheio e um mais pequeno
        hexagon(MARGIN + 11, bottom + 44, 11, AMBAR);
        hexagon(MARGIN + 27, bottom + 34, 5, VERDE_MEDIO);
        textAt("beeznoo", BOLD, 24, BRANCO, MARGIN + 37, bottom + 35);
        textAt("Por que comprar quando podes alugar?", REGULAR, 8, SALVIA_TINT, MARGIN + 38, bottom + 22);
        textRightAt(documentLabel.toUpperCase(java.util.Locale.ROOT), BOLD, 9, SALVIA_TINT, WIDTH - MARGIN, bottom + 50);
        if (number != null) textRightAt(number, BOLD, 16, AMBAR, WIDTH - MARGIN, bottom + 30);
        y = bottom - 28;
    }

    /** Título de secção com fio por baixo. */
    public void sectionTitle(String title) {
        sectionTitle(title, MARGIN, CONTENT_WIDTH);
    }

    /** Título de secção numa coluna [x, x + w]. */
    public void sectionTitle(String title, float x, float w) {
        ensure(34);
        y -= 18;
        textAt(title.toUpperCase(java.util.Locale.ROOT), BOLD, 8.5f, VERDE_MEDIO, x, y);
        y -= 6;
        hLine(x, x + w, y, BORDA, 0.6f);
        y -= 4;
    }

    /** Linha "Rótulo ............ valor" em duas colunas, a começar em x com a largura w. */
    public void labelValue(String label, String value, float x, float w, float labelWidth) {
        List<String> lines = wrap(value == null || value.isBlank() ? "—" : value, REGULAR, 9.5f, w - labelWidth);
        float h = lines.size() * 13.5f + 3;
        ensure(h);
        float top = y;
        textAt(label, REGULAR, 9, CINZA, x, top - 11);
        float ly = top - 11;
        for (String l : lines) {
            textAt(l, BOLD, 9.5f, TEXTO, x + labelWidth, ly);
            ly -= 13.5f;
        }
        y = top - h;
    }

    // ---------------------------------------------------------------- saída

    /** Fecha o documento com o rodapé "left · Página X de Y" em cada página. */
    public byte[] toBytes(String footerLeft) {
        try {
            if (cs != null) {
                cs.close();
                cs = null;
            }
            int total = pages.size();
            int[] n = {0};
            forEachPage((page, stream) -> {
                n[0]++;
                float baseline = MARGIN - 18;
                stream.setStrokingColor(BORDA);
                stream.setLineWidth(0.6f);
                stream.moveTo(MARGIN, MARGIN);
                stream.lineTo(WIDTH - MARGIN, MARGIN);
                stream.stroke();
                writeFooter(stream, safe(footerLeft, REGULAR), MARGIN, baseline);
                String right = "Página " + n[0] + " de " + total;
                writeFooter(stream, right, WIDTH - MARGIN - REGULAR.getStringWidth(right) / 1000f * 8, baseline);
            }, false);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void writeFooter(PDPageContentStream stream, String text, float x, float baseline) throws IOException {
        stream.beginText();
        stream.setFont(REGULAR, 8);
        stream.setNonStrokingColor(CINZA);
        stream.newLineAtOffset(x, baseline);
        stream.showText(text);
        stream.endText();
    }

    private interface PageWork {
        void run(PDPage page, PDPageContentStream stream) throws IOException;
    }

    private void forEachPage(PageWork work) {
        forEachPage(work, true);
    }

    private void forEachPage(PageWork work, boolean reopen) {
        try {
            if (cs != null) {
                cs.close();
                cs = null;
            }
            for (PDPage page : pages) {
                try (PDPageContentStream stream =
                             new PDPageContentStream(doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    work.run(page, stream);
                }
            }
            // reabre a última página para continuar a desenhar, se for preciso
            if (reopen) cs = new PDPageContentStream(doc, pages.getLast(), PDPageContentStream.AppendMode.APPEND, true, true);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void close() {
        try {
            if (cs != null) cs.close();
            doc.close();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---------------------------------------------------------------- caracteres

    /** Troca o que a fonte não codifica (emoji, outros alfabetos, controlo) por "?". */
    static String safe(String text, PDFont font) {
        if (text == null) return "";
        StringBuilder out = new StringBuilder(text.length());
        text.codePoints().forEach(cp -> {
            if (cp == '\t') {
                out.append(' ');
                return;
            }
            if (Character.isISOControl(cp)) return;
            String ch = new String(Character.toChars(cp));
            try {
                font.encode(ch);
                out.append(ch);
            } catch (IOException | IllegalArgumentException e) {
                out.append('?');
            }
        });
        return out.toString();
    }
}
