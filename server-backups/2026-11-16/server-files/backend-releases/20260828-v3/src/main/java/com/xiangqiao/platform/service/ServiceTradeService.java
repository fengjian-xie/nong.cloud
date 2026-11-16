package com.xiangqiao.platform.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import com.xiangqiao.platform.shared.ApiException;
import com.xiangqiao.platform.shared.AuditService;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ServiceTradeService {
    private final JdbcClient jdbc;
    private final AuditService audit;
    private final ObjectMapper json;

    public ServiceTradeService(JdbcClient jdbc, AuditService audit, ObjectMapper json) {
        this.jdbc = jdbc; this.audit = audit; this.json = json;
    }

    @Transactional
    public Map<String,Object> createRequest(ServiceTradeController.CreateServiceRequest r) {
        UUID id=UUID.randomUUID(); OffsetDateTime now=OffsetDateTime.now();
        if(r.plotId()!=null) {
            boolean plot=jdbc.sql("select count(*) from plot where id=:id and county_code=:county and owner_user_id=:owner")
                    .param("id",r.plotId()).param("county",CountyContext.required()).param("owner",CurrentUser.id())
                    .query(Integer.class).single()>0;
            if(!plot) throw ApiException.notFound("地块");
        }
        jdbc.sql("""
          insert into service_request(id,county_code,requester_user_id,plot_id,service_type,area_mu,expected_start,
            expected_end,budget_amount,description,status,last_verified_at,created_at,updated_at)
          values(:id,:county,:user,:plot,:type,:area,:start,:end,:budget,:description,'PENDING_MATCH',:now,:now,:now)
          """).param("id",id).param("county",CountyContext.required()).param("user",CurrentUser.id())
          .param("plot",r.plotId(),Types.OTHER).param("type",r.serviceType()).param("area",r.areaMu(),Types.DECIMAL)
          .param("start",r.expectedStart(),Types.TIMESTAMP_WITH_TIMEZONE).param("end",r.expectedEnd(),Types.TIMESTAMP_WITH_TIMEZONE)
          .param("budget",r.budgetAmount(),Types.DECIMAL).param("description",r.description(),Types.VARCHAR)
          .param("now",now).update();
        outbox("ServiceRequest",id,"SERVICE_REQUEST_CREATED",Map.of("serviceType",r.serviceType()));
        audit.success("SERVICE_REQUEST_CREATE","ServiceRequest",id,Map.of("serviceType",r.serviceType()));
        return request(id);
    }

    public List<Map<String,Object>> listRequests(String type,String status) {
        return jdbc.sql("""
          select id,requester_user_id,plot_id,service_type,area_mu,expected_start,expected_end,budget_amount,description,
                 status,last_verified_at,version,created_at
          from service_request where county_code=:county and (:type is null or service_type=:type)
            and (:status is null or status=:status) order by last_verified_at desc
          """).param("county",CountyContext.required()).param("type",blank(type),Types.VARCHAR)
          .param("status",blank(status),Types.VARCHAR).query().listOfRows();
    }

    @Transactional
    public Map<String,Object> quote(UUID requestId, ServiceTradeController.CreateQuote r) {
        var request=request(requestId);
        String status=String.valueOf(request.get("status"));
        if(!List.of("PENDING_MATCH","QUOTING").contains(status))
            throw ApiException.badRequest("REQUEST_NOT_QUOTABLE","当前需求不可报价");
        UUID id=UUID.randomUUID(); OffsetDateTime now=OffsetDateTime.now();
        jdbc.sql("""
          insert into quote(id,county_code,service_request_id,provider_user_id,amount,description,status,created_at,updated_at)
          values(:id,:county,:request,:provider,:amount,:description,'PENDING',:now,:now)
          """).param("id",id).param("county",CountyContext.required()).param("request",requestId)
          .param("provider",CurrentUser.id()).param("amount",r.amount()).param("description",r.description(),Types.VARCHAR)
          .param("now",now).update();
        jdbc.sql("update service_request set status='QUOTING',version=version+1,updated_at=:now where id=:id and county_code=:county")
          .param("now",now).param("id",requestId).param("county",CountyContext.required()).update();
        audit.success("QUOTE_CREATE","Quote",id,Map.of("requestId",requestId));
        return jdbc.sql("select * from quote where id=:id and county_code=:county").param("id",id)
          .param("county",CountyContext.required()).query().singleRow();
    }

    @Transactional
    public Map<String,Object> confirmQuote(UUID requestId,UUID quoteId) {
        var request=request(requestId);
        if(!CurrentUser.id().equals(request.get("requester_user_id"))) throw ApiException.forbidden("只有需求发布人可以确认报价");
        var quote=jdbc.sql("select * from quote where id=:id and service_request_id=:request and county_code=:county and status='PENDING'")
          .param("id",quoteId).param("request",requestId).param("county",CountyContext.required()).query().listOfRows().stream().findFirst()
          .orElseThrow(()->ApiException.notFound("报价"));
        OffsetDateTime now=OffsetDateTime.now(); UUID workOrderId=UUID.randomUUID();
        jdbc.sql("update quote set status=case when id=:quote then 'ACCEPTED' else 'REJECTED' end,version=version+1,updated_at=:now where service_request_id=:request and county_code=:county")
          .param("quote",quoteId).param("now",now).param("request",requestId).param("county",CountyContext.required()).update();
        jdbc.sql("update service_request set status='PENDING_PAYMENT',version=version+1,updated_at=:now where id=:id and county_code=:county")
          .param("now",now).param("id",requestId).param("county",CountyContext.required()).update();
        jdbc.sql("""
          insert into work_order(id,county_code,service_request_id,quote_id,requester_user_id,provider_user_id,amount,status,created_at,updated_at)
          values(:id,:county,:request,:quote,:requester,:provider,:amount,'PENDING_PAYMENT',:now,:now)
          """).param("id",workOrderId).param("county",CountyContext.required()).param("request",requestId)
          .param("quote",quoteId).param("requester",CurrentUser.id()).param("provider",quote.get("provider_user_id"))
          .param("amount",quote.get("amount")).param("now",now).update();
        outbox("WorkOrder",workOrderId,"WORK_ORDER_CREATED",Map.of("serviceRequestId",requestId));
        audit.success("QUOTE_ACCEPT","WorkOrder",workOrderId,Map.of("quoteId",quoteId));
        return workOrder(workOrderId);
    }

    @Transactional
    public Map<String,Object> transition(UUID id,ServiceTradeController.Transition request) {
        var work=workOrder(id); String from=String.valueOf(work.get("status"));
        UUID requester=(UUID)work.get("requester_user_id"), provider=(UUID)work.get("provider_user_id");
        if(!CurrentUser.id().equals(requester)&&!CurrentUser.id().equals(provider)) throw ApiException.forbidden("只有工单参与方可以操作");
        WorkOrderStateMachine.verify(from,request.targetStatus());
        OffsetDateTime now=OffsetDateTime.now();
        int changed=jdbc.sql("""
          update work_order set status=:target,version=version+1,updated_at=:now,
            checked_in_at=case when :target='IN_SERVICE' then :now else checked_in_at end,
            completed_at=case when :target='COMPLETED' then :now else completed_at end
          where id=:id and county_code=:county and version=:version
          """).param("target",request.targetStatus()).param("now",now).param("id",id)
          .param("county",CountyContext.required()).param("version",request.expectedVersion()).update();
        if(changed!=1) throw new OptimisticLockingFailureException("工单已被其他用户更新，请刷新后重试");
        jdbc.sql("update service_request set status=:status,version=version+1,updated_at=:now where id=:id and county_code=:county")
          .param("status",requestStatus(request.targetStatus())).param("now",now)
          .param("id",work.get("service_request_id")).param("county",CountyContext.required()).update();
        if("COMPLETED".equals(request.targetStatus())) createActivityFromWorkOrder(work,now);
        outbox("WorkOrder",id,"WORK_ORDER_STATUS_CHANGED",Map.of("from",from,"to",request.targetStatus()));
        audit.success("WORK_ORDER_TRANSITION","WorkOrder",id,Map.of("from",from,"to",request.targetStatus()));
        return workOrder(id);
    }

    public List<Map<String,Object>> workOrders() {
        return jdbc.sql("""
          select * from work_order where county_code=:county and (requester_user_id=:user or provider_user_id=:user)
          order by updated_at desc
          """).param("county",CountyContext.required()).param("user",CurrentUser.id()).query().listOfRows();
    }

    Map<String,Object> request(UUID id){return jdbc.sql("select * from service_request where id=:id and county_code=:county")
      .param("id",id).param("county",CountyContext.required()).query().listOfRows().stream().findFirst().orElseThrow(()->ApiException.notFound("农事需求"));}
    Map<String,Object> workOrder(UUID id){return jdbc.sql("select * from work_order where id=:id and county_code=:county")
      .param("id",id).param("county",CountyContext.required()).query().listOfRows().stream().findFirst().orElseThrow(()->ApiException.notFound("工单"));}

    private void createActivityFromWorkOrder(Map<String,Object> work,OffsetDateTime now){
        var req=request((UUID)work.get("service_request_id")); if(req.get("plot_id")==null)return;
        String serial="work-order-"+work.get("id");
        jdbc.sql("""
          insert into farm_activity(id,county_code,plot_id,activity_type,occurred_at,area_mu,executor_name,details_json,
            source_type,source_id,client_serial,ai_confirmed,created_by,created_at)
          values(:id,:county,:plot,:type,:now,:area,'服务团队',:details,'WORK_ORDER',:source,:serial,false,:createdBy,:now)
          """).param("id",UUID.randomUUID()).param("county",CountyContext.required()).param("plot",req.get("plot_id"))
          .param("type",req.get("service_type")).param("now",now).param("area",req.get("area_mu"),Types.DECIMAL)
          .param("details","{\"autoGenerated\":true}").param("source",String.valueOf(work.get("id")))
          .param("serial",serial).param("createdBy",CurrentUser.id()).update();
    }
    private String requestStatus(String workStatus){return switch(workStatus){case"RESERVED"->"BOOKED";case"WAITING_ARRIVAL"->"WAITING_ARRIVAL";case"IN_SERVICE"->"IN_SERVICE";case"PENDING_ACCEPTANCE"->"PENDING_ACCEPTANCE";case"COMPLETED"->"COMPLETED";case"CANCELLED"->"CANCELLED";case"REFUNDING"->"REFUNDING";case"DISPUTED"->"DISPUTED";default->workStatus;};}
    private void outbox(String aggregate,UUID id,String type,Map<String,Object> payload){
        try{jdbc.sql("insert into outbox_event(id,county_code,aggregate_type,aggregate_id,event_type,payload,created_at) values(:id,:county,:aggregate,:aggregateId,:type,:payload,:now)")
          .param("id",UUID.randomUUID()).param("county",CountyContext.required()).param("aggregate",aggregate)
          .param("aggregateId",id.toString()).param("type",type).param("payload",json.writeValueAsString(payload)).param("now",OffsetDateTime.now()).update();}
        catch(Exception e){throw new IllegalStateException("事务事件写入失败",e);}
    }
    private static String blank(String v){return v==null||v.isBlank()?null:v;}
}
