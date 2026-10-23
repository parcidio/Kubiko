package com.beeznoo.api.kyc.entity;

public enum KycAction {
    START_REVIEW,
    APPROVE,
    REJECT,
    REQUEST_INFO,
    // registada pelo próprio utilizador ao reenviar documentos depois de INFO_REQUESTED
    RESUBMIT
}
