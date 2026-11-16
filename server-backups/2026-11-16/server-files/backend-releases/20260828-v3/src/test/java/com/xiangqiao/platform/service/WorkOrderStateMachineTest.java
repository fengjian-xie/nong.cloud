package com.xiangqiao.platform.service;

import com.xiangqiao.platform.shared.ApiException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WorkOrderStateMachineTest {
    @Test void allowsNormalClosedLoop(){
        assertDoesNotThrow(()->WorkOrderStateMachine.verify("PENDING_PAYMENT","RESERVED"));
        assertDoesNotThrow(()->WorkOrderStateMachine.verify("RESERVED","WAITING_ARRIVAL"));
        assertDoesNotThrow(()->WorkOrderStateMachine.verify("WAITING_ARRIVAL","IN_SERVICE"));
        assertDoesNotThrow(()->WorkOrderStateMachine.verify("IN_SERVICE","PENDING_ACCEPTANCE"));
        assertDoesNotThrow(()->WorkOrderStateMachine.verify("PENDING_ACCEPTANCE","COMPLETED"));
    }
    @Test void rejectsSkippingAcceptance(){
        assertThrows(ApiException.class,()->WorkOrderStateMachine.verify("IN_SERVICE","COMPLETED"));
    }
}
