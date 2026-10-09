package cn.fuan.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AccessFilter extends OncePerRequestFilter {
    private final AuthService auth; private final ObjectMapper json; private final Set<String> origins;
    public AccessFilter(AuthService auth,ObjectMapper json,@Value("${xq.allowed-origins}") String origins) {
        this.auth=auth; this.json=json; this.origins=new HashSet<>();
        for(String value:origins.split(",")) {
            String origin=value.trim();if(origin.isEmpty())continue;
            java.net.URI uri=java.net.URI.create(origin);
            if(!Set.of("https","http").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||!uri.getRawPath().isEmpty())throw new IllegalArgumentException("Allowed origins must be exact HTTP(S) origins without paths or wildcards");
            this.origins.add(origin);
        }
    }
    static String token(HttpServletRequest request) {
        String bearer=request.getHeader("Authorization");
        if(bearer!=null) { if(!bearer.startsWith("Bearer ")) throw AuthService.unauthorized(); return bearer.substring(7); }
        if(request.getCookies()!=null) for(Cookie cookie:request.getCookies()) if(cookie.getName().equals("xq_session")) return cookie.getValue();
        return null;
    }
    static AuthService.Actor actor(HttpServletRequest request) {
        Object actor=request.getAttribute("actor"); if(!(actor instanceof AuthService.Actor value)) throw AuthService.unauthorized(); return value;
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        request.setAttribute("traceId",ApiSupport.id()); response.setHeader("X-Request-Id",String.valueOf(request.getAttribute("traceId")));
        response.setHeader("X-Content-Type-Options","nosniff"); response.setHeader("Cache-Control","no-store");
        try {
            String origin=request.getHeader("Origin");
            if(origin!=null) {
                if(!origins.contains(origin)) throw ApiError.forbidden();
                response.setHeader("Access-Control-Allow-Origin",origin); response.setHeader("Vary","Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
                response.setHeader("Access-Control-Allow-Credentials","true");
                response.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization,Idempotency-Key,If-Match,X-XQ-Client,X-XQ-Identity");
                response.setHeader("Access-Control-Allow-Methods","GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS");
                response.setHeader("Access-Control-Expose-Headers","X-Request-Id");
                if(request.getMethod().equals("OPTIONS")) {
                    String requestedMethod=request.getHeader("Access-Control-Request-Method");
                    if(requestedMethod!=null&&!Set.of("GET","POST","PATCH","PUT","DELETE","HEAD").contains(requestedMethod))throw ApiError.forbidden();
                    String requestedHeaders=request.getHeader("Access-Control-Request-Headers");
                    if(requestedHeaders!=null)for(String name:requestedHeaders.split(","))if(!Set.of("content-type","authorization","idempotency-key","if-match","x-xq-client","x-xq-identity").contains(name.trim().toLowerCase(Locale.ROOT)))throw ApiError.forbidden();
                }
            }
            if(request.getMethod().equals("OPTIONS")) { response.setStatus(204); return; }
            String path=request.getRequestURI();
            boolean publicPath=path.equals("/api/v1/health") || path.equals("/api/v1/auth/local-register") || path.equals("/api/v1/auth/password/login") || path.equals("/api/v1/auth/wechat/login") || path.startsWith("/api/v1/public/");
            if(!path.startsWith("/api/v1/")) { chain.doFilter(request,response); return; }
            if(!publicPath) {
                String token=token(request); AuthService.Actor actor=auth.resolve(token);request.setAttribute("actor",actor);
                String expected=request.getHeader("X-XQ-Identity");
                if(expected!=null&&!expected.equals(actor.identityId())&&!path.equals("/api/v1/users/me")&&!path.equals("/api/v1/auth/logout")&&!path.matches("/api/v1/identities/[^/]+/switch"))
                    throw new ApiError(409,"XQ-IDENTITY-409","当前身份已改变，请刷新身份后重新确认操作");
                if(!Set.of("GET","HEAD").contains(request.getMethod()) && request.getHeader("Authorization")==null && (origin==null || !"web-v1".equals(request.getHeader("X-XQ-Client")))) throw ApiError.forbidden();
            }
            chain.doFilter(request,response);
        } catch(ApiError error) {
            response.setStatus(error.status); response.setContentType("application/json;charset=UTF-8");
            json.writeValue(response.getOutputStream(),ApiSupport.envelope(error.status,error.getMessage(),null,error.code,request));
        }
    }
}
