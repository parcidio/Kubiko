package com.beeznoo.api.deposit.entity;

public enum DepositStatus {
    HELD,      // retida desde a confirmação do pagamento
    RELEASED,  // devolvida por inteiro ao arrendatário
    WITHHELD   // parte ou tudo entregue ao dono; o resto devolvido
}
