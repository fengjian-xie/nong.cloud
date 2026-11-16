package com.xiangqiao.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class CountyContextFilter extends OncePerRequestFilter {
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/v1/auth/") || path.startsWith("/api/v1/public/")
                || path.startsWith("/actuator/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            Authentication authentication = org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication();
            if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
                chain.doFilter(request, response);
                return;
            }
            String tokenCounty = jwt.getClaimAsString("county");
            String requestedCounty = request.getHeader("X-County-Code");
            String county = requestedCounty == null || requestedCounty.isBlank() ? tokenCounty : requestedCounty.trim();
            List<String> allowed = jwt.getClaimAsStringList("counties");
            if (county == null || allowed == null || !allowed.contains(county)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setCharacterEncoding("UTF-8");
                response.setContentType("application/json");
                response.getWriter().write("{\"code\":\"COUNTY_FORBIDDEN\",\"message\":\"当前登录凭证无权访问该县域\"}");
                return;
            }
            CountyContext.set(county);
            MDC.put("countyCode", county);
            chain.doFilter(request, response);
        } finally {
            MDC.remove("countyCode");
            CountyContext.clear();
        }
    }
}
