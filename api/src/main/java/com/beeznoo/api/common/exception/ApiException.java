package com.beeznoo.api.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Erro de negócio com estado HTTP e código estável para o frontend (campo {@code code} do ErrorBody),
 * ex. 409 {@code last_admin}. A mensagem é para mostrar à pessoa (pt-PT); o código é para o cliente decidir.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    public static ApiException unprocessable(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, code, message);
    }

    public static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }
}
