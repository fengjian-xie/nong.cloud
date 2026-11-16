package com.xiangqiao.platform.integration;

import com.fasterxml.jackson.databind.ObjectMapper;import com.xiangqiao.platform.security.*;import jakarta.validation.Valid;
import jakarta.validation.constraints.*;import org.springframework.jdbc.core.simple.JdbcClient;import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;import java.time.Instant;import java.util.*;

@RestController @RequestMapping("/api/v1/integrations")
public class IntegrationController{
 private final JdbcClient jdbc;private final ObjectMapper json;private final List<ExternalIntegrationAdapter> adapters;
 public IntegrationController(JdbcClient jdbc,ObjectMapper json,List<ExternalIntegrationAdapter> adapters){this.jdbc=jdbc;this.json=json;this.adapters=adapters;}
 @PostMapping("/jobs") @Transactional Map<String,Object> submit(@Valid @RequestBody CreateJob r)throws Exception{
  UUID id=UUID.randomUUID();Instant now=Instant.now();String payload=json.writeValueAsString(r.payload());
  jdbc.sql("insert into integration_job(id,county_code,provider,job_type,subject_type,subject_id,status,request_json,created_at,updated_at) values(:id,:county,:provider,:jobType,:subjectType,:subjectId,'SENDING',:request,:now,:now)")
   .param("id",id).param("county",CountyContext.required()).param("provider",r.provider()).param("jobType",r.jobType())
   .param("subjectType",r.subjectType()).param("subjectId",r.subjectId()).param("request",payload).param("now",now).update();
  ExternalIntegrationAdapter adapter=adapters.stream().filter(a->a.provider().equalsIgnoreCase(r.provider())||a.provider().equals("MOCK")).findFirst().orElseThrow();
  var result=adapter.submit(r.jobType(),r.subjectType(),r.subjectId().toString(),r.payload());
  String status=result.success()?"SUCCESS":result.retryable()?"RETRYABLE_FAILED":"MANUAL_REVIEW";
  jdbc.sql("update integration_job set status=:status,response_json=:response,attempt_count=1,updated_at=:now where id=:id and county_code=:county")
   .param("status",status).param("response",json.writeValueAsString(result)).param("now",Instant.now()).param("id",id)
   .param("county",CountyContext.required()).update();
  return jdbc.sql("select * from integration_job where id=:id and county_code=:county").param("id",id).param("county",CountyContext.required()).query().singleRow();
 }
 @GetMapping("/jobs") List<Map<String,Object>> list(){return jdbc.sql("select * from integration_job where county_code=:county order by created_at desc")
  .param("county",CountyContext.required()).query().listOfRows();}
 public record CreateJob(@NotBlank @Pattern(regexp="ONE_PRODUCT_ONE_CODE|ELECTRICITY|WEATHER|AI|MOCK")String provider,
  @NotBlank String jobType,@NotBlank String subjectType,@NotNull UUID subjectId,Map<String,Object> payload){}
}
