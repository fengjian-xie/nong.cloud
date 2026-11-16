package com.xiangqiao.platform.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService service;
    public AuthController(AuthService service) { this.service = service; }

    @PostMapping("/register")
    TokenResponse register(@Valid @RequestBody RegisterRequest request) { return service.register(request); }

    @PostMapping("/login")
    TokenResponse login(@Valid @RequestBody LoginRequest request) { return service.login(request); }

    public record RegisterRequest(
            @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入正确的手机号") String mobile,
            @Size(min = 8, max = 72, message = "密码长度应为8至72位") String password,
            @NotBlank @Size(max = 100) String displayName,
            @NotBlank String countyCode,
            @NotBlank String identityType,
            @Size(max = 200) String organizationName) {}

    public record LoginRequest(
            @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入正确的手机号") String mobile,
            @NotBlank String password,
            @NotBlank String countyCode) {}

    public record TokenResponse(String accessToken, String tokenType, UUID userId,
                                String countyCode, List<String> roles) {}
}
