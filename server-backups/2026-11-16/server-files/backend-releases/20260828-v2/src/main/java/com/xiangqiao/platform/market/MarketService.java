package com.xiangqiao.platform.market;

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
public class MarketService {
    private final JdbcClient jdbc; private final ObjectMapper json; private final AuditService audit;
    public MarketService(JdbcClient jdbc,ObjectMapper json,AuditService audit){this.jdbc=jdbc;this.json=json;this.audit=audit;}

    @Transactional
    public Map<String,Object> createSupply(MarketController.CreateSupply r) throws Exception{
        UUID id=UUID.randomUUID();OffsetDateTime now=OffsetDateTime.now();
        jdbc.sql("""
          insert into supply_listing(id,county_code,seller_user_id,plot_id,product_name,variety,town,area_mu,maturity_status,
            harvest_start,harvest_end,quantity,unit,grade,price_amount,attributes_json,last_verified_at,created_at,updated_at)
          values(:id,:county,:seller,:plot,:product,:variety,:town,:area,:maturity,:start,:end,:quantity,:unit,:grade,
            :price,:attributes,:now,:now,:now)
          """).param("id",id).param("county",CountyContext.required()).param("seller",CurrentUser.id())
          .param("plot",r.plotId(),Types.OTHER).param("product",r.productName()).param("variety",r.variety(),Types.VARCHAR)
          .param("town",r.town()).param("area",r.areaMu(),Types.DECIMAL).param("maturity",r.maturityStatus())
          .param("start",r.harvestStart(),Types.DATE).param("end",r.harvestEnd(),Types.DATE).param("quantity",r.quantity())
          .param("unit",r.unit()).param("grade",r.grade(),Types.VARCHAR).param("price",r.priceAmount(),Types.DECIMAL)
          .param("attributes",json.writeValueAsString(r.attributes())).param("now",now).update();
        audit.success("SUPPLY_CREATE","SupplyListing",id,Map.of("product",r.productName()));
        return jdbc.sql("select * from supply_listing where id=:id and county_code=:county").param("id",id)
          .param("county",CountyContext.required()).query().singleRow();
    }

    public List<Map<String,Object>> supplies(String town,String variety,String maturity,java.math.BigDecimal minArea){
        return jdbc.sql("""
          select id,seller_user_id,product_name,variety,town,area_mu,maturity_status,harvest_start,harvest_end,
                 quantity,unit,grade,price_amount,status,last_verified_at,attributes_json
          from supply_listing where county_code=:county and (:town is null or town=:town)
            and (:variety is null or variety=:variety) and (:maturity is null or maturity_status=:maturity)
            and (:minArea is null or area_mu>=:minArea)
          order by last_verified_at desc
          """).param("county",CountyContext.required()).param("town",blank(town),Types.VARCHAR)
          .param("variety",blank(variety),Types.VARCHAR).param("maturity",blank(maturity),Types.VARCHAR)
          .param("minArea",minArea,Types.DECIMAL).query().listOfRows();
    }

    @Transactional
    public Map<String,Object> createPurchase(MarketController.CreatePurchase r){
        UUID id=UUID.randomUUID();OffsetDateTime now=OffsetDateTime.now();
        jdbc.sql("""
          insert into purchase_request(id,county_code,buyer_user_id,product_name,variety,target_town,maturity_status,
            expected_date,quantity,unit,package_requirement,delivery_method,quality_requirement,last_verified_at,created_at,updated_at)
          values(:id,:county,:buyer,:product,:variety,:town,:maturity,:date,:quantity,:unit,:package,:delivery,:quality,:now,:now,:now)
          """).param("id",id).param("county",CountyContext.required()).param("buyer",CurrentUser.id())
          .param("product",r.productName()).param("variety",r.variety(),Types.VARCHAR).param("town",r.targetTown(),Types.VARCHAR)
          .param("maturity",r.maturityStatus(),Types.VARCHAR).param("date",r.expectedDate(),Types.DATE)
          .param("quantity",r.quantity()).param("unit",r.unit()).param("package",r.packageRequirement(),Types.VARCHAR)
          .param("delivery",r.deliveryMethod(),Types.VARCHAR).param("quality",r.qualityRequirement(),Types.VARCHAR)
          .param("now",now).update();
        audit.success("PURCHASE_CREATE","PurchaseRequest",id,Map.of("product",r.productName()));
        return jdbc.sql("select * from purchase_request where id=:id and county_code=:county").param("id",id)
          .param("county",CountyContext.required()).query().singleRow();
    }

    public List<Map<String,Object>> purchases(String product,String variety,String status){
        return jdbc.sql("""
          select * from purchase_request where county_code=:county and (:product is null or product_name=:product)
            and (:variety is null or variety=:variety) and (:status is null or status=:status)
          order by last_verified_at desc
          """).param("county",CountyContext.required()).param("product",blank(product),Types.VARCHAR)
          .param("variety",blank(variety),Types.VARCHAR).param("status",blank(status),Types.VARCHAR).query().listOfRows();
    }
    private static String blank(String v){return v==null||v.isBlank()?null:v;}
}
