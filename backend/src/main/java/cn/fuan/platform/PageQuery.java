package cn.fuan.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** SQL fragments are controller constants, never supplied by the client. */
@Service
public class PageQuery {
    private final JdbcTemplate db;
    private final TransactionTemplate read;
    public PageQuery(JdbcTemplate db,PlatformTransactionManager manager) {
        this.db=db;read=new TransactionTemplate(manager);read.setReadOnly(true);
        read.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }
    private int number(HttpServletRequest request,String name,int fallback,int max) {
        String value=request.getParameter(name);if(value==null)return fallback;
        try {int n=Integer.parseInt(value);if(n<1||n>max)throw new NumberFormatException();return n;}
        catch(NumberFormatException e){throw ApiError.invalid(name+"须为1–"+max+"的整数");}
    }
    public Map<String,Object> fetch(HttpServletRequest r,String columns,String fromWhere,String order,Object... arguments) {
        int page=number(r,"page",1,100000),size=number(r,"size",20,100);
        return read.execute(status->{
            long total=db.queryForObject("SELECT count(*) "+fromWhere,Long.class,arguments);
            List<Object> parameters=new ArrayList<>(Arrays.asList(arguments));parameters.add(size);parameters.add((page-1)*size);
            return ApiSupport.page(db.queryForList("SELECT "+columns+" "+fromWhere+" ORDER BY "+order+" LIMIT ? OFFSET ?",parameters.toArray()),total,page,size);
        });
    }
}
