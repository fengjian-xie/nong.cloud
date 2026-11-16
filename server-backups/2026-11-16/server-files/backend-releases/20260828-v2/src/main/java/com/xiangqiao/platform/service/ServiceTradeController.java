package com.xiangqiao.platform.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ServiceTradeController {
    private final ServiceTradeService service;
    public ServiceTradeController(ServiceTradeService service){this.service=service;}

    @PostMapping("/service-requests")
    @PreAuthorize("hasAnyRole('GROWER','COUNTY_OPERATOR')")
    Map<String,Object> create(@Valid @RequestBody CreateServiceRequest r){return service.createRequest(r);}
    @GetMapping("/service-requests")
    List<Map<String,Object>> list(@RequestParam(required=false) String type,@RequestParam(required=false) String status){return service.listRequests(type,status);}
    @PostMapping("/service-requests/{id}/quotes")
    @PreAuthorize("hasAnyRole('SERVICE_PROVIDER','COUNTY_OPERATOR')")
    Map<String,Object> quote(@PathVariable UUID id,@Valid @RequestBody CreateQuote r){return service.quote(id,r);}
    @PostMapping("/service-requests/{id}/quotes/{quoteId}/confirm")
    Map<String,Object> confirm(@PathVariable UUID id,@PathVariable UUID quoteId){return service.confirmQuote(id,quoteId);}
    @GetMapping("/work-orders") List<Map<String,Object>> workOrders(){return service.workOrders();}
    @PostMapping("/work-orders/{id}/transitions")
    Map<String,Object> transition(@PathVariable UUID id,@Valid @RequestBody Transition r){return service.transition(id,r);}

    public record CreateServiceRequest(@NotBlank @Pattern(regexp="SOIL_TEST|MIX_MEDICINE|PRUNING|PICKING|PACKAGING|DRONE|MACHINERY") String serviceType,
      UUID plotId,@DecimalMin("0.01") BigDecimal areaMu,Instant expectedStart,Instant expectedEnd,
      @DecimalMin("0") BigDecimal budgetAmount,@Size(max=1000) String description){}
    public record CreateQuote(@NotNull @DecimalMin("0.01") BigDecimal amount,@Size(max=1000) String description){}
    public record Transition(@NotBlank String targetStatus,@PositiveOrZero long expectedVersion){}
}
