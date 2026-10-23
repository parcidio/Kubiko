package com.beeznoo.api.claim.entity;

public enum IncidentType {
    DAMAGE("um dano"),
    LOSS("uma perda"),
    THEFT("um roubo"),
    OTHER("um problema");

    // para a copy das notificações: "Ana reportou um dano"
    public final String label;

    IncidentType(String label) {
        this.label = label;
    }
}
