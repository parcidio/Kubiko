package com.beeznoo.api.handover.entity;

public enum ChecklistType {
    DELIVERY, // entrega: ACTIVE → IN_PROGRESS
    RETURN    // devolução: IN_PROGRESS → RETURNED
}
