package com.beeznoo.api.audit.entity;

public enum AuditAction {
    KYC_START_REVIEW,
    KYC_APPROVED,
    KYC_REJECTED,
    KYC_INFO_REQUESTED,
    KYC_DOCUMENTS_VIEWED,       // admin abriu os documentos (URLs assinadas) de uma verificação
    PAYMENT_CONFIRMED_MANUALLY,
    BALANCE_ADJUSTED,
    DEPOSIT_RELEASED,
    DEPOSIT_WITHHELD,
    BOOKING_COMPLETED,
    INCIDENT_RESOLVED,
    ITEM_FEATURED,
    ITEM_UNFEATURED,
    // Documentos com dados pessoais abertos por um admin (as partes não ficam registadas)
    CONTRACT_VIEWED,
    RECEIPT_VIEWED,
    // Mudanças de estado com valor de prova (SPEC §8), feitas pelas partes
    CONTRACT_ACCEPTED,          // arrendatário aceitou o contrato
    HANDOVER_REGISTERED,        // entrega ou devolução registada com fotos
    HANDOVER_CONFIRMED,         // a outra parte confirmou → reserva avança
    // Pagamento direto ao dono (decisoes-produto.md 2026-11-15)
    PAYMENT_RECEIVED,           // o dono confirmou que recebeu o pagamento na entrega
    COMMISSION_SETTLED,         // a equipa recebeu do dono as comissões em aberto
    DEPOSIT_RETURNED_BY_OWNER,  // o dono devolveu a caução toda
    DEPOSIT_WITHHELD_BY_OWNER,  // o dono reteve parte ou toda a caução
    // Ações de admin (decisoes-produto.md 2026-11-15)
    ITEM_SUSPENDED,
    ITEM_REINSTATED,
    ACCOUNT_SUSPENDED,
    ACCOUNT_REINSTATED,
    // Zonas de serviço (decisoes-produto.md 2026-11-17): criar, editar, ativar/desativar
    SERVICE_AREA_CHANGED,
    // Papéis e mensagens da equipa (decisoes-produto.md 2026-11-17)
    USER_ROLE_CHANGED,          // histórico (até 2026-11-18); substituído pelos ADMIN_* abaixo
    MESSAGE_SENT,
    // Acesso ao Admin por convite e papéis da equipa (decisoes-produto.md 2026-11-18)
    ADMIN_INVITED,
    ADMIN_INVITATION_REVOKED,
    ADMIN_INVITATION_ACCEPTED,
    ADMIN_ROLE_CHANGED,
    ADMIN_ACCESS_REVOKED,
    // Gestão de contas (decisoes-produto.md 2026-11-18)
    SESSIONS_REVOKED,
    PHONE_VERIFICATION_RESET,
    USER_NOTE_ADDED
}
