package cn.fuan.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class BusinessController {
    private final JdbcTemplate db; private final WriteService writes; private final PageQuery pages;
    public BusinessController(JdbcTemplate db,WriteService writes,PageQuery pages) { this.db=db;this.writes=writes;this.pages=pages; }
    private Object response(Object data,HttpServletRequest request) { return ApiSupport.envelope(data,request); }
    private Object write(HttpServletRequest request,Map<String,Object> body,String action,java.util.function.Supplier<Object> op) { return response(writes.write(request,body,action,op),request); }
    private Map<String,Object> plot(AuthService.Actor a,String id,boolean lock) {
        List<Map<String,Object>> rows=db.queryForList("SELECT id,center_id AS \"centerId\",subject_id AS \"subjectId\",name,area_mu AS \"areaMu\",crop,address,latitude,longitude,status,version,created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM xq_plots WHERE center_id=? AND id=?"+(a.admin()?"":" AND subject_id=?")+(lock?" FOR UPDATE":""),a.admin()?new Object[]{a.centerId(),id}:new Object[]{a.centerId(),id,a.subjectId()});
        if(rows.isEmpty()) throw ApiError.missing();return rows.getFirst();
    }
    private void version(Map<String,Object> row,HttpServletRequest request) { if(((Number)row.get("version")).intValue()!=WriteService.version(request)) throw ApiError.conflict("对象已更新，请刷新后重试"); }
    @GetMapping("/plots") public Object plots(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("plots.read");
        return response(pages.fetch(r,"id,center_id AS \"centerId\",subject_id AS \"subjectId\",name,area_mu AS \"areaMu\",crop,address,latitude,longitude,status,version,created_at AS \"createdAt\",updated_at AS \"updatedAt\"","FROM xq_plots WHERE center_id=?"+(a.admin()?"":" AND subject_id=?"),"created_at DESC,id",a.admin()?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.subjectId()}),r);
    }
    @GetMapping("/plots/{id}") public Object plotDetail(@PathVariable String id,HttpServletRequest r) { AuthService.Actor a=AccessFilter.actor(r);a.require("plots.read");return response(plot(a,id,false),r); }
    @PostMapping("/plots") public Object createPlot(@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("plots.write");
        return write(r,b,"plot.create",()->{
            String subject=a.admin()?ApiSupport.text(b,"subjectId",64):a.subjectId();
            if(db.queryForObject("SELECT count(*) FROM xq_subjects WHERE center_id=? AND id=?",Integer.class,a.centerId(),subject)==0) throw ApiError.missing();
            String id=ApiSupport.id(); db.update("INSERT INTO xq_plots(id,center_id,subject_id,name,area_mu,crop,address) VALUES(?,?,?,?,?,?,?)",id,a.centerId(),subject,ApiSupport.text(b,"name",120),ApiSupport.positive(b,"areaMu"),ApiSupport.text(b,"crop",80),ApiSupport.text(b,"address",300));return plot(a,id,false);
        });
    }
    @PatchMapping("/plots/{id}") public Object updatePlot(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("plots.write");return write(r,b,"plot.update",()->{
            Map<String,Object> current=plot(a,id,true);version(current,r);
            if(!current.get("status").equals("pending")) throw ApiError.conflict("正式地块不可直接覆盖，需提交附证据的变更申请");
            db.update("UPDATE xq_plots SET name=?,area_mu=?,crop=?,address=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",ApiSupport.text(b,"name",120),ApiSupport.positive(b,"areaMu"),ApiSupport.text(b,"crop",80),ApiSupport.text(b,"address",300),id);return plot(a,id,false);
        });
    }
    @PostMapping("/admin/plots/{id}/verify") public Object verifyPlot(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("plots.verify");return write(r,b,"plot.verify",()->{
            Map<String,Object> p=plot(a,id,true);version(p,r);if(!p.get("status").equals("pending")) throw ApiError.conflict("仅待审核地块可核验");
            String status=ApiSupport.bool(b,"approved")?"verified":"rejected";
            db.update("UPDATE xq_plots SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",status,id);return plot(a,id,false);
        });
    }
    @GetMapping("/farm-activities") public Object activities(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("records.read");
        return response(pages.fetch(r,"f.id,f.plot_id AS \"plotId\",p.name AS \"plotName\",f.operation,f.occurred_at AS \"occurredAt\",f.source,f.note,f.created_at AS \"createdAt\"","FROM xq_activities f JOIN xq_plots p ON p.id=f.plot_id AND p.center_id=f.center_id WHERE f.center_id=?"+(a.admin()?"":" AND p.subject_id=?"),"f.created_at DESC,f.id",a.admin()?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.subjectId()}),r);
    }
    @PostMapping("/farm-activities") public Object activity(@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("records.write");return write(r,b,"activity.create",()->{
            String plotId=ApiSupport.text(b,"plotId",64);plot(a,plotId,false);
            String operation=ApiSupport.text(b,"operation",80),sequence=ApiSupport.text(b,"clientSeq",128),note=ApiSupport.optional(b,"note",2000);
            Instant occurred=ApiSupport.instant(b,"occurredAt");
            if(occurred.isAfter(Instant.now().plusSeconds(300))) throw ApiError.invalid("记录时间不能晚于当前时间");
            List<Map<String,Object>> existing=db.queryForList("SELECT id,plot_id,operation,occurred_at,note FROM xq_activities WHERE actor_id=? AND client_seq=?",a.accountId(),sequence);
            if(!existing.isEmpty()) { Map<String,Object> old=existing.getFirst();if(!plotId.equals(old.get("plot_id")) || !operation.equals(old.get("operation")) || !note.equals(old.get("note")) || !occurred.equals(((Timestamp)old.get("occurred_at")).toInstant())) throw ApiError.conflict("clientSeq已经对应另一条记录");return Map.of("id",old.get("id"),"persisted",true,"duplicate",true); }
            String id=ApiSupport.id();db.update("INSERT INTO xq_activities(id,center_id,plot_id,actor_id,operation,occurred_at,source,client_seq,note) VALUES(?,?,?,?,?,?,'manual',?,?)",id,a.centerId(),plotId,a.accountId(),operation,Timestamp.from(occurred),sequence,note);
            return Map.of("id",id,"persisted",true,"source","manual");
        });
    }
    @GetMapping("/service-requests") public Object requests(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);if(!a.admin()&&!a.permissions().contains("services.request")&&!a.permissions().contains("services.claim")) throw ApiError.forbidden();
        String scope=a.admin()?"":" AND "+(a.permissions().contains("services.claim")?"s.status='open'":"s.subject_id=?");
        Map<String,Object> result=pages.fetch(r,"s.id,s.operation,s.plot_id AS \"plotId\",p.name AS \"plotName\",s.standard_id AS \"standardId\",s.scheduled_date AS \"scheduledDate\",s.standard_text AS \"standardText\",s.status,s.version,s.created_at AS \"createdAt\",s.cancellation_note AS \"cancellationNote\",s.cancelled_at AS \"cancelledAt\",s.requester_id,ac.person_id AS requester_person","FROM xq_service_requests s JOIN xq_plots p ON p.id=s.plot_id AND p.center_id=s.center_id JOIN xq_accounts ac ON ac.id=s.requester_id WHERE s.center_id=?"+scope,"s.created_at DESC,s.id",!a.admin()&&!a.permissions().contains("services.claim")?new Object[]{a.centerId(),a.subjectId()}:new Object[]{a.centerId()});
        for(Object item:(List<?>)result.get("items")) { @SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)item;boolean own=a.personId().equals(row.remove("requester_person")),requester=a.accountId().equals(row.remove("requester_id"));List<String> actions=new ArrayList<>();if("open".equals(row.get("status"))){if(a.permissions().contains("services.claim")&&!own)actions.add("claim");if(a.permissions().contains("services.request")&&requester)actions.add("cancel");}row.put("availableActions",actions); }
        return response(result,r);
    }
    @PostMapping("/service-requests") public Object requestService(@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("services.request");return write(r,b,"service.request",()->{
            String plotId=ApiSupport.text(b,"plotId",64);Map<String,Object> p=plot(a,plotId,false);if(!"verified".equals(p.get("status"))) throw ApiError.conflict("需先核验地块");
            LocalDate date;try { date=LocalDate.parse(ApiSupport.text(b,"scheduledDate",10)); } catch(Exception e) { throw ApiError.invalid("计划日期格式无效"); }
            String standardId=ApiSupport.text(b,"standardId",64);
            List<Map<String,Object>> standards=db.queryForList("SELECT operation,criteria FROM xq_service_standards WHERE id=? AND center_id=?",standardId,a.centerId());
            if(standards.isEmpty()) throw ApiError.missing();Map<String,Object> standard=standards.getFirst();
            String id=ApiSupport.id();db.update("INSERT INTO xq_service_requests(id,center_id,plot_id,requester_id,subject_id,operation,scheduled_date,standard_text,standard_id) VALUES(?,?,?,?,?,?,?,?,?)",id,a.centerId(),plotId,a.accountId(),a.subjectId(),standard.get("operation"),java.sql.Date.valueOf(date),standard.get("criteria"),standardId);return Map.of("id",id,"status","open","version",1);
        });
    }
    @GetMapping("/service-standards") public Object standards(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);
        if(!a.admin()&&!a.permissions().contains("services.request")&&!a.permissions().contains("services.claim")) throw ApiError.forbidden();
        return response(db.queryForList("SELECT id,operation,revision,criteria FROM xq_service_standards WHERE center_id=? ORDER BY operation,revision DESC",a.centerId()),r);
    }
    @PostMapping("/service-requests/{id}/cancel") public Object cancelService(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("services.request");return write(r,b,"service.cancel",()->{
            List<Map<String,Object>> rows=db.queryForList("SELECT status,version FROM xq_service_requests WHERE id=? AND center_id=? AND subject_id=? AND requester_id=? FOR UPDATE",id,a.centerId(),a.subjectId(),a.accountId());
            if(rows.isEmpty())throw ApiError.missing();Map<String,Object> row=rows.getFirst();version(row,r);
            if(!"open".equals(row.get("status")))throw ApiError.conflict("需求已被接单或取消；已接单任务须协商，不允许直接撤销工单");
            db.update("UPDATE xq_service_requests SET status='cancelled',cancellation_note=?,cancelled_at=CURRENT_TIMESTAMP,cancelled_by=?,version=version+1 WHERE id=?",ApiSupport.text(b,"note",2000),a.accountId(),id);
            return Map.of("id",id,"status","cancelled","version",WriteService.version(r)+1,"workOrderCancelled",false);
        });
    }
    @PostMapping("/service-requests/{id}/claim") public Object claim(@PathVariable String id,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);a.require("services.claim");return write(r,b,"service.claim",()->{
            List<Map<String,Object>> found=db.queryForList("SELECT s.*,ac.person_id AS requester_person FROM xq_service_requests s JOIN xq_accounts ac ON ac.id=s.requester_id WHERE s.id=? AND s.center_id=? FOR UPDATE OF s",id,a.centerId());if(found.isEmpty()) throw ApiError.missing();Map<String,Object> req=found.getFirst();version(req,r);
            if(!req.get("status").equals("open")) throw ApiError.conflict("需求已被接单或取消");
            if(a.personId().equals(req.get("requester_person"))) throw ApiError.forbidden();
            String order=ApiSupport.id();db.update("UPDATE xq_service_requests SET status='claimed',version=version+1 WHERE id=?",id);
            db.update("INSERT INTO xq_work_orders(id,center_id,request_id,provider_id,provider_subject_id,provider_person_id) VALUES(?,?,?,?,?,?)",order,a.centerId(),id,a.accountId(),a.subjectId(),a.personId());return Map.of("id",order,"requestId",id,"status","claimed","version",1);
        });
    }
    @GetMapping("/work-orders") public Object orders(HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);if(!a.admin()&&!a.permissions().contains("services.request")&&!a.permissions().contains("services.claim")) throw ApiError.forbidden();
        String where=a.admin()?"":" AND "+(a.permissions().contains("services.claim")?"w.provider_subject_id=?":"s.subject_id=?");
        Map<String,Object> result=pages.fetch(r,"w.id,w.request_id AS \"requestId\",s.operation,s.plot_id AS \"plotId\",p.name AS \"plotName\",s.scheduled_date AS \"scheduledDate\",s.standard_text AS \"standardText\",w.status,w.version,w.completion_note AS \"completionNote\",w.acceptance_note AS \"acceptanceNote\",w.created_at AS \"createdAt\",w.provider_id,w.provider_subject_id,w.provider_person_id,s.subject_id AS requester_subject","FROM xq_work_orders w JOIN xq_service_requests s ON s.id=w.request_id AND s.center_id=w.center_id JOIN xq_plots p ON p.id=s.plot_id AND p.center_id=s.center_id WHERE w.center_id=?"+where,"w.created_at DESC,w.id",a.admin()?new Object[]{a.centerId()}:new Object[]{a.centerId(),a.subjectId()});
        for(Object item:(List<?>)result.get("items")) {
            @SuppressWarnings("unchecked") Map<String,Object> row=(Map<String,Object>)item;
            Object providerAccount=row.remove("provider_id"),providerSubject=row.remove("provider_subject_id"),providerPerson=row.remove("provider_person_id"),requesterSubject=row.remove("requester_subject");
            boolean provider=a.permissions().contains("services.claim")&&a.accountId().equals(providerAccount)&&a.subjectId().equals(providerSubject);
            boolean requester=a.permissions().contains("services.request")&&a.subjectId().equals(requesterSubject)&&!a.personId().equals(providerPerson);
            List<String> actions=new ArrayList<>();String status=String.valueOf(row.get("status"));
            if(provider&&status.equals("claimed"))actions.add("check-in");if(provider&&status.equals("working"))actions.add("submit");if(requester&&status.equals("submitted"))actions.addAll(List.of("accept","dispute"));row.put("availableActions",actions);row.put("qualityCertified",false);
        }
        return response(result,r);
    }
    @PostMapping("/work-orders/{id}/{action}") public Object orderAction(@PathVariable String id,@PathVariable String action,@RequestBody Map<String,Object> b,HttpServletRequest r) {
        AuthService.Actor a=AccessFilter.actor(r);
        if(!Set.of("check-in","submit","accept","dispute").contains(action)) throw ApiError.missing();
        return write(r,b,"order."+action,()->{
            List<Map<String,Object>> found=db.queryForList("SELECT w.*,s.requester_id,s.subject_id AS requester_subject,ac.person_id AS requester_person FROM xq_work_orders w JOIN xq_service_requests s ON s.id=w.request_id JOIN xq_accounts ac ON ac.id=s.requester_id WHERE w.id=? AND w.center_id=? FOR UPDATE OF w",id,a.centerId());if(found.isEmpty()) throw ApiError.missing();Map<String,Object> order=found.getFirst();version(order,r);
            String next;
            if(action.equals("check-in")||action.equals("submit")) {
                a.require("services.claim");if(!a.subjectId().equals(order.get("provider_subject_id")) || !a.accountId().equals(order.get("provider_id"))) throw ApiError.forbidden();
                String required=action.equals("check-in")?"claimed":"working";if(!required.equals(order.get("status"))) throw ApiError.conflict("工单状态不允许此操作");next=action.equals("check-in")?"working":"submitted";
                if(action.equals("submit")) db.update("UPDATE xq_work_orders SET completion_note=? WHERE id=?",ApiSupport.text(b,"note",2000),id);
            } else {
                a.require("services.request");if(!a.subjectId().equals(order.get("requester_subject")) || a.personId().equals(order.get("provider_person_id"))) throw ApiError.forbidden();
                if(!"submitted".equals(order.get("status"))) throw ApiError.conflict("工单尚未提交完工");next=action.equals("accept")?"accepted":"disputed";
                db.update("UPDATE xq_work_orders SET acceptance_note=?,accepted_by=? WHERE id=?",ApiSupport.text(b,"note",2000),a.accountId(),id);
            }
            db.update("UPDATE xq_work_orders SET status=?,version=version+1 WHERE id=?",next,id);
            return Map.of("id",id,"status",next,"version",((Number)order.get("version")).intValue()+1,"qualityCertified",false);
        });
    }
    @GetMapping("/admin/subjects") public Object subjects(HttpServletRequest r) { AuthService.Actor a=AccessFilter.actor(r);a.require("center.manage");return response(db.queryForList("SELECT id,name,kind FROM xq_subjects WHERE center_id=? ORDER BY name",a.centerId()),r); }
    @GetMapping("/admin/audit-logs") public Object logs(HttpServletRequest r) { AuthService.Actor a=AccessFilter.actor(r);a.require("audit.read");return response(db.queryForList("SELECT id,actor_id AS \"actorId\",action,trace_id AS \"traceId\",created_at AS \"createdAt\" FROM xq_audit_logs WHERE center_id=? ORDER BY created_at DESC LIMIT 100",a.centerId()),r); }
}
