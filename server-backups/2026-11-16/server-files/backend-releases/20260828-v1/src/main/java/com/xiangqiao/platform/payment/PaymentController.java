package com.xiangqiao.platform.payment;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController{
 private final PaymentService service;public PaymentController(PaymentService service){this.service=service;}
 @PostMapping("/work-orders/{id}") Map<String,Object> workOrder(@PathVariable UUID id){return service.createWorkOrderPayment(id);}
}

@RestController
@RequestMapping("/api/v1/public/webhooks/payments")
@ConditionalOnProperty(name="app.integration.mode",havingValue="mock")
class MockPaymentWebhookController{
 private final PaymentService service;MockPaymentWebhookController(PaymentService service){this.service=service;}
 @PostMapping("/mock-paid") Map<String,Object> paid(@Valid @RequestBody MockPaid r){return service.mockPaid(r.countyCode(),r.paymentId(),r.providerEventId(),r.tradeNo());}
 record MockPaid(@NotBlank String countyCode,@NotNull UUID paymentId,@NotBlank String providerEventId,@NotBlank String tradeNo){}
}
