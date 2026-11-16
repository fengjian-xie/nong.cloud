package com.xiangqiao.platform.market;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/market")
public class MarketController{
  private final MarketService service; public MarketController(MarketService service){this.service=service;}
  @PostMapping("/supplies") @PreAuthorize("hasAnyRole('GROWER','BROKER','COUNTY_OPERATOR')")
  Map<String,Object> supply(@Valid @RequestBody CreateSupply r)throws Exception{return service.createSupply(r);}
  @GetMapping("/supplies") List<Map<String,Object>> supplies(@RequestParam(required=false)String town,
    @RequestParam(required=false)String variety,@RequestParam(required=false)String maturity,
    @RequestParam(required=false)BigDecimal minArea){return service.supplies(town,variety,maturity,minArea);}
  @PostMapping("/purchases") @PreAuthorize("hasAnyRole('BUYER','BROKER','COUNTY_OPERATOR')")
  Map<String,Object> purchase(@Valid @RequestBody CreatePurchase r){return service.createPurchase(r);}
  @GetMapping("/purchases") List<Map<String,Object>> purchases(@RequestParam(required=false)String product,
    @RequestParam(required=false)String variety,@RequestParam(required=false)String status){return service.purchases(product,variety,status);}

  public record CreateSupply(UUID plotId,@NotBlank @Size(max=150)String productName,@Size(max=100)String variety,
    @NotBlank @Size(max=100)String town,@DecimalMin("0.01")BigDecimal areaMu,
    @NotBlank @Pattern(regexp="GROWING|NEAR_MATURE|HARVESTABLE|OVERDUE_RISK|LOCKED")String maturityStatus,
    LocalDate harvestStart,LocalDate harvestEnd,@NotNull @DecimalMin("0.01")BigDecimal quantity,
    @NotBlank @Size(max=30)String unit,@Size(max=50)String grade,@DecimalMin("0")BigDecimal priceAmount,
    Map<String,Object> attributes){}
  public record CreatePurchase(@NotBlank @Size(max=150)String productName,@Size(max=100)String variety,
    @Size(max=100)String targetTown,@Size(max=30)String maturityStatus,LocalDate expectedDate,
    @NotNull @DecimalMin("0.01")BigDecimal quantity,@NotBlank @Size(max=30)String unit,
    @Size(max=300)String packageRequirement,@Size(max=100)String deliveryMethod,@Size(max=500)String qualityRequirement){}
}
