package cn.fuan.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class CardController {
    private final JdbcTemplate db; private final WriteService writes; private final PageQuery pages;
    public CardController(JdbcTemplate db,WriteService writes,PageQuery pages) {this.db=db;this.writes=writes;this.pages=pages;}
    private Map<String,Object> card(AuthService.Actor a,String id,boolean lock) {
        a.require("cards.read");List<Map<String,Object>> rows=db.queryForList("SELECT * FROM xq_cards WHERE center_id=? AND id=?"+(a.admin()?"":" AND subject_id=?")+(lock?" FOR UPDATE":""),a.admin()?new Object[]{a.centerId(),id}:new Object[]{a.centerId(),id,a.subjectId()});if(rows.isEmpty())throw ApiError.missing();return rows.getFirst();
    }
    @GetMapping("/cards") public Object cards(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.read");
        Map<String,Object> result=pages.fetch(r,"id,status,version,software_only AS \"softwareOnly\",binding_version AS \"bindingVersion\",desired_config_version AS \"desiredConfigVersion\",acknowledged_config_version AS \"acknowledgedConfigVersion\",abc_config,EXISTS(SELECT 1 FROM xq_card_requests q WHERE q.old_card_id=xq_cards.id AND q.status IN ('pending','approved')) AS pending_replacement","FROM xq_cards WHERE center_id=?"+(a.admin()?"":" AND subject_id=?"),"id",a.admin()?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.subjectId()});
        for(Object item:(List<?>)result.get("items")) { @SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)item;row.put("configuration",writes.deserialize((String)row.remove("abc_config")));row.put("deviceConfirmed",false);row.put("hardwareAuthenticated",false);boolean pending=Boolean.TRUE.equals(row.remove("pending_replacement"));String status=(String)row.get("status");List<String> actions=new ArrayList<>();if(status.equals("active")){if(a.permissions().contains("cards.configure"))actions.add("configure");if(a.permissions().contains("cards.loss")||a.permissions().contains("cards.manage"))actions.add("report-loss");}if(a.permissions().contains("cards.manage")&&!pending&&!status.equals("retired")){actions.add("retire");if(status.equals("lost"))actions.add("restore");}row.put("availableActions",actions); }
        return ApiSupport.envelope(result,r);
    }
    @GetMapping("/cards/{id}/configuration") public Object configuration(@PathVariable String id,HttpServletRequest r) {
        Map<String,Object> row=card(AccessFilter.actor(r),id,false);
        return ApiSupport.envelope(Map.of("id",id,"configuration",writes.deserialize((String)row.get("abc_config")),"desiredConfigVersion",row.get("desired_config_version"),"acknowledgedConfigVersion",row.get("acknowledged_config_version"),"deviceConfirmed",false),r);
    }
    @PutMapping("/cards/{id}/configuration") public Object configure(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("cards.configure");return ApiSupport.envelope(writes.write(r,b,"card.configure",()->{
            Map<String,Object> card=card(a,id,true);if(!"active".equals(card.get("status")))throw ApiError.conflict("卡片不可用");if(WriteService.version(r)!=((Number)card.get("desired_config_version")).intValue())throw ApiError.conflict("配置版本已变化");
            Map<String,String> config=Map.of("A",ApiSupport.text(b,"A",80),"B",ApiSupport.text(b,"B",80),"C",ApiSupport.text(b,"C",80));int next=((Number)card.get("desired_config_version")).intValue()+1;
            db.update("INSERT INTO xq_card_configurations(card_id,version,config) VALUES(?,?,?)",id,next,writes.serialize(config));db.update("UPDATE xq_cards SET abc_config=?,desired_config_version=? WHERE id=?",writes.serialize(config),next,id);return Map.of("id",id,"desiredConfigVersion",next,"acknowledgedConfigVersion",card.get("acknowledged_config_version"),"deviceConfirmed",false);
        }),r);
    }
    @PostMapping("/cards/{id}/events") public Object events(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);
        if(!a.permissions().contains("cards.manage"))a.require("cards.upload");
        return ApiSupport.envelope(writes.write(r,b,"device.ingest-unverified",()->{
            Map<String,Object> card=card(a,id,true);if(!"active".equals(card.get("status")))throw ApiError.conflict("卡片不可用");
            if(!(b.get("events") instanceof List<?> events)||events.isEmpty()||events.size()>100)throw ApiError.invalid("每次同步1–100条事件");
            List<Object> receipts=new ArrayList<>();
            for(Object input:events) {
                if(!(input instanceof Map<?,?> raw))throw ApiError.invalid("事件格式无效");Map<String,Object> event=new LinkedHashMap<>();raw.forEach((k,v)->event.put(String.valueOf(k),v));
                String eventId=ApiSupport.text(event,"eventId",128),button=ApiSupport.text(event,"button",10),fix=ApiSupport.text(event,"fixStatus",30);
                if(!Set.of("start","stop","A","B","C").contains(button)||!Set.of("fixed","failed","pending").contains(fix))throw ApiError.invalid("按键或定位状态无效");
                int binding=integer(event,"bindingVersion"),config=integer(event,"configVersion");if(binding!=((Number)card.get("binding_version")).intValue())throw ApiError.conflict("绑卡版本不匹配");
                if(db.queryForObject("SELECT count(*) FROM xq_card_configurations WHERE card_id=? AND version=?",Integer.class,id,config)==0)throw ApiError.invalid("配置版本不存在");
                Instant occurred=ApiSupport.instant(event,"occurredAt");if(occurred.isAfter(Instant.now().plusSeconds(300)))throw ApiError.invalid("事件时间晚于当前时间");
                BigDecimal lat=coordinate(event.get("latitude"),90),lon=coordinate(event.get("longitude"),180);if((lat==null)!=(lon==null)||("fixed".equals(fix)&&lat==null))throw ApiError.invalid("经纬度或定位状态不一致");
                String hash=AuthService.hash(writes.serialize(event));List<String> old=db.queryForList("SELECT payload_hash FROM xq_device_events WHERE card_id=? AND event_id=?",String.class,id,eventId);boolean duplicate=!old.isEmpty();
                if(duplicate&&!old.getFirst().equals(hash))throw ApiError.conflict("同一事件ID内容冲突");
                if(!duplicate)db.update("INSERT INTO xq_device_events(card_id,event_id,binding_version,config_version,button,occurred_at,latitude,longitude,fix_status,payload_hash) VALUES(?,?,?,?,?,?,?,?,?,?)",id,eventId,binding,config,button,Timestamp.from(occurred),lat,lon,fix,hash);
                receipts.add(Map.of("eventId",eventId,"persisted",true,"duplicate",duplicate,"verificationStatus","unverified"));
            }
            return Map.of("cardId",id,"receipts",receipts,"hardwareAuthenticated",false);
        }),r);
    }
    private int integer(Map<String,Object> b,String key){try{String s=String.valueOf(b.get(key));int n=Integer.parseInt(s);if(n<1)throw new NumberFormatException();return n;}catch(Exception e){throw ApiError.invalid(key+"必须为正整数");}}
    private BigDecimal coordinate(Object value,int limit){if(value==null)return null;try{BigDecimal d=new BigDecimal(String.valueOf(value));if(d.abs().compareTo(BigDecimal.valueOf(limit))>0||d.scale()>7)throw new NumberFormatException();return d;}catch(Exception e){throw ApiError.invalid("坐标无效");}}
}
