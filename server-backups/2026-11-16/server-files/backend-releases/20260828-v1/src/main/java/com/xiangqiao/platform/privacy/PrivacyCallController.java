package com.xiangqiao.platform.privacy;

import jakarta.validation.Valid;import jakarta.validation.constraints.*;import org.springframework.web.bind.annotation.*;
import java.util.Map;import java.util.UUID;
@RestController @RequestMapping("/api/v1/privacy-calls")
public class PrivacyCallController{
 private final PrivacyCallService service;public PrivacyCallController(PrivacyCallService service){this.service=service;}
 @PostMapping Map<String,Object> create(@Valid @RequestBody CreateCall r){return service.create(r);}
 public record CreateCall(@NotBlank @Pattern(regexp="SUPPLY|PURCHASE|RESOURCE")String contactType,@NotNull UUID contactId){}
}
