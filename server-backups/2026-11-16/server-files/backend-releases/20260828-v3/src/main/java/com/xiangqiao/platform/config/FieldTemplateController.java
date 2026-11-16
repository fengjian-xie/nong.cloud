package com.xiangqiao.platform.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/config/field-templates")
public class FieldTemplateController{
  private final JdbcClient jdbc;private final ObjectMapper json;
  public FieldTemplateController(JdbcClient jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
  @GetMapping List<Map<String,Object>> list(@RequestParam(required=false)String targetType){return jdbc.sql("""
    select * from field_template where county_code=:county and (:type is null or target_type=:type) order by target_type,version desc
    """).param("county",CountyContext.required()).param("type",targetType,Types.VARCHAR).query().listOfRows();}
  @PostMapping @PreAuthorize("hasRole('COUNTY_OPERATOR')") @Transactional
  Map<String,Object> create(@Valid @RequestBody CreateTemplate r)throws Exception{
    UUID id=UUID.randomUUID();
    Integer version=jdbc.sql("select coalesce(max(version),0)+1 from field_template where county_code=:county and target_type=:type")
      .param("county",CountyContext.required()).param("type",r.targetType()).query(Integer.class).single();
    jdbc.sql("insert into field_template(id,county_code,target_type,category_code,version,name,definition_json,created_by,created_at) values(:id,:county,:type,:category,:version,:name,:definition,:user,:now)")
      .param("id",id).param("county",CountyContext.required()).param("type",r.targetType())
      .param("category",r.categoryCode(),Types.VARCHAR).param("version",version).param("name",r.name())
      .param("definition",json.writeValueAsString(r.fields())).param("user",CurrentUser.id()).param("now",OffsetDateTime.now()).update();
    return jdbc.sql("select * from field_template where id=:id and county_code=:county").param("id",id)
      .param("county",CountyContext.required()).query().singleRow();
  }
  public record CreateTemplate(@NotBlank String targetType,String categoryCode,@NotBlank String name,@NotEmpty List<Map<String,Object>> fields){}
}
