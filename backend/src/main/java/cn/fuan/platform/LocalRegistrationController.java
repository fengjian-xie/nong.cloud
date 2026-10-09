package cn.fuan.platform;

import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

/** A local development entrance, not a production password-registration service. */
@RestController @RequestMapping("/api/v1/auth")
public class LocalRegistrationController {
 private final JdbcTemplate db; private final AuthService auth; private final TransactionTemplate tx; private final boolean enabled;
 public LocalRegistrationController(JdbcTemplate db,AuthService auth,PlatformTransactionManager manager,Environment env,@Value("${xq.local-bootstrap}") boolean bootstrap) {
  this.db=db;this.auth=auth;tx=new TransactionTemplate(manager);enabled=bootstrap&&Arrays.asList(env.getActiveProfiles()).contains("local");
 }
 @PostMapping("/local-register") public Object register(@RequestBody Map<String,Object> b,HttpServletRequest r,HttpServletResponse response) {
  if(!enabled||!Set.of("127.0.0.1","0:0:0:0:0:0:0:1","::1").contains(r.getRemoteAddr()))throw new ApiError(503,"XQ-LOCAL-503","本地测试注册未启用；正式注册须接入微信与中心准入");
  String username=ApiSupport.text(b,"username",64),password=ApiSupport.text(b,"password",128),name=ApiSupport.text(b,"name",100),center=ApiSupport.text(b,"centerId",64);
  if(!username.matches("qa[._-][a-zA-Z0-9._-]{6,60}")||password.length()<12)throw ApiError.invalid("测试账号须以qa.或qa_或qa-开头，密码至少12字符");
  if(db.queryForObject("WITH RECURSIVE ancestors AS (SELECT id,parent_id,status FROM xq_centers WHERE id=? UNION ALL SELECT c.id,c.parent_id,c.status FROM xq_centers c JOIN ancestors p ON c.id=p.parent_id) SELECT count(*) FROM ancestors WHERE status='suspended'",Integer.class,center)>0||db.queryForObject("SELECT count(*) FROM xq_centers WHERE id=? AND status='active'",Integer.class,center)==0)throw ApiError.missing();
  String hash=auth.encode(password);
  Map<String,Object> session=tx.execute(status->{
   String account=ApiSupport.id(),person=ApiSupport.id(),subject=ApiSupport.id();
   db.update("INSERT INTO xq_people(id) VALUES(?)",person);
   db.update("INSERT INTO xq_accounts(id,person_id,username,password_hash,display_name) VALUES(?,?,?,?,?)",account,person,username,hash,name);
   db.update("INSERT INTO xq_subjects(id,center_id,name,kind) VALUES(?,?,?,'consumer')",subject,center,name);
   db.update("INSERT INTO xq_identities(id,account_id,center_id,subject_id,role_id) VALUES(?,?,?,?,'consumer')",ApiSupport.id(),account,center,subject);
   return auth.issue(account);
  });
  response.addHeader("Set-Cookie",ResponseCookie.from("xq_session",(String)session.get("token")).httpOnly(true).secure(false).sameSite("Lax").path("/api/v1").maxAge(43200).build().toString());
  return ApiSupport.envelope(session,r);
 }
}
