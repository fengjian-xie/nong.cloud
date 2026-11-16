package com.xiangqiao.platform.payment;

import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import com.xiangqiao.platform.shared.ApiException;
import com.xiangqiao.platform.shared.AuditService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentService {
    private final JdbcClient jdbc; private final AuditService audit;
    public PaymentService(JdbcClient jdbc,AuditService audit){this.jdbc=jdbc;this.audit=audit;}

    @Transactional
    public Map<String,Object> createWorkOrderPayment(UUID workOrderId){
        var work=jdbc.sql("select * from work_order where id=:id and county_code=:county")
          .param("id",workOrderId).param("county",CountyContext.required()).query().listOfRows().stream().findFirst()
          .orElseThrow(()->ApiException.notFound("工单"));
        if(!CurrentUser.id().equals(work.get("requester_user_id")))throw ApiException.forbidden("只有需求方可以支付工单");
        if(!"PENDING_PAYMENT".equals(work.get("status")))throw ApiException.badRequest("PAYMENT_NOT_ALLOWED","工单当前不可支付");
        var existing=jdbc.sql("select * from payment_order where county_code=:county and business_type='WORK_ORDER' and business_id=:business and status in ('PENDING','PAID')")
          .param("county",CountyContext.required()).param("business",workOrderId).query().listOfRows().stream().findFirst();
        if(existing.isPresent())return existing.get();
        return create("WORK_ORDER",workOrderId,(BigDecimal)work.get("amount"),"{\"version\":1,\"technicalServiceRate\":0}");
    }

    @Transactional
    public Map<String,Object> createCallPayment(UUID callTicketId){return create("PRIVACY_CALL",callTicketId,new BigDecimal("1.00"),"{\"version\":1,\"refundIfNotConnected\":true}");}

    private Map<String,Object> create(String type,UUID businessId,BigDecimal amount,String snapshot){
        UUID id=UUID.randomUUID();Instant now=Instant.now();String county=CountyContext.required();
        jdbc.sql("insert into payment_order(id,county_code,business_type,business_id,amount,fee_rule_snapshot,merchant_route,status,created_at,updated_at) values(:id,:county,:type,:business,:amount,:snapshot,:merchant,'PENDING',:now,:now)")
          .param("id",id).param("county",county).param("type",type).param("business",businessId).param("amount",amount)
          .param("snapshot",snapshot).param("merchant","county-"+county).param("now",now).update();
        audit.success("PAYMENT_ORDER_CREATE","PaymentOrder",id,Map.of("businessType",type,"businessId",businessId));
        return jdbc.sql("select * from payment_order where id=:id and county_code=:county").param("id",id).param("county",county).query().singleRow();
    }

    @Transactional
    public Map<String,Object> mockPaid(String county,UUID paymentId,String providerEventId,String tradeNo){
        int inserted;
        try{inserted=jdbc.sql("insert into webhook_event(id,provider,provider_event_id,county_code,payload,created_at) values(:id,'MOCK_WECHAT',:event,:county,:payload,:now)")
          .param("id",UUID.randomUUID()).param("event",providerEventId).param("county",county).param("payload","{\"paymentId\":\""+paymentId+"\"}")
          .param("now",Instant.now()).update();}catch(org.springframework.dao.DuplicateKeyException e){inserted=0;}
        if(inserted==0)return Map.of("status","DUPLICATE_IGNORED","providerEventId",providerEventId);
        var payment=jdbc.sql("select * from payment_order where id=:id and county_code=:county").param("id",paymentId)
          .param("county",county).query().listOfRows().stream().findFirst().orElseThrow(()->ApiException.notFound("支付单"));
        Instant now=Instant.now();
        jdbc.sql("update payment_order set status='PAID',provider_trade_no=:trade,updated_at=:now where id=:id and county_code=:county and status='PENDING'")
          .param("trade",tradeNo).param("now",now).param("id",paymentId).param("county",county).update();
        if("WORK_ORDER".equals(payment.get("business_type"))){
          jdbc.sql("update work_order set status='RESERVED',version=version+1,updated_at=:now where id=:id and county_code=:county and status='PENDING_PAYMENT'")
            .param("now",now).param("id",payment.get("business_id")).param("county",county).update();
          jdbc.sql("update service_request set status='BOOKED',version=version+1,updated_at=:now where id=(select service_request_id from work_order where id=:work) and county_code=:county")
            .param("now",now).param("work",payment.get("business_id")).param("county",county).update();
        }else if("PRIVACY_CALL".equals(payment.get("business_type"))){
          jdbc.sql("update call_ticket set status='PAID',payment_order_id=:payment,updated_at=:now where id=:id and county_code=:county")
            .param("payment",paymentId).param("now",now).param("id",payment.get("business_id")).param("county",county).update();
        }
        jdbc.sql("update webhook_event set processed_at=:now where provider='MOCK_WECHAT' and provider_event_id=:event")
          .param("now",now).param("event",providerEventId).update();
        return Map.of("status","PAID","paymentId",paymentId);
    }
}
