package com.beeznoo.api.common.pdf;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

public final class PdfResponses {

    private PdfResponses() {}

    /** Download de um PDF com dados pessoais: nunca em cache partilhada. */
    public static ResponseEntity<byte[]> attachment(String fileName, byte[] content) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
                .cacheControl(CacheControl.noStore())
                .contentLength(content.length)
                .body(content);
    }
}
