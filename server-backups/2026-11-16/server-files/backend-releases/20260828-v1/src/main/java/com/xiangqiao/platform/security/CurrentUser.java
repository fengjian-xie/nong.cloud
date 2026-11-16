package com.xiangqiao.platform.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

public final class CurrentUser {
    private CurrentUser() {}

    public static UUID id() {
        var principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return UUID.fromString(((Jwt) principal).getSubject());
    }
}
