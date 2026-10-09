package cn.fuan.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;

@RestControllerAdvice
public class ApiSupport {
    public static String id() { return UUID.randomUUID().toString(); }
    public static Map<String,Object> envelope(Object data, HttpServletRequest request) {
        return envelope(0,"OK",data,null,request);
    }
    static Map<String,Object> envelope(int code,String message,Object data,String error,HttpServletRequest request) {
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("code",code); result.put("message",message); result.put("data",normalize(data));
        result.put("traceId",request.getAttribute("traceId")); result.put("timestamp",Instant.now().toString());
        if(error!=null) result.put("errorCode",error);
        return result;
    }
    @ExceptionHandler(ApiError.class)
    ResponseEntity<?> failure(ApiError error,HttpServletRequest request) {
        return ResponseEntity.status(error.status).body(envelope(error.status,error.getMessage(),null,error.code,request));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class})
    ResponseEntity<?> badRequest(Exception error,HttpServletRequest request) {
        return ResponseEntity.badRequest().body(envelope(400,"请求格式无效",null,"XQ-VALIDATION-400",request));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> constraint(Exception error,HttpServletRequest request) {
        return ResponseEntity.status(409).body(envelope(409,"数据约束冲突，请刷新后重试",null,"XQ-CONFLICT-409",request));
    }
    @ExceptionHandler({PessimisticLockingFailureException.class, QueryTimeoutException.class})
    ResponseEntity<?> concurrency(Exception error,HttpServletRequest request) {
        return ResponseEntity.status(409).body(envelope(409,"并发操作或锁等待冲突；本次事务未确认，请刷新状态后使用原幂等键重试",null,"XQ-CONCURRENCY-409",request));
    }
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<?> notFound(Exception error,HttpServletRequest request) {
        return ResponseEntity.status(404).body(envelope(404,"接口未实现或不存在",null,"XQ-NOT-FOUND-404",request));
    }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<?> method(Exception error,HttpServletRequest request) {
        return ResponseEntity.status(405).body(envelope(405,"请求方法不支持",null,"XQ-METHOD-405",request));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception error,HttpServletRequest request) {
        return ResponseEntity.internalServerError().body(envelope(500,"服务器暂时无法处理请求",null,"XQ-INTERNAL-500",request));
    }
    public static String text(Map<String,Object> body,String key,int max) {
        Object value=body.get(key);
        if(!(value instanceof String s) || s.isBlank() || s.length()>max) throw ApiError.invalid(key+"不能为空且不能超过"+max+"字");
        return s.trim();
    }
    public static String optional(Map<String,Object> body,String key,int max) {
        if(body.get(key)==null) return "";
        if(!(body.get(key) instanceof String s) || s.length()>max) throw ApiError.invalid(key+"格式无效");
        return s.trim();
    }
    public static BigDecimal positive(Map<String,Object> body,String key) {
        try { BigDecimal value=new BigDecimal(String.valueOf(body.get(key))); if(value.signum()<=0 || value.compareTo(new BigDecimal("1000000"))>0 || value.scale()>4) throw new NumberFormatException(); return value; }
        catch(Exception e) { throw ApiError.invalid(key+"必须为有效正数，最多4位小数"); }
    }
    public static boolean bool(Map<String,Object> body,String key) {
        if(!(body.get(key) instanceof Boolean value)) throw ApiError.invalid(key+"必须为布尔值");
        return value;
    }
    public static Instant instant(Map<String,Object> body,String key) {
        Instant value;
        try { value=Instant.parse(text(body,key,50)); }
        catch(java.time.format.DateTimeParseException e) { throw ApiError.invalid(key+"须为ISO时间"); }
        // PostgreSQL timestamptz stores microseconds. Never silently round evidence.
        if(value.getNano()%1000!=0) throw ApiError.invalid(key+"最多支持6位有效小数（微秒），不能静默改变记录时间");
        return value;
    }
    // One wire format for JDBC values, including idempotency replay responses.
    public static Object normalize(Object value) {
        if(value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant().toString();
        if(value instanceof java.sql.Date date) return date.toLocalDate().toString();
        if(value instanceof Map<?,?> map) {
            Map<String,Object> result=new LinkedHashMap<>();
            map.forEach((key,item)->result.put(String.valueOf(key),normalize(item)));return result;
        }
        if(value instanceof Collection<?> collection) return collection.stream().map(ApiSupport::normalize).toList();
        return value;
    }
    public static Map<String,Object> page(List<?> items,long total,int page,int size) {
        return Map.of("items",items,"total",total,"page",page,"size",size,"hasNext",(long)page*size<total);
    }
}
