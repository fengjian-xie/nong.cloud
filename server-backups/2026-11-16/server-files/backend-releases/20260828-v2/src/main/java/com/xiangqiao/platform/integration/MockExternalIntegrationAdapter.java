package com.xiangqiao.platform.integration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import java.util.Map;import java.util.UUID;

@Component
@ConditionalOnProperty(name="app.integration.mode",havingValue="mock",matchIfMissing=true)
public class MockExternalIntegrationAdapter implements ExternalIntegrationAdapter{
 public String provider(){return "MOCK";}
 public AdapterResult submit(String jobType,String subjectType,String subjectId,Map<String,Object> payload){
  return new AdapterResult(true,false,"mock-"+UUID.randomUUID(),"模拟适配器已接收；生产环境需配置正式供应商凭证");
 }
}
