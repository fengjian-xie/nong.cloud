package cn.fuan.platform;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** Explicit local-only fixtures. Never runs in a production/default profile. */
@Component @Profile("local")
public class LocalBootstrap implements ApplicationRunner {
    private final JdbcTemplate db; private final AuthService auth; private final TransactionTemplate tx;
    private final boolean enabled; private final String password;
    public LocalBootstrap(JdbcTemplate db,AuthService auth,PlatformTransactionManager manager,@Value("${xq.local-bootstrap}") boolean enabled,@Value("${xq.local-password}") String password) {
        this.db=db;this.auth=auth;tx=new TransactionTemplate(manager);this.enabled=enabled;this.password=password;
    }
    @Override public void run(ApplicationArguments args) {
        if(!enabled) return;
        if(password.length()<12) throw new IllegalStateException("XQ_LOCAL_PASSWORD must contain at least 12 characters");
        tx.executeWithoutResult(status->{
            if(db.queryForObject("SELECT count(*) FROM xq_centers WHERE id='local-fuan'",Integer.class)>0) return;
            db.update("INSERT INTO xq_centers(id,name,county_code) VALUES('local-fuan','福安本地联调中心（测试）','350981'),('local-other','隔离测试中心','000000')");
            db.update("INSERT INTO xq_service_standards(id,center_id,operation,revision,criteria) VALUES('standard-local-001','local-fuan','葡萄巡田',1,'本地测试标准：巡查指定地块，提交巡查范围、发现问题及处理说明；种植户独立确认。不是质量认证。')");
            Map<String,String> roles=new LinkedHashMap<>();
            roles.put("farmer","种植户");roles.put("cooperative","合作社");roles.put("team","农服队");roles.put("machine","农机服务");roles.put("protection","植保队");roles.put("supplier","农资商");roles.put("buyer","采购商");roles.put("warehouse","冷库");roles.put("processor","加工分拣");roles.put("lab","检测机构");roles.put("family","家庭代办");roles.put("consumer","消费者");roles.put("center_admin","中心管理员");roles.put("support","客服坐席");roles.put("content_admin","内容管理员");
            roles.forEach((id,name)->db.update("INSERT INTO xq_roles(id,name) VALUES(?,?) ON CONFLICT DO NOTHING",id,name));
            for(String role:roles.keySet()) permission(role,"help.create","application.create","messages.read");
            for(String role:List.of("farmer","cooperative")) permission(role,"plots.read","plots.write","records.read","records.write","services.request","cards.read","cards.configure","cards.request","cards.loss","cards.upload");
            for(String role:List.of("team","machine","protection")) permission(role,"services.claim","services.read");
            permission("support","help.manage"); permission("content_admin","news.manage");
            permission("center_admin","center.manage","plots.read","plots.write","plots.verify","records.read","records.write","services.read","help.manage","news.manage","identities.manage","cards.read","cards.manage","audit.read");
            account("local-admin","admin.local","本地中心管理员","person-admin");
            account("local-farmer","farmer.local","本地种植户","person-farmer");
            account("local-provider","provider.local","本地农服队","person-provider");
            account("local-outsider","other.local","其他中心测试用户","person-other");
            subject("subject-admin","local-fuan","测试服务中心","center");
            subject("subject-farmer","local-fuan","测试种植户","grower");
            subject("subject-team","local-fuan","测试农服队","provider");
            subject("subject-other","local-other","其他中心种植户","grower");
            identity("identity-admin","local-admin","local-fuan","subject-admin","center_admin");
            identity("identity-farmer","local-farmer","local-fuan","subject-farmer","farmer");
            identity("identity-farmer-team","local-farmer","local-fuan","subject-team","team");
            identity("identity-provider","local-provider","local-fuan","subject-team","team");
            identity("identity-other","local-outsider","local-other","subject-other","farmer");
            db.update("INSERT INTO xq_plots(id,center_id,subject_id,name,area_mu,crop,address,status) VALUES('plot-local-001','local-fuan','subject-farmer','联调葡萄地块',1.5,'葡萄','福安市赛岐镇（测试地址）','verified')");
            db.update("INSERT INTO xq_cards(id,center_id,subject_id,device_uuid,abc_config) VALUES('card-local-001','local-fuan','subject-farmer','unverified-local-device','{\"A\":\"修剪\",\"B\":\"灌溉\",\"C\":\"巡田\"}')");
            db.update("INSERT INTO xq_card_configurations(card_id,version,config) SELECT id,1,abc_config FROM xq_cards WHERE id='card-local-001'");
            db.update("INSERT INTO xq_card_binding_history(card_id,binding_version,center_id,subject_id,status,action,reason) SELECT id,binding_version,center_id,subject_id,status,'local_fixture','本地测试初始绑定，未验证实物' FROM xq_cards WHERE id='card-local-001'");
        });
    }
    private void permission(String role,String... permissions) { for(String p:permissions) db.update("INSERT INTO xq_role_permissions(role_id,permission) VALUES(?,?) ON CONFLICT DO NOTHING",role,p); }
    private void account(String id,String username,String name,String person) { db.update("INSERT INTO xq_people(id) VALUES(?)",person);db.update("INSERT INTO xq_accounts(id,person_id,username,password_hash,display_name) VALUES(?,?,?,?,?)",id,person,username,auth.encode(password),name); }
    private void subject(String id,String center,String name,String kind) { db.update("INSERT INTO xq_subjects(id,center_id,name,kind) VALUES(?,?,?,?)",id,center,name,kind); }
    private void identity(String id,String account,String center,String subject,String role) { db.update("INSERT INTO xq_identities(id,account_id,center_id,subject_id,role_id) VALUES(?,?,?,?,?)",id,account,center,subject,role); }
}
