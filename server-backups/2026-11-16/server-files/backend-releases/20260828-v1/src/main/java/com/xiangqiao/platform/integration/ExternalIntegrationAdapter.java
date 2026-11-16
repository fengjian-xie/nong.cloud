package com.xiangqiao.platform.integration;

import java.util.Map;

public interface ExternalIntegrationAdapter {
    String provider();
    AdapterResult submit(String jobType,String subjectType,String subjectId,Map<String,Object> payload);
    record AdapterResult(boolean success,boolean retryable,String externalId,String message){}
}
