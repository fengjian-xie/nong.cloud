package com.xiangqiao.platform.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class BootstrapOperator implements ApplicationRunner {
    private static final Logger log=LoggerFactory.getLogger(BootstrapOperator.class);
    private final AuthService auth;
    private final String mobile,password,county;
    public BootstrapOperator(AuthService auth,
       @Value("${app.bootstrap.operator-mobile:}")String mobile,
       @Value("${app.bootstrap.operator-password:}")String password,
       @Value("${app.bootstrap.county-code:350981}")String county){
      this.auth=auth;this.mobile=mobile;this.password=password;this.county=county;
    }
    @Override public void run(ApplicationArguments args){
      if(mobile==null||mobile.isBlank())return;
      try{
        auth.registerBootstrapOperator(new AuthController.RegisterRequest(mobile,password,"县域运营管理员",county,"COUNTY_OPERATOR","乡桥农业有限公司"));
        log.info("已创建县域运营管理员，请登录后立即更换初始化密码；县域={}",county);
      }catch(Exception e){log.info("未创建初始化管理员（通常表示账号已存在）：{}",e.getMessage());}
    }
}
