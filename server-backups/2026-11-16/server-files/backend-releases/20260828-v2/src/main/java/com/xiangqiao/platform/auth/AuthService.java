package com.xiangqiao.platform.auth;

import com.xiangqiao.platform.security.JwtService;
import com.xiangqiao.platform.security.SensitiveDataCodec;
import com.xiangqiao.platform.shared.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AuthService {
    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;
    private final SensitiveDataCodec codec;
    private final JwtService jwt;

    public AuthService(JdbcClient jdbc, PasswordEncoder passwords, SensitiveDataCodec codec, JwtService jwt) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.codec = codec;
        this.jwt = jwt;
    }

    @Transactional
    public AuthController.TokenResponse register(AuthController.RegisterRequest request) {
        return register(request, false);
    }

    @Transactional
    public AuthController.TokenResponse registerBootstrapOperator(AuthController.RegisterRequest request) {
        return register(request, true);
    }

    private AuthController.TokenResponse register(AuthController.RegisterRequest request, boolean allowOperator) {
        if ("COUNTY_OPERATOR".equals(request.identityType()) && !allowOperator) {
            throw ApiException.forbidden("县域运营管理员只能由平台初始化或上级管理员创建");
        }
        boolean countyExists = jdbc.sql("select count(*) from county_space where code=:code and status='ACTIVE'")
                .param("code", request.countyCode()).query(Integer.class).single() > 0;
        if (!countyExists) throw ApiException.badRequest("COUNTY_INVALID", "所选县域暂未开通");
        String mobileHash = codec.hash(request.mobile());
        if (jdbc.sql("select count(*) from user_account where mobile_hash=:hash").param("hash", mobileHash)
                .query(Integer.class).single() > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "MOBILE_EXISTS", "该手机号已经注册");
        }
        UUID userId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        jdbc.sql("""
                insert into user_account(id,mobile_hash,mobile_ciphertext,display_name,password_hash,created_at,updated_at)
                values(:id,:hash,:cipher,:name,:password,:now,:now)
                """).param("id", userId).param("hash", mobileHash).param("cipher", codec.encrypt(request.mobile()))
                .param("name", request.displayName()).param("password", passwords.encode(request.password()))
                .param("now", now).update();
        String role = roleFor(request.identityType());
        jdbc.sql("""
                insert into county_membership(id,county_code,user_id,identity_type,role_code,organization_name,created_at,updated_at)
                values(:id,:county,:userId,:identity,:role,:organization,:now,:now)
                """).param("id", UUID.randomUUID()).param("county", request.countyCode()).param("userId", userId)
                .param("identity", request.identityType()).param("role", role)
                .param("organization", request.organizationName()).param("now", now).update();
        String token = jwt.issue(userId, request.displayName(), request.countyCode(), List.of(role));
        return new AuthController.TokenResponse(token, "Bearer", userId, request.countyCode(), List.of(role));
    }

    public AuthController.TokenResponse login(AuthController.LoginRequest request) {
        var user = jdbc.sql("""
                select u.id,u.display_name,u.password_hash,m.role_code
                from user_account u join county_membership m on m.user_id=u.id
                where u.mobile_hash=:hash and m.county_code=:county and u.status='ACTIVE'
                """).param("hash", codec.hash(request.mobile())).param("county", request.countyCode())
                .query((rs, n) -> new LoginRow((UUID) rs.getObject("id"), rs.getString("display_name"),
                        rs.getString("password_hash"), rs.getString("role_code"))).optional()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", "手机号、密码或县域不正确"));
        if (!passwords.matches(request.password(), user.passwordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", "手机号、密码或县域不正确");
        }
        var roles = List.of(user.role());
        return new AuthController.TokenResponse(jwt.issue(user.id(), user.name(), request.countyCode(), roles),
                "Bearer", user.id(), request.countyCode(), roles);
    }

    private String roleFor(String identity) {
        return switch (identity) {
            case "GROWER" -> "GROWER";
            case "SERVICE_TEAM" -> "SERVICE_PROVIDER";
            case "RESOURCE_OWNER" -> "RESOURCE_OWNER";
            case "AGRONOMIST" -> "AGRONOMIST";
            case "BROKER" -> "BROKER";
            case "BUYER" -> "BUYER";
            case "COUNTY_OPERATOR" -> "COUNTY_OPERATOR";
            default -> throw ApiException.badRequest("IDENTITY_INVALID", "不支持的身份类型");
        };
    }

    private record LoginRow(UUID id, String name, String passwordHash, String role) {}
}
