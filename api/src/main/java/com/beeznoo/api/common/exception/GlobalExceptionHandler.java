package com.beeznoo.api.common.exception;

import com.beeznoo.api.common.security.RateLimitExceededException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Erros de validação dos DTOs (@Valid)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorBody> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        f -> f.getDefaultMessage() != null ? f.getDefaultMessage() : "inválido"
                ));

        return ResponseEntity
                .badRequest()
                .body(new ErrorBody(HttpStatus.BAD_REQUEST.value(), "Dados inválidos", fields));
    }

    // Erros de negócio (argumentos inválidos, duplicados, etc.)
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorBody> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity
                .badRequest()
                .body(new ErrorBody(HttpStatus.BAD_REQUEST.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorBody> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ErrorBody(HttpStatus.CONFLICT.value(), ex.getMessage(), null));
    }

    // Limites de pedidos (RateLimiter) — OWASP A06/A07
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ErrorBody> handleRateLimit(RateLimitExceededException ex) {
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(ex.retryAfterSeconds()))
                .body(new ErrorBody(HttpStatus.TOO_MANY_REQUESTS.value(), ex.getMessage(), null));
    }

    // Erros do cliente nunca são 500 (OWASP A10) e nunca levam detalhes internos
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorBody> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorBody(HttpStatus.BAD_REQUEST.value(), "Pedido mal formado.", null));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    public ResponseEntity<ErrorBody> handleMissing(Exception ex) {
        String name = ex instanceof MissingServletRequestParameterException p ? p.getParameterName()
                : ((MissingServletRequestPartException) ex).getRequestPartName();
        return ResponseEntity.badRequest()
                .body(new ErrorBody(HttpStatus.BAD_REQUEST.value(), "Falta o campo " + name, null));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorBody> handleMultipart(MultipartException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorBody(HttpStatus.BAD_REQUEST.value(), "Envio de ficheiros inválido.", null));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorBody> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ErrorBody(HttpStatus.METHOD_NOT_ALLOWED.value(), "Método não permitido.", null));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorBody> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(new ErrorBody(HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(), "Tipo de conteúdo não suportado.", null));
    }

    // Parâmetro com valor inválido (ex.: accountType desconhecido)
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorBody> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity
                .badRequest()
                .body(new ErrorBody(HttpStatus.BAD_REQUEST.value(), "Valor inválido para " + ex.getName(), null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorBody> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return ResponseEntity
                .status(HttpStatus.CONTENT_TOO_LARGE)
                .body(new ErrorBody(HttpStatus.CONTENT_TOO_LARGE.value(), "Ficheiro demasiado grande (máx. 5 MB).", null));
    }

    // Corrida contra um índice único (ex.: duas submissões de KYC ao mesmo tempo). Sem detalhes da BD na resposta.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorBody> handleDataIntegrity(DataIntegrityViolationException ex) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ErrorBody(HttpStatus.CONFLICT.value(), "O pedido entrou em conflito com outro. Tenta outra vez.", null));
    }

    // Rota desconhecida — sem isto, cai no fallback genérico abaixo e devolve 500 em vez de 404
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorBody> handleNotFound(Exception ex) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(new ErrorBody(HttpStatus.NOT_FOUND.value(), "Rota não encontrada.", null));
    }

    // Fallback — erros inesperados
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorBody> handleGeneral(Exception ex) {
        // a stack fica no log do servidor; a resposta nunca leva detalhes
        log.error("Erro inesperado: {}", ex.getClass().getName(), ex);
        return ResponseEntity
                .internalServerError()
                .body(new ErrorBody(500, "Ocorreu um erro interno. Tenta novamente.", null));
    }

    public record ErrorBody(
            int status,
            String message,
            Map<String, String> fields,
            OffsetDateTime timestamp
    ) {
        public ErrorBody(int status, String message, Map<String, String> fields) {
            this(status, message, fields, OffsetDateTime.now());
        }
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
    }
}