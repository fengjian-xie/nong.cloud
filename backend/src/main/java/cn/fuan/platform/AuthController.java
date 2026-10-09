package cn.fuan.platform;

import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@RestController @RequestMapping("/api/v1")
public class AuthController {
    private final AuthService auth; private final JdbcTemplate db; private final boolean secure; private final String appid,secret;
    public AuthController(AuthService auth,JdbcTemplate db,@Value("${xq.cookie-secure}") boolean secure,@Value("${fuan.wechat.appid}") String appid,@Value("${fuan.wechat.secret}") String secret) { this.auth=auth;this.db=db;this.secure=secure;this.appid=appid;this.secret=secret; }
    @GetMapping("/health") public Object health(HttpServletRequest request) {
        db.queryForObject("SELECT 1",Integer.class);
        return ApiSupport.envelope(Map.of("database","postgresql","status","up","hardwareVerified",false,"paymentsEnabled",false),request);
    }
    @PostMapping("/auth/password/login") public Object login(@RequestBody Map<String,Object> body,HttpServletRequest request,HttpServletResponse response) {
        Map<String,Object> session=auth.login(ApiSupport.text(body,"username",128),ApiSupport.text(body,"password",256),request.getRemoteAddr());
        cookie(response,(String)session.get("token"),43200); return ApiSupport.envelope(session,request);
    }
    @PostMapping("/auth/wechat/login") public Object wechat(@RequestBody Map<String,Object> body,HttpServletRequest request,HttpServletResponse response) {
        if(appid.isBlank() || secret.isBlank()) throw new ApiError(503,"XQ-WECHAT-503","微信服务端凭据尚未配置，未启用微信认证");
        String code=ApiSupport.text(body,"code",256);
        Map<?,?> result;
        try {
            SimpleClientHttpRequestFactory factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(5000);factory.setReadTimeout(5000);
            result=RestClient.builder().baseUrl("https://api.weixin.qq.com").requestFactory(factory).build().get().uri(uri->uri.path("/sns/jscode2session").queryParam("appid",appid).queryParam("secret",secret).queryParam("js_code",code).queryParam("grant_type","authorization_code").build()).retrieve().body(Map.class);
        } catch(Exception e) { throw new ApiError(503,"XQ-WECHAT-503","微信认证暂时不可用"); }
        if(result==null || !(result.get("openid") instanceof String openid)) throw new ApiError(401,"XQ-WECHAT-401","微信登录凭证无效");
        List<String> accounts=db.queryForList("SELECT account_id FROM xq_wechat_accounts WHERE appid=? AND openid=?",String.class,appid,openid);
        if(accounts.isEmpty()) throw new ApiError(403,"XQ-WECHAT-403","微信账号尚未由中心绑定；不会自动授予业务身份");
        Map<String,Object> session=auth.issue(accounts.getFirst()); cookie(response,(String)session.get("token"),43200);
        return ApiSupport.envelope(session,request);
    }
    @GetMapping("/users/me") public Object me(HttpServletRequest request) { return ApiSupport.envelope(auth.me(AccessFilter.actor(request)),request); }
    @PostMapping("/identities/{id}/switch") public Object change(@PathVariable String id,HttpServletRequest request) { return ApiSupport.envelope(auth.switchIdentity(AccessFilter.actor(request),AccessFilter.token(request),id),request); }
    @PostMapping("/auth/logout") public Object logout(HttpServletRequest request,HttpServletResponse response) { auth.logout(AccessFilter.token(request)); cookie(response,"",0); return ApiSupport.envelope(Map.of("loggedOut",true),request); }
    @GetMapping("/tenants/current/config") public Object config(HttpServletRequest request) {
        AuthService.Actor actor=AccessFilter.actor(request);
        return ApiSupport.envelope(Map.of("center",db.queryForMap("SELECT id,name,county_code AS \"countyCode\" FROM xq_centers WHERE id=?",actor.centerId()),"permissions",actor.permissions(),"features",Map.of("database",true,"payment",false,"hardware",false,"camera",false)),request);
    }
    private void cookie(HttpServletResponse response,String token,long seconds) { response.addHeader("Set-Cookie",ResponseCookie.from("xq_session",token).httpOnly(true).secure(secure).sameSite("Lax").path("/api/v1").maxAge(seconds).build().toString()); }
}
