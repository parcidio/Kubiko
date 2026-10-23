package com.beeznoo.api.common.exception;

import lombok.extern.slf4j.Slf4j;
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
        log.error("Erro inesperado: {}", ex.getMessage(), ex);
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