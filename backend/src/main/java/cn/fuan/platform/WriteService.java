package cn.fuan.platform;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

@Service
public class WriteService {
    private final JdbcTemplate db; private final TransactionTemplate tx; private final ObjectMapper json;
    public WriteService(JdbcTemplate db,PlatformTransactionManager manager,ObjectMapper json) { this.db=db;tx=new TransactionTemplate(manager);this.json=json.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS); }
    public Object write(HttpServletRequest request,Object payload,String action,Supplier<Object> operation) {
        AuthService.Actor actor=AccessFilter.actor(request);
        String key=request.getHeader("Idempotency-Key");
        if(key==null || !key.matches("[A-Za-z0-9_.:-]{8,128}")) throw ApiError.invalid("写入必须携带8–128字符的Idempotency-Key");
        String hash=AuthService.hash(request.getMethod()+":"+request.getRequestURI()+":"+request.getHeader("If-Match")+":"+serialize(payload));
        return tx.execute(status->{
            db.update("INSERT INTO xq_idempotency(account_id,identity_id,request_key,payload_hash) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",actor.accountId(),actor.identityId(),key,hash);
            Map<String,Object> row=db.queryForMap("SELECT payload_hash,response FROM xq_idempotency WHERE account_id=? AND identity_id=? AND request_key=? FOR UPDATE",actor.accountId(),actor.identityId(),key);
            if(!hash.equals(row.get("payload_hash"))) throw ApiError.conflict("幂等键已用于其他请求");
            if(row.get("response")!=null) return deserialize((String)row.get("response"));
            Object data=ApiSupport.normalize(operation.get());
            db.update("INSERT INTO xq_audit_logs(id,center_id,actor_id,identity_id,action,trace_id) VALUES(?,?,?,?,?,?)",ApiSupport.id(),actor.centerId(),actor.accountId(),actor.identityId(),action,request.getAttribute("traceId"));
            db.update("UPDATE xq_idempotency SET response=? WHERE account_id=? AND identity_id=? AND request_key=?",serialize(data),actor.accountId(),actor.identityId(),key);
            return data;
        });
    }
    public static int version(HttpServletRequest request) {
        try { String value=request.getHeader("If-Match"); if(value==null) throw new NumberFormatException(); int v=Integer.parseInt(value.replace("\"","")); if(v<1) throw new NumberFormatException(); return v; }
        catch(NumberFormatException e) { throw new ApiError(428,"XQ-VERSION-428","修改必须携带对象当前版本If-Match"); }
    }
    public String serialize(Object value) { try { return json.writeValueAsString(value); } catch(Exception e) { throw ApiError.invalid("数据不可序列化"); } }
    public Object deserialize(String value) { try { return json.readValue(value,Object.class); } catch(Exception e) { throw new IllegalStateException("Stored JSON invalid",e); } }
}
