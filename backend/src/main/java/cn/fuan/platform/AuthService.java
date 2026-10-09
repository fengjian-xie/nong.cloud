package cn.fuan.platform;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final JdbcTemplate db;
    private final BCryptPasswordEncoder passwords=new BCryptPasswordEncoder(12);
    private final SecureRandom random=new SecureRandom();
    private final String dummy=passwords.encode(UUID.randomUUID().toString());
    private final Map<String,Attempt> failures=new ConcurrentHashMap<>();
    record Attempt(int count,long until) {}
    // A suspended parent also suspends descendant access without destroying their own status.
    private static final String ACTIVE_TREE=" AND NOT EXISTS (WITH RECURSIVE ancestors AS (SELECT id,parent_id,status FROM xq_centers WHERE id=i.center_id UNION ALL SELECT c.id,c.parent_id,c.status FROM xq_centers c JOIN ancestors p ON c.id=p.parent_id) SELECT 1 FROM ancestors WHERE status<>'active')";
    private static final String DEFAULT_IDENTITY=" ORDER BY CASE WHEN i.role_id IN ('farmer','center_admin') THEN 0 WHEN i.role_id='consumer' THEN 9 WHEN i.role_id='family' THEN 8 ELSE 1 END,CASE WHEN c.parent_id IS NULL THEN 0 ELSE 1 END,i.id";
    public record Actor(String accountId,String personId,String identityId,String centerId,String subjectId,String role,Set<String> permissions) {
        boolean admin() { return permissions.contains("center.manage"); }
        void require(String permission) { if(!permissions.contains(permission)) throw ApiError.forbidden(); }
    }
    public AuthService(JdbcTemplate db) { this.db=db; }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public String encode(String value) { return passwords.encode(value); }
    public Map<String,Object> login(String username,String password,String remote) {
        String key=remote+":"+username;
        long now=System.currentTimeMillis();
        failures.entrySet().removeIf(e->e.getValue().until<now);
        Attempt attempts=failures.get(key);
        if(attempts!=null && attempts.count>=10) throw new ApiError(429,"XQ-AUTH-429","登录尝试过多，请稍后重试");
        List<Map<String,Object>> users=db.queryForList("SELECT id,password_hash FROM xq_accounts WHERE username=? AND status='active'",username);
        String stored=users.isEmpty()?dummy:(String)users.getFirst().get("password_hash");
        boolean matched=passwords.matches(password,stored==null?dummy:stored);
        if(users.isEmpty() || !matched) {
            if(failures.size()>=5000) throw new ApiError(429,"XQ-AUTH-429","请稍后重试");
            failures.compute(key,(k,a)->new Attempt(a==null?1:a.count+1,now+900000));
            throw new ApiError(401,"XQ-AUTH-401","账号或密码错误");
        }
        failures.remove(key);
        return issue(String.valueOf(users.getFirst().get("id")));
    }
    public Map<String,Object> issue(String account) {
        if(db.queryForObject("SELECT count(*) FROM xq_accounts WHERE id=? AND status='active'",Integer.class,account)==0) throw unauthorized();
        List<Map<String,Object>> ids=identities(account);
        if(ids.isEmpty()) throw new ApiError(403,"XQ-IDENTITY-403","账号尚无已批准的身份");
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires=Instant.now().plusSeconds(43200);
        db.update("INSERT INTO xq_sessions(token_hash,account_id,identity_id,expires_at) VALUES(?,?,?,?)",hash(token),account,ids.getFirst().get("id"),java.sql.Timestamp.from(expires));
        Map<String,Object> result=new LinkedHashMap<>(me(resolve(token)));
        result.put("token",token); result.put("expiresAt",expires.toString());
        return result;
    }
    public Actor resolve(String token) {
        if(token==null || token.length()>128) throw unauthorized();
        List<Map<String,Object>> rows=db.queryForList("SELECT a.id,a.person_id,i.id AS identity_id,i.center_id,i.subject_id,i.role_id FROM xq_sessions s JOIN xq_accounts a ON a.id=s.account_id JOIN xq_identities i ON i.id=s.identity_id AND i.account_id=a.id JOIN xq_centers c ON c.id=i.center_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND a.status='active' AND i.status='approved' AND c.status='active'"+ACTIVE_TREE,hash(token));
        if(rows.isEmpty()) throw unauthorized();
        Map<String,Object> r=rows.getFirst();
        Set<String> permissions=new HashSet<>(db.queryForList("SELECT permission FROM xq_role_permissions WHERE role_id=?",String.class,r.get("role_id")));
        return new Actor((String)r.get("id"),(String)r.get("person_id"),(String)r.get("identity_id"),(String)r.get("center_id"),(String)r.get("subject_id"),(String)r.get("role_id"),permissions);
    }
    public List<Map<String,Object>> identities(String account) {
        return db.queryForList("SELECT i.id,i.role_id AS role,i.center_id AS \"centerId\",i.subject_id AS \"subjectId\",r.name AS label,o.name AS org,c.name AS \"centerName\" FROM xq_identities i JOIN xq_roles r ON r.id=i.role_id JOIN xq_subjects o ON o.id=i.subject_id AND o.center_id=i.center_id JOIN xq_centers c ON c.id=i.center_id WHERE i.account_id=? AND i.status='approved' AND c.status='active'"+ACTIVE_TREE+DEFAULT_IDENTITY,account);
    }
    public Map<String,Object> me(Actor actor) {
        Map<String,Object> account=db.queryForMap("SELECT id,display_name AS name,username FROM xq_accounts WHERE id=?",actor.accountId);
        Map<String,Object> user=new LinkedHashMap<>(account); user.put("phone",""); user.put("role",actor.role);
        return Map.of("user",user,"identities",identities(actor.accountId),"activeIdentityId",actor.identityId,"permissions",actor.permissions);
    }
    public Map<String,Object> switchIdentity(Actor actor,String token,String identity) {
        if(identities(actor.accountId).stream().noneMatch(i->identity.equals(i.get("id")))) throw ApiError.forbidden();
        db.update("UPDATE xq_sessions SET identity_id=? WHERE token_hash=? AND account_id=?",identity,hash(token),actor.accountId);
        return me(resolve(token));
    }
    public void logout(String token) { if(token!=null) db.update("DELETE FROM xq_sessions WHERE token_hash=?",hash(token)); }
    public static ApiError unauthorized() { return new ApiError(401,"XQ-AUTH-401","登录已失效，请重新登录"); }
}
