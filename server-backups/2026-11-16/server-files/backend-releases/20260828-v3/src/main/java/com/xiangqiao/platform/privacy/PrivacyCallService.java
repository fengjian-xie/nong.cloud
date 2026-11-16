package com.xiangqiao.platform.privacy;

import com.xiangqiao.platform.payment.PaymentService;
import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import com.xiangqiao.platform.shared.ApiException;
import com.xiangqiao.platform.shared.AuditService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@Service
public class PrivacyCallService{
 private final JdbcClient jdbc;private final PaymentService payments;private final AuditService audit;
 public PrivacyCallService(JdbcClient jdbc,PaymentService payments,AuditService audit){this.jdbc=jdbc;this.payments=payments;this.audit=audit;}
 @Transactional public Map<String,Object> create(PrivacyCallController.CreateCall r){
  validateContact(r.contactType(),r.contactId());
  int recent=jdbc.sql("select count(*) from call_ticket where county_code=:county and caller_user_id=:caller and contact_id=:contact and created_at>:since")
    .param("county",CountyContext.required()).param("caller",CurrentUser.id()).param("contact",r.contactId())
    .param("since",OffsetDateTime.now().minus(24,ChronoUnit.HOURS)).query(Integer.class).single();
  UUID id=UUID.randomUUID();OffsetDateTime now=OffsetDateTime.now();boolean freeRepeat=recent>0;
  jdbc.sql("insert into call_ticket(id,county_code,caller_user_id,contact_type,contact_id,fee_amount,status,created_at,updated_at) values(:id,:county,:caller,:type,:contact,:fee,:status,:now,:now)")
    .param("id",id).param("county",CountyContext.required()).param("caller",CurrentUser.id()).param("type",r.contactType())
    .param("contact",r.contactId()).param("fee",freeRepeat?java.math.BigDecimal.ZERO:new java.math.BigDecimal("1.00"))
    .param("status",freeRepeat?"PAID":"PENDING_PAYMENT").param("now",now).update();
  Map<String,Object> payment=freeRepeat?null:payments.createCallPayment(id);
  audit.success("PRIVACY_CALL_CREATE","CallTicket",id,Map.of("freeRepeat",freeRepeat));
  var ticket=jdbc.sql("select * from call_ticket where id=:id and county_code=:county").param("id",id).param("county",CountyContext.required()).query().singleRow();
  return Map.of("ticket",ticket,"payment",payment==null?Map.of():payment);
 }
 private void validateContact(String type,UUID id){
  String table=switch(type){case"SUPPLY"->"supply_listing";case"PURCHASE"->"purchase_request";case"RESOURCE"->"resource_asset";default->throw ApiException.badRequest("CONTACT_TYPE_INVALID","不支持的联系对象");};
  int count=jdbc.sql("select count(*) from "+table+" where id=:id and county_code=:county").param("id",id)
   .param("county",CountyContext.required()).query(Integer.class).single();if(count==0)throw ApiException.notFound("联系对象");
 }
}
