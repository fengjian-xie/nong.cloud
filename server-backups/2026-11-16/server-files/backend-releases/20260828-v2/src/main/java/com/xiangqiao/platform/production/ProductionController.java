package com.xiangqiao.platform.production;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ProductionController {
    private final ProductionService service;
    public ProductionController(ProductionService service) { this.service = service; }

    @PostMapping("/plots")
    @PreAuthorize("hasAnyRole('GROWER','COUNTY_OPERATOR')")
    Map<String, Object> createPlot(@Valid @RequestBody CreatePlot request) { return service.createPlot(request); }

    @GetMapping("/plots")
    List<Map<String, Object>> plots(@RequestParam(required = false) String town,
                                   @RequestParam(required = false) String variety,
                                   @RequestParam(required = false) String maturity) {
        return service.listPlots(town, variety, maturity);
    }

    @GetMapping("/plots/{id}")
    Map<String, Object> plot(@PathVariable UUID id) { return service.getPlot(id); }

    @PostMapping("/farm-activities")
    @PreAuthorize("hasAnyRole('GROWER','SERVICE_PROVIDER','AGRONOMIST','COUNTY_OPERATOR')")
    Map<String, Object> addActivity(@Valid @RequestBody CreateActivity request) { return service.addActivity(request); }

    @GetMapping("/plots/{plotId}/farm-activities")
    List<Map<String, Object>> activities(@PathVariable UUID plotId) { return service.listActivities(plotId); }

    public record CreatePlot(
            @NotBlank @Size(max=200) String name,
            @NotBlank @Size(max=100) String town,
            @Size(max=100) String village,
            @NotNull @DecimalMin("0.01") BigDecimal areaMu,
            @Size(max=100) String cropCategory,
            @Size(max=100) String cropVariety,
            @NotBlank @Pattern(regexp="GROWING|NEAR_MATURE|HARVESTABLE|OVERDUE_RISK|LOCKED|IDLE") String maturityStatus,
            LocalDate harvestStart,
            LocalDate harvestEnd,
            String geojson,
            BigDecimal longitude,
            BigDecimal latitude,
            @NotBlank @Pattern(regexp="PUBLIC|AFTER_DEAL|AFTER_ACCEPT|NEARBY_ONLY") String addressLevel) {}

    public record CreateActivity(
            @NotNull UUID plotId,
            @NotBlank @Size(max=60) String activityType,
            @NotNull Instant occurredAt,
            @DecimalMin("0.01") BigDecimal areaMu,
            @Size(max=100) String executorName,
            @Size(max=200) String equipment,
            @Size(max=200) String inputName,
            @Size(max=100) String inputAmount,
            Map<String, Object> details,
            @NotBlank @Pattern(regexp="MANUAL|WORK_ORDER|DEVICE|EXTERNAL|AI_ASSISTED") String sourceType,
            @Size(max=100) String sourceId,
            @NotBlank @Size(max=100) String clientSerial,
            boolean aiConfirmed,
            boolean authorizedByOwner) {}
}
