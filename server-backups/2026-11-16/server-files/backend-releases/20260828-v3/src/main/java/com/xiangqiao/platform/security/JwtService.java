package com.xiangqiao.platform.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class JwtService {
    private final JwtEncoder encoder;
    private final Duration ttl;

    public JwtService(@Value("${app.security.jwt-secret}") String secret,
                      @Value("${app.security.token-ttl}") Duration ttl) {
        byte[] bytes = java.util.Arrays.copyOf(secret.getBytes(StandardCharsets.UTF_8), 32);
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(bytes));
        this.ttl = ttl;
    }

    public String issue(UUID userId, String displayName, String countyCode, List<String> roles) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder()
                .issuer("xiangqiao-platform")
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .subject(userId.toString())
                .claim("name", displayName)
                .claim("county", countyCode)
                .claim("counties", List.of(countyCode))
                .claim("roles", roles)
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public static JwtDecoder decoder(String secret) {
        byte[] bytes = java.util.Arrays.copyOf(secret.getBytes(StandardCharsets.UTF_8), 32);
        return NimbusJwtDecoder.withSecretKey(new SecretKeySpec(bytes, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
    }
}
