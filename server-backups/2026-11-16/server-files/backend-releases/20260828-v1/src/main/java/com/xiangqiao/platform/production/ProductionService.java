package com.xiangqiao.platform.production;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangqiao.platform.security.CountyContext;
import com.xiangqiao.platform.security.CurrentUser;
import com.xiangqiao.platform.shared.ApiException;
import com.xiangqiao.platform.shared.AuditService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProductionService {
    private final JdbcClient jdbc;
    private final ObjectMapper json;
    private final AuditService audit;

    public ProductionService(JdbcClient jdbc, ObjectMapper json, AuditService audit) {
        this.jdbc = jdbc;
        this.json = json;
        this.audit = audit;
    }

    @Transactional
    public Map<String, Object> createPlot(ProductionController.CreatePlot request) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.sql("""
                insert into plot(id,county_code,owner_user_id,name,town,village,area_mu,crop_category,crop_variety,
                  maturity_status,harvest_start,harvest_end,geojson,longitude,latitude,address_level,last_verified_at,created_at,updated_at)
                values(:id,:county,:owner,:name,:town,:village,:area,:category,:variety,:maturity,:start,:end,:geojson,
                  :longitude,:latitude,:addressLevel,:now,:now,:now)
                """).param("id", id).param("county", CountyContext.required()).param("owner", CurrentUser.id())
                .param("name", request.name()).param("town", request.town())
                .param("village", request.village(), Types.VARCHAR).param("area", request.areaMu())
                .param("category", request.cropCategory(), Types.VARCHAR).param("variety", request.cropVariety(), Types.VARCHAR)
                .param("maturity", request.maturityStatus()).param("start", request.harvestStart(), Types.DATE)
                .param("end", request.harvestEnd(), Types.DATE).param("geojson", request.geojson(), Types.VARCHAR)
                .param("longitude", request.longitude(), Types.DECIMAL).param("latitude", request.latitude(), Types.DECIMAL)
                .param("addressLevel", request.addressLevel()).param("now", now).update();
        audit.success("PLOT_CREATE", "Plot", id, Map.of("name", request.name()));
        return getPlot(id);
    }

    public List<Map<String, Object>> listPlots(String town, String variety, String maturity) {
        return jdbc.sql("""
                select id,name,town,village,area_mu,crop_category,crop_variety,maturity_status,harvest_start,harvest_end,
                       longitude,latitude,address_level,last_verified_at,version
                from plot where county_code=:county
                  and (:town is null or town=:town) and (:variety is null or crop_variety=:variety)
                  and (:maturity is null or maturity_status=:maturity)
                order by last_verified_at desc
                """).param("county", CountyContext.required()).param("town", blankToNull(town), Types.VARCHAR)
                .param("variety", blankToNull(variety), Types.VARCHAR).param("maturity", blankToNull(maturity), Types.VARCHAR)
                .query().listOfRows();
    }

    public Map<String, Object> getPlot(UUID id) {
        return jdbc.sql("select * from plot where id=:id and county_code=:county")
                .param("id", id).param("county", CountyContext.required()).query().listOfRows().stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("地块"));
    }

    @Transactional
    public Map<String, Object> addActivity(ProductionController.CreateActivity request) {
        Map<String, Object> plot = getPlot(request.plotId());
        UUID owner = (UUID) plot.get("owner_user_id");
        if (!owner.equals(CurrentUser.id()) && !request.authorizedByOwner()) {
            throw ApiException.forbidden("只有地块所有者或已取得授权的服务人员可以写入农事记录");
        }
        if ("AI_ASSISTED".equals(request.sourceType()) && !request.aiConfirmed()) {
            throw ApiException.badRequest("AI_CONFIRM_REQUIRED", "AI辅助内容必须由用户确认后才能进入正式档案");
        }
        UUID id = UUID.randomUUID();
        try {
            jdbc.sql("""
                    insert into farm_activity(id,county_code,plot_id,activity_type,occurred_at,area_mu,executor_name,equipment,
                      input_name,input_amount,details_json,source_type,source_id,client_serial,ai_confirmed,created_by,created_at)
                    values(:id,:county,:plot,:type,:occurred,:area,:executor,:equipment,:inputName,:inputAmount,:details,
                      :sourceType,:sourceId,:clientSerial,:aiConfirmed,:createdBy,:now)
                    """).param("id", id).param("county", CountyContext.required()).param("plot", request.plotId())
                    .param("type", request.activityType()).param("occurred", request.occurredAt())
                    .param("area", request.areaMu(), Types.DECIMAL).param("executor", request.executorName(), Types.VARCHAR)
                    .param("equipment", request.equipment(), Types.VARCHAR).param("inputName", request.inputName(), Types.VARCHAR)
                    .param("inputAmount", request.inputAmount(), Types.VARCHAR)
                    .param("details", json.writeValueAsString(request.details())).param("sourceType", request.sourceType())
                    .param("sourceId", request.sourceId(), Types.VARCHAR).param("clientSerial", request.clientSerial())
                    .param("aiConfirmed", request.aiConfirmed()).param("createdBy", CurrentUser.id())
                    .param("now", Instant.now()).update();
        } catch (JsonProcessingException e) {
            throw ApiException.badRequest("DETAILS_INVALID", "农事记录扩展数据格式错误");
        } catch (org.springframework.dao.DuplicateKeyException e) {
            return jdbc.sql("select * from farm_activity where county_code=:county and client_serial=:serial")
                    .param("county", CountyContext.required()).param("serial", request.clientSerial()).query().singleRow();
        }
        audit.success("FARM_ACTIVITY_CREATE", "FarmActivity", id, Map.of("plotId", request.plotId()));
        return jdbc.sql("select * from farm_activity where id=:id and county_code=:county")
                .param("id", id).param("county", CountyContext.required()).query().singleRow();
    }

    public List<Map<String, Object>> listActivities(UUID plotId) {
        getPlot(plotId);
        return jdbc.sql("""
                select id,plot_id,activity_type,occurred_at,area_mu,executor_name,equipment,input_name,input_amount,
                       details_json,source_type,source_id,client_serial,ai_confirmed,created_at
                from farm_activity where county_code=:county and plot_id=:plot order by occurred_at desc
                """).param("county", CountyContext.required()).param("plot", plotId).query().listOfRows();
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
}
