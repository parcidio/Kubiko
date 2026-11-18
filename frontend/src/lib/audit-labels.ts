// Rótulos de audit_logs, partilhados por Auditoria, fichas de conta e de reserva.

/** Nomes das ações de audit_logs (AuditAction no backend). */
export const ACTION_LABEL: Record<string, string> = {
  KYC_START_REVIEW: "KYC: análise iniciada",
  KYC_APPROVED: "KYC aprovado",
  KYC_REJECTED: "KYC recusado",
  KYC_INFO_REQUESTED: "KYC: pedida informação",
  KYC_DOCUMENTS_VIEWED: "Documentos KYC abertos",
  PAYMENT_CONFIRMED_MANUALLY: "Pagamento validado à mão",
  BALANCE_ADJUSTED: "Saldo ajustado",
  DEPOSIT_RELEASED: "Caução libertada",
  DEPOSIT_WITHHELD: "Caução retida",
  BOOKING_COMPLETED: "Reserva concluída",
  INCIDENT_RESOLVED: "Problema resolvido",
  ITEM_FEATURED: "Equipamento destacado",
  ITEM_UNFEATURED: "Destaque retirado",
  CONTRACT_VIEWED: "Contrato aberto por admin",
  RECEIPT_VIEWED: "Comprovativo aberto por admin",
  CONTRACT_ACCEPTED: "Contrato aceite",
  HANDOVER_REGISTERED: "Entrega/devolução registada",
  HANDOVER_CONFIRMED: "Entrega/devolução confirmada",
  // Pagamento direto ao dono (2026-11-15)
  PAYMENT_RECEIVED: "Dono confirmou o pagamento",
  COMMISSION_SETTLED: "Comissão recebida do dono",
  DEPOSIT_RETURNED_BY_OWNER: "Dono devolveu a caução",
  DEPOSIT_WITHHELD_BY_OWNER: "Dono reteve parte da caução",
  // Ações de admin (2026-11-15)
  ITEM_SUSPENDED: "Equipamento suspenso",
  ITEM_REINSTATED: "Equipamento reativado",
  ACCOUNT_SUSPENDED: "Conta suspensa",
  ACCOUNT_REINSTATED: "Conta reativada",
  // Zonas, papéis e mensagens (2026-11-17)
  SERVICE_AREA_CHANGED: "Zona de serviço alterada",
  USER_ROLE_CHANGED: "Papel alterado (antigo)",
  MESSAGE_SENT: "Mensagem enviada",
  // Equipa e contas (2026-11-18)
  ADMIN_INVITED: "Convite para a equipa",
  ADMIN_INVITATION_REVOKED: "Convite cancelado",
  ADMIN_INVITATION_ACCEPTED: "Convite aceite",
  ADMIN_ROLE_CHANGED: "Papel na equipa alterado",
  ADMIN_ACCESS_REVOKED: "Acesso ao Admin retirado",
  SESSIONS_REVOKED: "Sessões terminadas",
  PHONE_VERIFICATION_RESET: "Confirmação do telefone reposta",
  USER_NOTE_ADDED: "Nota interna",
};

export const ENTITY_LABEL: Record<string, string> = { BOOKING: "Reserva", KYC: "Verificação", ACCOUNT: "Conta / dono", INCIDENT: "Problema", ITEM: "Equipamento", SERVICE_AREA: "Zona", MESSAGE: "Mensagem", ADMIN_INVITATION: "Convite" };
