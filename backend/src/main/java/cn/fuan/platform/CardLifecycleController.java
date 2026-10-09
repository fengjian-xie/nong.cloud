package cn.fuan.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

/** Cloud software records only: never claims payment, physical delivery or device activation. */
@RestController @RequestMapping("/api/v1")
public class CardLifecycleController {
    private final JdbcTemplate db;private final WriteService writes;private final PageQuery pages;
    public CardLifecycleController(JdbcTemplate db,WriteService writes,PageQuery pages){this.db=db;this.writes=writes;this.pages=pages;}
    private Object write(HttpServletRequest r,Map<String,Object> b,String action,java.util.function.Supplier<Object> operation){return ApiSupport.envelope(writes.write(r,b,action,operation),r);}
    private boolean manager(AuthService.Actor a){return a.permissions().contains("cards.manage");}
    private void version(Map<String,Object> row,HttpServletRequest r){if(((Number)row.get("version")).intValue()!=WriteService.version(r))throw ApiError.conflict("对象已更新，请刷新后重试");}
    private Map<String,Object> card(AuthService.Actor a,String id,boolean lock){
        List<Map<String,Object>> found=db.queryForList("SELECT * FROM xq_cards WHERE center_id=? AND id=?"+(manager(a)?"":" AND subject_id=?")+(lock?" FOR UPDATE":""),manager(a)?new Object[]{a.centerId(),id}:new Object[]{a.centerId(),id,a.subjectId()});if(found.isEmpty())throw ApiError.missing();return found.getFirst();
    }
    private Map<String,Object> application(AuthService.Actor a,String id,boolean lock){
        List<Map<String,Object>> rows=db.queryForList("SELECT q.*,ac.person_id FROM xq_card_requests q JOIN xq_accounts ac ON ac.id=q.account_id WHERE q.center_id=? AND q.id=?"+(manager(a)?"":" AND q.account_id=? AND q.identity_id=?")+(lock?" FOR UPDATE OF q":""),manager(a)?new Object[]{a.centerId(),id}:new Object[]{a.centerId(),id,a.accountId(),a.identityId()});if(rows.isEmpty())throw ApiError.missing();return rows.getFirst();
    }
    private Map<String,Object> receipt(String id,String status,int version){return Map.of("id",id,"status",status,"version",version,"feeFen",10000,"paymentStatus","not_connected","physicalDeliveryConfirmed",false);}
    private void appendBinding(Map<String,Object> c,AuthService.Actor a,String next,String action,String reason,int binding){db.update("INSERT INTO xq_card_binding_history(card_id,binding_version,center_id,subject_id,status,action,reason,actor_id) VALUES(?,?,?,?,?,?,?,?)",c.get("id"),binding,c.get("center_id"),c.get("subject_id"),next,action,reason,a.accountId());}
    private boolean hasReplacement(String id){return db.queryForObject("SELECT count(*) FROM xq_card_requests WHERE old_card_id=? AND status IN ('pending','approved')",Integer.class,id)>0;}

    @GetMapping("/card-requests") public Object requests(HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);if(!manager(a))a.require("cards.request");
        Map<String,Object> result=pages.fetch(r,"q.id,q.kind,q.old_card_id AS \"oldCardId\",q.new_card_id AS \"newCardId\",q.reason,q.fee_fen AS \"feeFen\",q.status,q.review_note AS \"reviewNote\",q.version,q.created_at AS \"createdAt\",ac.person_id AS requester_person","FROM xq_card_requests q JOIN xq_accounts ac ON ac.id=q.account_id WHERE q.center_id=?"+(manager(a)?"":" AND q.account_id=? AND q.identity_id=?"),"q.created_at DESC,q.id",manager(a)?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.accountId(),a.identityId()});
        for(Object item:(List<?>)result.get("items")){@SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)item;boolean self=a.personId().equals(row.remove("requester_person"));List<String> actions=new ArrayList<>();String status=String.valueOf(row.get("status"));if(!manager(a)&&Set.of("pending","approved").contains(status))actions.add("cancel");if(manager(a)&&!self&&status.equals("pending"))actions.addAll(List.of("approve","reject"));if(manager(a)&&!self&&status.equals("approved"))actions.add("register");row.put("availableActions",actions);row.put("paymentStatus","not_connected");row.put("physicalDeliveryConfirmed",false);}
        return ApiSupport.envelope(result,r);
    }
    @PostMapping("/card-requests") public Object apply(@RequestBody Map<String,Object> b,HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.request");return write(r,b,"card.apply",()->{
            String kind=ApiSupport.text(b,"kind",20),reason=ApiSupport.text(b,"reason",2000),old=ApiSupport.optional(b,"oldCardId",64);Integer binding=null;
            if(!Set.of("issue","replacement").contains(kind))throw ApiError.invalid("申请类型无效");
            if(kind.equals("replacement")){if(old.isEmpty())throw ApiError.invalid("补卡需选择原卡");Map<String,Object> c=card(a,old,true);if(!"lost".equals(c.get("status")))throw ApiError.conflict("补卡前请先挂失原卡");binding=((Number)c.get("binding_version")).intValue();}
            else if(!old.isEmpty())throw ApiError.invalid("办卡申请不能关联原卡");
            String id=ApiSupport.id();db.update("INSERT INTO xq_card_requests(id,center_id,subject_id,account_id,identity_id,kind,old_card_id,old_binding_version,reason) VALUES(?,?,?,?,?,?,?,?,?)",id,a.centerId(),a.subjectId(),a.accountId(),a.identityId(),kind,old.isEmpty()?null:old,binding,reason);return receipt(id,"pending",1);
        });
    }
    @PostMapping("/card-requests/{id}/cancel") public Object cancel(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.request");return write(r,b,"card.request.cancel",()->{Map<String,Object> q=application(a,id,true);if(!a.accountId().equals(q.get("account_id"))||!a.identityId().equals(q.get("identity_id")))throw ApiError.forbidden();version(q,r);if(!Set.of("pending","approved").contains(q.get("status")))throw ApiError.conflict("申请已结束");db.update("UPDATE xq_card_requests SET status='cancelled',version=version+1 WHERE id=?",id);return receipt(id,"cancelled",((Number)q.get("version")).intValue()+1);});
    }
    @PostMapping("/admin/card-requests/{id}/review") public Object review(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.manage");return write(r,b,"card.request.review",()->{Map<String,Object> q=application(a,id,true);version(q,r);if(a.personId().equals(q.get("person_id")))throw ApiError.forbidden();if(!"pending".equals(q.get("status")))throw ApiError.conflict("申请已处理");String next=ApiSupport.bool(b,"approved")?"approved":"rejected";db.update("UPDATE xq_card_requests SET status=?,review_note=?,reviewer_id=?,version=version+1 WHERE id=?",next,ApiSupport.text(b,"reviewNote",2000),a.accountId(),id);return receipt(id,next,((Number)q.get("version")).intValue()+1);});
    }
    @PostMapping("/admin/card-requests/{id}/register") public Object register(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.manage");return write(r,b,"card.cloud-register",()->{
            Map<String,Object> q=application(a,id,true);version(q,r);if(a.personId().equals(q.get("person_id")))throw ApiError.forbidden();if(!"approved".equals(q.get("status")))throw ApiError.conflict("仅已批准申请可云端登记");
            Object config=writes.serialize(Map.of("A","巡田","B","灌溉","C","修剪"));Map<String,Object> old=null;
            if("replacement".equals(q.get("kind"))){old=card(a,(String)q.get("old_card_id"),true);if(!old.get("subject_id").equals(q.get("subject_id"))||!"lost".equals(old.get("status"))||!old.get("binding_version").equals(q.get("old_binding_version")))throw ApiError.conflict("原卡绑定或挂失状态已变化");config=old.get("abc_config");}
            String newId=ApiSupport.id();db.update("INSERT INTO xq_cards(id,center_id,subject_id,device_uuid,abc_config,software_only) VALUES(?,?,?,?,?,true)",newId,a.centerId(),q.get("subject_id"),"software:"+newId,config);db.update("INSERT INTO xq_card_configurations(card_id,version,config) VALUES(?,1,?)",newId,config);
            Map<String,Object> created=card(a,newId,false);appendBinding(created,a,"active","cloud_register","申请"+q.get("id")+"批准后的云端绑定；未交付实物、未确认设备",1);
            if(old!=null){int binding=((Number)old.get("binding_version")).intValue()+1;db.update("UPDATE xq_cards SET status='retired',binding_version=?,version=version+1,acknowledged_config_version=0 WHERE id=?",binding,old.get("id"));appendBinding(old,a,"retired","replaced","新云端卡"+newId+"替换，原始记录保留",binding);}
            db.update("UPDATE xq_card_requests SET status='cloud_registered',new_card_id=?,version=version+1 WHERE id=?",newId,q.get("id"));
            Map<String,Object> result=new LinkedHashMap<>(receipt((String)q.get("id"),"cloud_registered",((Number)q.get("version")).intValue()+1));result.put("newCardId",newId);result.put("hardwareAuthenticated",false);result.put("deviceConfirmed",false);return result;
        });
    }
    @PostMapping("/cards/{id}/lifecycle/{action}") public Object lifecycle(@PathVariable String id,@PathVariable String action,@RequestBody Map<String,Object> b,HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);if(action.equals("report-loss")){if(!manager(a))a.require("cards.loss");}else if(Set.of("restore","retire").contains(action))a.require("cards.manage");else throw ApiError.missing();
        return write(r,b,"card."+action,()->{Map<String,Object> c=card(a,id,true);version(c,r);String reason=ApiSupport.text(b,"reason",2000),status=(String)c.get("status"),next;
            if(action.equals("report-loss")){if(!status.equals("active"))throw ApiError.conflict("仅有效卡可挂失");next="lost";}else{if(status.equals("retired"))throw ApiError.conflict("已停用卡不可恢复或重复停用");if(hasReplacement(id))throw ApiError.conflict("请先处理或取消补卡申请");if(action.equals("restore")&&!status.equals("lost"))throw ApiError.conflict("仅挂失卡可申请恢复");next=action.equals("restore")?"active":"retired";}
            int binding=((Number)c.get("binding_version")).intValue()+1,newVersion=((Number)c.get("version")).intValue()+1;
            db.update("UPDATE xq_cards SET status=?,binding_version=?,version=?,acknowledged_config_version=0 WHERE id=?",next,binding,newVersion,id);appendBinding(c,a,next,action,reason,binding);return Map.of("id",id,"status",next,"version",newVersion,"bindingVersion",binding,"deviceConfirmed",false);
        });
    }
    @GetMapping("/cards/{id}/binding-history") public Object bindingHistory(@PathVariable String id,HttpServletRequest r){AuthService.Actor a=AccessFilter.actor(r);a.require("cards.read");card(a,id,false);return ApiSupport.envelope(pages.fetch(r,"binding_version::text AS id,binding_version AS \"bindingVersion\",status,action,reason,created_at AS \"createdAt\"","FROM xq_card_binding_history WHERE card_id=?","binding_version DESC",id),r);}
    @GetMapping("/cards/{id}/configuration-history") public Object configHistory(@PathVariable String id,HttpServletRequest r){AuthService.Actor a=AccessFilter.actor(r);a.require("cards.read");card(a,id,false);Map<String,Object> result=pages.fetch(r,"version::text AS id,version,config,created_at AS \"createdAt\"","FROM xq_card_configurations WHERE card_id=?","version DESC",id);for(Object item:(List<?>)result.get("items")){@SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)item;row.put("configuration",writes.deserialize((String)row.remove("config")));}return ApiSupport.envelope(result,r);}
    @GetMapping("/cards/{id}/events") public Object events(@PathVariable String id,HttpServletRequest r){
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.read");card(a,id,false);
        Map<String,Object> result=pages.fetch(r,"e.event_id AS id,e.event_id AS \"eventId\",e.binding_version AS \"bindingVersion\",e.config_version AS \"configVersion\",e.button,e.occurred_at AS \"occurredAt\",e.received_at AS \"receivedAt\",e.fix_status AS \"fixStatus\",e.latitude,e.longitude,c.config","FROM xq_device_events e JOIN xq_card_configurations c ON c.card_id=e.card_id AND c.version=e.config_version WHERE e.card_id=?","e.received_at DESC,e.event_id",id);
        for(Object item:(List<?>)result.get("items")){@SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)item;@SuppressWarnings("unchecked") Map<String,Object> config=(Map<String,Object>)writes.deserialize((String)row.remove("config"));String button=(String)row.get("button");row.put("operation",button.equals("start")?"开工":button.equals("stop")?"收工":config.getOrDefault(button,"历史配置未设置"));row.put("verificationStatus","unverified");row.put("hardwareAuthenticated",false);}
        return ApiSupport.envelope(result,r);
    }
}
