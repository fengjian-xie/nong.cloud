package com.xiangqiao.platform.resource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import com.xiangqiao.platform.shared.AuditService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ResourceService {
    private final JdbcClient jdbc;
    private final ObjectMapper json;
    private final AuditService audit;
    public ResourceService(JdbcClient jdbc, ObjectMapper json, AuditService audit) {
        this.jdbc = jdbc; this.json = json; this.audit = audit;
    }

    @Transactional
    public Map<String,Object> create(ResourceController.CreateResource r) throws Exception {
        UUID id=UUID.randomUUID(); OffsetDateTime now=OffsetDateTime.now();
        jdbc.sql("""
          insert into resource_asset(id,county_code,owner_user_id,resource_type,name,town,capacity_value,capacity_unit,
            price_amount,price_unit,longitude,latitude,address_text,address_level,attributes_json,last_verified_at,created_at,updated_at)
          values(:id,:county,:owner,:type,:name,:town,:capacity,:capacityUnit,:price,:priceUnit,:lng,:lat,:address,
            :addressLevel,:attributes,:now,:now,:now)
          """).param("id",id).param("county",CountyContext.required()).param("owner",CurrentUser.id())
          .param("type",r.resourceType()).param("name",r.name()).param("town",r.town())
          .param("capacity",r.capacityValue(),Types.DECIMAL).param("capacityUnit",r.capacityUnit(),Types.VARCHAR)
          .param("price",r.priceAmount(),Types.DECIMAL).param("priceUnit",r.priceUnit(),Types.VARCHAR)
          .param("lng",r.longitude(),Types.DECIMAL).param("lat",r.latitude(),Types.DECIMAL)
          .param("address",r.addressText(),Types.VARCHAR).param("addressLevel",r.addressLevel())
          .param("attributes",json.writeValueAsString(r.attributes())).param("now",now).update();
        audit.success("RESOURCE_CREATE","ResourceAsset",id,Map.of("type",r.resourceType()));
        return jdbc.sql("select * from resource_asset where id=:id and county_code=:county")
          .param("id",id).param("county",CountyContext.required()).query().singleRow();
    }

    public List<Map<String,Object>> list(String type,String town,String availability) {
        return jdbc.sql("""
          select id,resource_type,name,town,capacity_value,capacity_unit,price_amount,price_unit,longitude,latitude,
                 case when address_level='PUBLIC' then address_text else null end as address_text,
                 address_level,certification_status,availability_status,last_verified_at,attributes_json
          from resource_asset where county_code=:county
            and (:type is null or resource_type=:type) and (:town is null or town=:town)
            and (:availability is null or availability_status=:availability)
          order by last_verified_at desc
          """).param("county",CountyContext.required()).param("type",blank(type),Types.VARCHAR)
          .param("town",blank(town),Types.VARCHAR).param("availability",blank(availability),Types.VARCHAR)
          .query().listOfRows();
    }
    private static String blank(String v){return v==null||v.isBlank()?null:v;}
}
