package com.beeznoo.api.transaction.entity;

public enum EntryType {
    HOLD,             // valor retido do saldo disponível do arrendatário (reserva aceite)
    HOLD_RELEASE,     // revertido para disponível (cancelamento antes do pagamento)
    PAYMENT_DEBIT,    // débito definitivo do arrendatário (pagamento confirmado)
    PAYMENT_CREDIT,   // crédito no dono (pagamento confirmado)
    DEPOSIT_HOLD,     // caução retida do arrendatário
    DEPOSIT_RETURN,   // caução devolvida após conclusão sem disputa
    DEPOSIT_FORFEIT,  // caução retida após disputa ganha pelo dono
    ADJUSTMENT,       // ajuste manual pelo admin
    TOPUP,            // valor recebido por referência entra no saldo do arrendatário
    SERVICE_FEE       // taxa de serviço Beeznoo debitada ao arrendatário
}
