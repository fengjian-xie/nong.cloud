package cn.fuan.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class ContentController {
    private static final String ACTIVE_PUBLIC_CENTER=" AND NOT EXISTS (WITH RECURSIVE ancestors AS (SELECT id,parent_id,status FROM xq_centers WHERE id=c.id UNION ALL SELECT p.id,p.parent_id,p.status FROM xq_centers p JOIN ancestors a ON p.id=a.parent_id) SELECT 1 FROM ancestors WHERE status<>'active')";
    private final JdbcTemplate db; private final WriteService writes; private final PageQuery pages;
    public ContentController(JdbcTemplate db,WriteService writes,PageQuery pages) { this.db=db;this.writes=writes;this.pages=pages; }
    private Object response(Object data,HttpServletRequest r) { return ApiSupport.envelope(data,r); }
    private Object write(HttpServletRequest r,Map<String,Object> b,String action,java.util.function.Supplier<Object> op) { return response(writes.write(r,b,action,op),r); }
    private void version(Map<String,Object> row,HttpServletRequest r) { if(((Number)row.get("version")).intValue()!=WriteService.version(r)) throw ApiError.conflict("对象已更新，请刷新"); }
    @GetMapping("/help-tickets") public Object tickets(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);if(!a.permissions().contains("help.manage"))a.require("help.create");String scope=a.permissions().contains("help.manage")?"":" AND account_id=? AND identity_id=?";
        return response(pages.fetch(r,"id,category,description,status,reply,version,created_at AS \"createdAt\"","FROM xq_help_tickets WHERE center_id=?"+scope,"created_at DESC,id",scope.isEmpty()?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.accountId(),a.identityId()}),r);
    }
    @PostMapping("/help-tickets") public Object ticket(@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("help.create");return write(r,b,"help.create",()->{
            String id=ApiSupport.id();db.update("INSERT INTO xq_help_tickets(id,center_id,account_id,identity_id,category,description) VALUES(?,?,?,?,?,?)",id,a.centerId(),a.accountId(),a.identityId(),ApiSupport.text(b,"category",80),ApiSupport.text(b,"description",2000));return Map.of("id",id,"status","open","version",1);
        });
    }
    @PostMapping("/help-tickets/{id}/reply") public Object reply(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("help.manage");return write(r,b,"help.reply",()->{
            List<Map<String,Object>> found=db.queryForList("SELECT * FROM xq_help_tickets WHERE center_id=? AND id=? FOR UPDATE",a.centerId(),id);if(found.isEmpty()) throw ApiError.missing();Map<String,Object> row=found.getFirst();version(row,r);
            String reply=ApiSupport.text(b,"reply",2000),status=ApiSupport.text(b,"status",20);if(!Set.of("processing","resolved").contains(status)||"closed".equals(row.get("status"))) throw ApiError.invalid("工单状态无效");
            db.update("UPDATE xq_help_tickets SET reply=?,status=?,version=version+1 WHERE id=?",reply,status,id);
            db.update("INSERT INTO xq_messages(id,center_id,account_id,title,body,category) VALUES(?,?,?,?,?,'系统')",ApiSupport.id(),a.centerId(),row.get("account_id"),"帮助工单已有回复",reply);return Map.of("id",id,"status",status,"version",((Number)row.get("version")).intValue()+1);
        });
    }
    @GetMapping("/messages") public Object messages(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("messages.read");return response(pages.fetch(r,"id,title,body,category,(read_at IS NOT NULL) AS read,created_at AS \"createdAt\"","FROM xq_messages WHERE center_id=? AND account_id=?","created_at DESC,id",a.centerId(),a.accountId()),r);
    }
    @PostMapping("/messages/{id}/read") public Object read(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) { AuthService.Actor a=AccessFilter.actor(r);a.require("messages.read");return write(r,b,"message.read",()->{if(db.update("UPDATE xq_messages SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND center_id=? AND account_id=?",id,a.centerId(),a.accountId())==0) throw ApiError.missing();return Map.of("id",id,"read",true);}); }
    @GetMapping("/identity-applications") public Object applications(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);if(!a.permissions().contains("identities.manage"))a.require("application.create");String scope=a.permissions().contains("identities.manage")?"":" AND account_id=?";
        return response(pages.fetch(r,"id,role_id AS role,subject_name AS \"subjectName\",address,reason,status,version,created_at AS \"createdAt\"","FROM xq_identity_applications WHERE center_id=?"+scope,"created_at DESC,id",scope.isEmpty()?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.accountId()}),r);
    }
    @GetMapping("/role-catalog") public Object roles(HttpServletRequest r) { return response(db.queryForList("SELECT id,name FROM xq_roles WHERE id NOT IN ('center_admin','support','content_admin') ORDER BY id"),r); }
    @PostMapping("/identity-applications") public Object application(@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("application.create");String role=ApiSupport.text(b,"role",40);
        if(!Set.of("farmer","cooperative","team","machine","protection","supplier","buyer","warehouse","processor","lab","family","consumer").contains(role)) throw ApiError.forbidden();
        return write(r,b,"identity.apply",()->{String id=ApiSupport.id();db.update("INSERT INTO xq_identity_applications(id,center_id,account_id,role_id,subject_name,address,reason) VALUES(?,?,?,?,?,?,?)",id,a.centerId(),a.accountId(),role,ApiSupport.text(b,"subjectName",120),ApiSupport.text(b,"address",300),ApiSupport.text(b,"reason",2000));return Map.of("id",id,"status","pending","version",1);});
    }
    @PostMapping("/admin/identity-applications/{id}/review") public Object review(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("identities.manage");return write(r,b,"identity.review",()->{
            List<Map<String,Object>> found=db.queryForList("SELECT x.*,ac.person_id FROM xq_identity_applications x JOIN xq_accounts ac ON ac.id=x.account_id WHERE x.id=? AND x.center_id=? FOR UPDATE OF x",id,a.centerId());if(found.isEmpty()) throw ApiError.missing();Map<String,Object> row=found.getFirst();version(row,r);
            if(a.personId().equals(row.get("person_id"))) throw ApiError.forbidden();if(!"pending".equals(row.get("status"))) throw ApiError.conflict("申请已处理");
            boolean approved=ApiSupport.bool(b,"approved");String subject=null;
            if(approved) {subject=ApiSupport.id();db.update("INSERT INTO xq_subjects(id,center_id,name,kind) VALUES(?,?,?,?)",subject,a.centerId(),row.get("subject_name"),row.get("role_id"));db.update("INSERT INTO xq_identities(id,account_id,center_id,subject_id,role_id) VALUES(?,?,?,?,?)",ApiSupport.id(),row.get("account_id"),a.centerId(),subject,row.get("role_id"));}
            String status=approved?"approved":"rejected";db.update("UPDATE xq_identity_applications SET status=?,subject_id=?,reviewer_id=?,version=version+1 WHERE id=?",status,subject,a.accountId(),id);return Map.of("id",id,"status",status,"version",((Number)row.get("version")).intValue()+1);
        });
    }
    @GetMapping("/admin/news") public Object news(HttpServletRequest r) { AuthService.Actor a=AccessFilter.actor(r);a.require("news.manage");return response(pages.fetch(r,"id,title,body,status,version,published_at AS \"publishedAt\",created_at AS \"createdAt\"","FROM xq_news WHERE center_id=?","created_at DESC,id",a.centerId()),r); }
    @PostMapping("/admin/news") public Object createNews(@RequestBody Map<String,Object> b,HttpServletRequest r) { AuthService.Actor a=AccessFilter.actor(r);a.require("news.manage");return write(r,b,"news.create",()->{String id=ApiSupport.id();db.update("INSERT INTO xq_news(id,center_id,author_id,title,body) VALUES(?,?,?,?,?)",id,a.centerId(),a.accountId(),ApiSupport.text(b,"title",150),ApiSupport.text(b,"body",20000));return Map.of("id",id,"status","draft","version",1);}); }
    @PostMapping("/admin/news/{id}/{action}") public Object publish(@PathVariable String id,@PathVariable String action,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("news.manage");if(!Set.of("publish","withdraw").contains(action)) throw ApiError.missing();return write(r,b,"news."+action,()->{
            List<Map<String,Object>> found=db.queryForList("SELECT * FROM xq_news WHERE center_id=? AND id=? FOR UPDATE",a.centerId(),id);if(found.isEmpty()) throw ApiError.missing();Map<String,Object> row=found.getFirst();version(row,r);
            String status=action.equals("publish")?"published":"withdrawn";db.update("UPDATE xq_news SET status=?,published_at=CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE published_at END,version=version+1 WHERE id=?",status,status,id);return Map.of("id",id,"status",status,"version",((Number)row.get("version")).intValue()+1);
        });
    }
    @GetMapping("/public/news") public Object publicNews(@RequestParam(defaultValue="local-fuan") String center,HttpServletRequest r) {
        return response(db.queryForList("SELECT n.id,n.title,n.body,n.published_at AS \"publishedAt\",c.name AS \"centerName\" FROM xq_news n JOIN xq_centers c ON c.id=n.center_id WHERE n.center_id=? AND n.status='published' AND c.status='active'"+ACTIVE_PUBLIC_CENTER+" ORDER BY n.published_at DESC LIMIT 20",center),r);
    }
    @GetMapping("/public/site-config") public Object social(@RequestParam(defaultValue="local-fuan") String center,HttpServletRequest r) {return response(db.queryForList("SELECT s.channel,s.display_name AS \"displayName\",s.url FROM xq_social_accounts s JOIN xq_centers c ON c.id=s.center_id WHERE s.center_id=? AND s.enabled=true AND c.status='active'"+ACTIVE_PUBLIC_CENTER,center),r);}
    @GetMapping("/admin/social-accounts") public Object socialAdmin(HttpServletRequest r) {AuthService.Actor a=AccessFilter.actor(r);a.require("news.manage");return response(db.queryForList("SELECT channel,display_name AS \"displayName\",url,enabled FROM xq_social_accounts WHERE center_id=?",a.centerId()),r);}
    @PutMapping("/admin/social-accounts/{channel}") public Object socialSave(@PathVariable String channel,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("news.manage");if(!Set.of("wechat_video","douyin","xiaohongshu").contains(channel))throw ApiError.invalid("渠道无效");
        String url=ApiSupport.optional(b,"url",500);if(!url.isEmpty()) {java.net.URI uri;try {uri=java.net.URI.create(url);}catch(Exception e){throw ApiError.invalid("链接无效");}Set<String> hosts=switch(channel){case "wechat_video"->Set.of("channels.weixin.qq.com");case "douyin"->Set.of("www.douyin.com");default->Set.of("www.xiaohongshu.com","xhslink.com");};String host=uri.getHost();if(!"https".equals(uri.getScheme())||uri.getUserInfo()!=null||uri.getPort()!=-1||host==null||!hosts.contains(host))throw ApiError.invalid("仅允许对应社交平台的HTTPS链接");}
        boolean enabled=ApiSupport.bool(b,"enabled");if(enabled&&url.isEmpty())throw ApiError.invalid("启用前需配置有效链接");
        return write(r,b,"social.configure",()->{db.update("INSERT INTO xq_social_accounts(center_id,channel,display_name,url,enabled) VALUES(?,?,?,?,?) ON CONFLICT(center_id,channel) DO UPDATE SET display_name=EXCLUDED.display_name,url=EXCLUDED.url,enabled=EXCLUDED.enabled",a.centerId(),channel,ApiSupport.text(b,"displayName",100),url,enabled);return Map.of("channel",channel,"saved",true);});
    }
}
