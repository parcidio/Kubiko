package com.beeznoo.api.kyc.entity;

public enum DocumentType {
    BI_FRONT("a frente do BI"),
    BI_BACK("o verso do BI"),
    SELFIE("a selfie com o BI"),
    NIF_DOCUMENT("o documento do NIF"),
    BUSINESS_DOCUMENT("a certidão ou alvará");

    // Para mensagens de erro ao utilizador ("Falta a frente do BI")
    public final String label;

    DocumentType(String label) {
        this.label = label;
    }
}
