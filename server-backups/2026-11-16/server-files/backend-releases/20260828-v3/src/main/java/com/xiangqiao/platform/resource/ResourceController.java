package com.xiangqiao.platform.resource;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/resources")
public class ResourceController {
    private final ResourceService service;
    public ResourceController(ResourceService service){this.service=service;}

    @PostMapping
    @PreAuthorize("hasAnyRole('RESOURCE_OWNER','SERVICE_PROVIDER','COUNTY_OPERATOR')")
    Map<String,Object> create(@Valid @RequestBody CreateResource request) throws Exception {return service.create(request);}

    @GetMapping
    List<Map<String,Object>> list(@RequestParam(required=false) String type,
                                 @RequestParam(required=false) String town,
                                 @RequestParam(required=false) String availability){return service.list(type,town,availability);}

    public record CreateResource(
      @NotBlank @Pattern(regexp="COLD_STORAGE|SORTING_WORKSHOP|TEA_FACTORY|AGRI_INPUT|CROP_PROTECTION|MACHINERY|AGRI_TECH") String resourceType,
      @NotBlank @Size(max=200) String name,@NotBlank @Size(max=100) String town,
      @DecimalMin("0.01") BigDecimal capacityValue,@Size(max=30) String capacityUnit,
      @DecimalMin("0") BigDecimal priceAmount,@Size(max=30) String priceUnit,
      BigDecimal longitude,BigDecimal latitude,@Size(max=500) String addressText,
      @NotBlank @Pattern(regexp="PUBLIC|AFTER_DEAL|AFTER_ACCEPT|NEARBY_ONLY") String addressLevel,
      Map<String,Object> attributes){}
}
