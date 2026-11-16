package com.xiangqiao.platform.shared;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public AuditService(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void success(String action, String type, Object id, Map<String, ?> details) {
        try {
            jdbc.sql("""
                    insert into audit_log(id,county_code,actor_user_id,action,resource_type,resource_id,outcome,details_json,created_at)
                    values(:id,:county,:actor,:action,:type,:resource,'SUCCESS',:details,:now)
                    """).param("id", UUID.randomUUID()).param("county", CountyContext.required())
                    .param("actor", CurrentUser.id()).param("action", action).param("type", type)
                    .param("resource", String.valueOf(id)).param("details", json.writeValueAsString(details))
                    .param("now", Instant.now()).update();
        } catch (Exception e) {
            throw new IllegalStateException("审计日志写入失败", e);
        }
    }
}
