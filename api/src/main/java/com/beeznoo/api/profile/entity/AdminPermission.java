package com.beeznoo.api.profile.entity;

/**
 * Permissões por área do Admin (decisoes-produto.md 2026-11-18). Os controladores usam as expressões de
 * {@link com.beeznoo.api.config.AdminAccess}; nunca confiar no frontend para esconder áreas.
 */
public enum AdminPermission {
    /** Visão geral: métricas agregadas, sem dados pessoais. */
    OVERVIEW,
    /** Reservas, pagamentos e comissões, cauções, problemas. */
    OPERATIONS_DESK,
    /** Verificações de identidade. */
    KYC,
    /** Ver a lista e a ficha das contas. */
    USERS_READ,
    /** Suspender/reativar, terminar sessões, repor telefone. */
    USERS_MANAGE,
    /** Escrever notas internas numa conta. */
    USERS_NOTE,
    /** Destacar, suspender e reativar equipamento. */
    ITEMS_MODERATE,
    /** Mensagens da equipa (WhatsApp, email, SMS). */
    MESSAGES,
    /** Zonas de serviço e mapa de registos. */
    GROWTH_DESK,
    /** Auditoria e eventos de segurança. */
    AUDIT,
    /** Equipa e acessos: convites, papéis, retirar acesso. */
    TEAM;

    public String authority() {
        return "PERM_" + name();
    }
}
