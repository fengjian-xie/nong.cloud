package com.xiangqiao.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CountyIsolationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcClient jdbc;

    @BeforeEach void secondCounty(){
        jdbc.sql("merge into county_space(code,name,province,city,status,created_at) key(code) values('350902','蕉城区','福建省','宁德市','ACTIVE',current_timestamp)").update();
    }

    @Test void countyTokenCannotCrossBoundary() throws Exception {
        String fa=register("13800000001","350981");
        String jc=register("13800000002","350902");
        String plot="""
          {"name":"测试葡萄园","town":"城阳镇","areaMu":12.6,"cropCategory":"水果","cropVariety":"刺葡萄",
           "maturityStatus":"GROWING","addressLevel":"NEARBY_ONLY"}
          """;
        mvc.perform(post("/api/v1/plots").header("Authorization","Bearer "+fa).header("X-County-Code","350981")
                .contentType("application/json").content(plot)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/plots").header("Authorization","Bearer "+jc).header("X-County-Code","350902"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/v1/plots").header("Authorization","Bearer "+fa).header("X-County-Code","350902"))
                .andExpect(status().isForbidden());
    }

    @Test void publicCannotSelfRegisterAsCountyOperator() throws Exception {
        String body="""
          {"mobile":"13800000003","password":"StrongPass123","displayName":"越权测试","countyCode":"350981","identityType":"COUNTY_OPERATOR"}
          """;
        mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isForbidden());
    }

    @Test void adminLoginPageIsPubliclyReachable() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk());
    }

    private String register(String mobile,String county) throws Exception {
        String body="""
          {"mobile":"%s","password":"StrongPass123","displayName":"测试用户","countyCode":"%s","identityType":"GROWER"}
          """.formatted(mobile,county);
        String response=mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode node=json.readTree(response);return node.get("accessToken").asText();
    }
}
