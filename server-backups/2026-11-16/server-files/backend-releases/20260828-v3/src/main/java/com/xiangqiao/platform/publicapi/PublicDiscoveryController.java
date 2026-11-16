package com.xiangqiao.platform.publicapi;

import jakarta.validation.constraints.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/public/discovery")
public class PublicDiscoveryController {
    private final JdbcClient jdbc;

    public PublicDiscoveryController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/resources")
    List<Map<String, Object>> resources(
            @RequestParam @Pattern(regexp = "\\d{6,12}") String countyCode) {
        return jdbc.sql("""
                select id,resource_type,name,town,capacity_value,capacity_unit,price_amount,price_unit,
                       availability_status,last_verified_at,
                       case when address_level='PUBLIC' then address_text else null end as address_text
                from resource_asset
                where county_code=:county and certification_status='VERIFIED'
                  and availability_status='AVAILABLE'
                order by last_verified_at desc limit 100
                """).param("county", countyCode).query().listOfRows();
    }

    @GetMapping("/supplies")
    List<Map<String, Object>> supplies(
            @RequestParam @Pattern(regexp = "\\d{6,12}") String countyCode) {
        return jdbc.sql("""
                select id,product_name,variety,town,area_mu,maturity_status,harvest_start,harvest_end,
                       quantity,unit,grade,price_amount,last_verified_at
                from supply_listing where county_code=:county and status='PUBLISHED'
                order by last_verified_at desc limit 100
                """).param("county", countyCode).query().listOfRows();
    }

    @GetMapping("/purchases")
    List<Map<String, Object>> purchases(
            @RequestParam @Pattern(regexp = "\\d{6,12}") String countyCode) {
        return jdbc.sql("""
                select id,product_name,variety,target_town,maturity_status,expected_date,quantity,unit,
                       package_requirement,delivery_method,quality_requirement,last_verified_at
                from purchase_request where county_code=:county and status='PUBLISHED'
                order by last_verified_at desc limit 100
                """).param("county", countyCode).query().listOfRows();
    }
}
