package com.xiangqiao.platform.service;

import com.xiangqiao.platform.shared.ApiException;

import java.util.Map;
import java.util.Set;

public final class WorkOrderStateMachine {
    private static final Map<String, Set<String>> ALLOWED = Map.ofEntries(
            Map.entry("PENDING_PAYMENT", Set.of("RESERVED", "CANCELLED")),
            Map.entry("RESERVED", Set.of("WAITING_ARRIVAL", "CANCELLED", "REFUNDING")),
            Map.entry("WAITING_ARRIVAL", Set.of("IN_SERVICE", "CANCELLED", "DISPUTED")),
            Map.entry("IN_SERVICE", Set.of("PENDING_ACCEPTANCE", "DISPUTED")),
            Map.entry("PENDING_ACCEPTANCE", Set.of("COMPLETED", "DISPUTED")),
            Map.entry("COMPLETED", Set.of("CLOSED", "DISPUTED")),
            Map.entry("REFUNDING", Set.of("CLOSED", "DISPUTED")),
            Map.entry("DISPUTED", Set.of("COMPLETED", "CLOSED", "REFUNDING")),
            Map.entry("CANCELLED", Set.of("CLOSED")),
            Map.entry("CLOSED", Set.of())
    );

    private WorkOrderStateMachine() {}

    public static void verify(String from, String to) {
        if (!ALLOWED.getOrDefault(from, Set.of()).contains(to)) {
            throw ApiException.badRequest("WORK_ORDER_TRANSITION_INVALID", "工单不能从" + from + "变更为" + to);
        }
    }
}
