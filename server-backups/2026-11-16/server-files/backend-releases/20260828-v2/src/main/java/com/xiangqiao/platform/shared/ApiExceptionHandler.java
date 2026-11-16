package com.xiangqiao.platform.shared;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ProblemDetail handleApi(ApiException error, HttpServletRequest request) {
        var detail = ProblemDetail.forStatusAndDetail(error.status(), error.getMessage());
        detail.setTitle(error.code());
        detail.setInstance(URI.create(request.getRequestURI()));
        detail.setProperty("code", error.code());
        return detail;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException error, HttpServletRequest request) {
        var fields = new LinkedHashMap<String, String>();
        error.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "请求参数校验失败");
        detail.setTitle("VALIDATION_FAILED");
        detail.setInstance(URI.create(request.getRequestURI()));
        detail.setProperty("code", "VALIDATION_FAILED");
        detail.setProperty("fields", fields);
        return detail;
    }
}
