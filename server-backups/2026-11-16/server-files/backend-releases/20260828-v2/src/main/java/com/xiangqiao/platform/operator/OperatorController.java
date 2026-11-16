package com.xiangqiao.platform.operator;

import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import com.xiangqiao.platform.shared.ApiException;
import com.xiangqiao.platform.shared.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/operator")
@PreAuthorize("hasRole('COUNTY_OPERATOR')")
public class OperatorController {
    private final JdbcClient jdbc;
    private final AuditService audit;

    public OperatorController(JdbcClient jdbc, AuditService audit) { this.jdbc = jdbc; this.audit = audit; }

    @GetMapping("/dashboard")
    Map<String,Object> dashboard() {
        String county=CountyContext.required();
        var result=new LinkedHashMap<String,Object>();
        result.put("pendingMemberships", count("county_membership", "certification_status='PENDING'"));
        result.put("plots", count("plot", "1=1"));
        result.put("resources", count("resource_asset", "1=1"));
        result.put("pendingResources", count("resource_asset", "certification_status='PENDING'"));
        result.put("openServiceRequests", count("service_request", "status not in ('COMPLETED','CANCELLED','CLOSED')"));
        result.put("activeWorkOrders", count("work_order", "status not in ('COMPLETED','CANCELLED','CLOSED')"));
        result.put("pendingSupplies", count("supply_listing", "status='PENDING_REVIEW'"));
        result.put("pendingPurchases", count("purchase_request", "status='PENDING_REVIEW'"));
        result.put("failedSyncJobs", count("integration_job", "status in ('RETRYABLE_FAILED','MANUAL_REVIEW')"));
        result.put("countyCode",county);
        return result;
    }

    @GetMapping("/memberships")
    List<Map<String,Object>> memberships(@RequestParam(required=false) String status) {
        return jdbc.sql("""
          select m.id,m.user_id,u.display_name,m.identity_type,m.role_code,m.certification_status,m.organization_name,m.created_at
          from county_membership m join user_account u on u.id=m.user_id
          where m.county_code=:county and (:status is null or m.certification_status=:status) order by m.created_at desc
          """).param("county",CountyContext.required()).param("status",status,java.sql.Types.VARCHAR).query().listOfRows();
    }

    @PostMapping("/memberships/{id}/decision")
    @Transactional
    Map<String,Object> decideMembership(@PathVariable UUID id,@Valid @RequestBody Decision request) {
        if(!Set.of("VERIFIED","REJECTED","SUSPENDED").contains(request.status()))
            throw ApiException.badRequest("DECISION_INVALID","不支持的审核结论");
        int changed=jdbc.sql("update county_membership set certification_status=:status,updated_at=:now where id=:id and county_code=:county")
          .param("status",request.status()).param("now",OffsetDateTime.now()).param("id",id).param("county",CountyContext.required()).update();
        if(changed!=1)throw ApiException.notFound("入驻申请");
        audit.success("MEMBERSHIP_DECISION","CountyMembership",id,Map.of("status",request.status(),"reason",request.reason()==null?"":request.reason()));
        return jdbc.sql("select * from county_membership where id=:id and county_code=:county").param("id",id)
          .param("county",CountyContext.required()).query().singleRow();
    }

    @PostMapping("/{resourceType}/{id}/decision")
    @Transactional
    Map<String,Object> decideContent(@PathVariable String resourceType,@PathVariable UUID id,@Valid @RequestBody Decision request) {
        var spec=switch(resourceType){
            case "resources" -> new DecisionSpec("resource_asset","certification_status",Set.of("VERIFIED","REJECTED","SUSPENDED"));
            case "supplies" -> new DecisionSpec("supply_listing","status",Set.of("PUBLISHED","REJECTED","OFF_SHELF"));
            case "purchases" -> new DecisionSpec("purchase_request","status",Set.of("PUBLISHED","REJECTED","OFF_SHELF"));
            default -> throw ApiException.badRequest("RESOURCE_TYPE_INVALID","不支持的审核对象");
        };
        if(!spec.allowed().contains(request.status()))throw ApiException.badRequest("DECISION_INVALID","不支持的审核结论");
        int changed=jdbc.sql("update "+spec.table()+" set "+spec.statusColumn()+"=:status,last_verified_at=:now,updated_at=:now,version=version+1 where id=:id and county_code=:county")
          .param("status",request.status()).param("now",OffsetDateTime.now()).param("id",id).param("county",CountyContext.required()).update();
        if(changed!=1)throw ApiException.notFound("审核对象");
        audit.success("CONTENT_DECISION",resourceType,id,Map.of("status",request.status(),"reason",request.reason()==null?"":request.reason()));
        return jdbc.sql("select * from "+spec.table()+" where id=:id and county_code=:county").param("id",id)
          .param("county",CountyContext.required()).query().singleRow();
    }

    @GetMapping("/audit-logs")
    List<Map<String,Object>> auditLogs(){return jdbc.sql("select * from audit_log where county_code=:county order by created_at desc limit 200")
      .param("county",CountyContext.required()).query().listOfRows();}

    private int count(String table,String condition){return jdbc.sql("select count(*) from "+table+" where county_code=:county and "+condition)
      .param("county",CountyContext.required()).query(Integer.class).single();}
    public record Decision(@NotBlank String status,String reason){}
    private record DecisionSpec(String table,String statusColumn,Set<String> allowed){}
}
