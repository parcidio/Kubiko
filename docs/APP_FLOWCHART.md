# Kubiko — Fluxogramas (Mermaid)

## 1. Fluxo Macro (Fase 0 → Fase 1 → Fase 2)

```mermaid
flowchart TD
    A[Visitante entra na landing] --> B{Tem equipamento parado ou precisa alugar?}
    B -->|Tem equipamento parado| C[Formulario Arrendador - Fase 0]
    B -->|Precisa alugar| D[Formulario Arrendatario - Fase 0]
    C --> E[Lead registado + WhatsApp click-to-chat]
    D --> E
    E --> F[Fase 1: Catalogo curado em /itens]
    F --> G[Contacto via WhatsApp com operador]
    G --> H[KYC manual pelo operador]
    H --> I[Contrato manual + pagamento/caucao registados a mao]
    I --> J[Fase 2: Conta criada - login com JWT]
    J --> K[Publicacao self-service em /publicar]
    J --> L[Pesquisa e reserva em /itens e /itens/id]
    K --> M[Reserva criada - PENDING]
    L --> M
    M --> N{Arrendador aceita a reserva?}
    N -->|Sim| O[Checkout via Multicaixa Express]
    N -->|Nao| P[Reserva CANCELLED - notificacao via RabbitMQ]
    O --> Q{Operador confirma o numero de operacao?}
    Q -->|Sim| R[Transacao CONFIRMED + caucao retida na conta - contrato gerado]
    Q -->|Nao| S[Transacao FAILED - notificacao de erro e reenvio de numero]
    R --> T[Reserva ACTIVE - equipamento entregue]
    T --> U[Devolucao do equipamento]
    U --> V{Houve incidente?}
    V -->|Nao| W[Caucao RETURNED]
    V -->|Sim| X[Sinistro aberto em /sinistros]
    W --> Y[Reserva COMPLETED - conta para a North Star Metric]
    X --> Z[Resolucao do sinistro pelo operador em /admin]
    Z --> Y
```

---

## 2. Fluxo Detalhado — Reserva e Checkout (Fase 2, MVP Transacional)

```mermaid
flowchart TD
    subgraph ARR[Arrendatario]
        A1[Pesquisa em /itens] --> A2[Abre /itens/id]
        A2 --> A3[Seleciona datas de aluguer]
        A3 --> A4[Sistema calcula preco por dia x dias + caucao]
        A4 --> A5[Confirma pedido de reserva]
    end

    A5 --> C1{JWT do arrendatario e valido?}
    C1 -->|Invalido ou expirado| C2[Redireciona para login]
    C1 -->|Valido| B1[Reserva criada com status PENDING]

    B1 --> D1[Evento booking.requested publicado no RabbitMQ]
    D1 --> D2[Notificacao assincrona entregue ao arrendador]
    D2 --> D3{Arrendador aceita ou recusa?}

    D3 -->|Recusa| E1[Reserva passa a CANCELLED]
    E1 --> E2[Auditoria: decisao registada - ator, motivo, timestamp]
    E2 --> E3[Evento booking.cancelled publicado - notifica arrendatario]

    D3 -->|Aceita| F1[Reserva passa a CONFIRMED]
    F1 --> F2[Auditoria: decisao registada]
    F2 --> F3[Redireciona arrendatario para /checkout/id]

    F3 --> G1[Arrendatario escolhe metodo de pagamento]
    G1 --> G2{Metodo escolhido}
    G2 -->|Multicaixa Express| H1[Sistema mostra numero Multicaixa da Kubiko e instrucoes]
    G2 -->|Metodo alternativo local| H2[Fluxo alternativo - a confirmar com produto]

    H1 --> I1[Arrendatario paga na app Multicaixa Express]
    I1 --> I2[Arrendatario introduz o numero de operacao recebido]
    I2 --> I3[Transacao RENTAL_PAYMENT criada com status PENDING_VERIFICATION]
    I3 --> I4[Evento transaction.pending_verification publicado no RabbitMQ]
    I4 --> I5[Operador e notificado e acede a fila de verificacao em /admin]
    I5 --> I6[Operador confirma o numero de operacao contra o extrato EMIS]
    I6 --> I7{Numero de operacao valido?}

    I7 -->|Sim| J1[Transacao passa a CONFIRMED]
    J1 --> J2[Auditoria: transacao verificada manualmente - ator, timestamp]
    J2 --> J3[Cria transacao DEPOSIT_HOLD - held_balance da conta atualizado]
    J3 --> J4[Contrato gerado automaticamente a partir da reserva]
    J4 --> J5[Evento transaction.confirmed publicado - notifica as duas partes]

    I7 -->|Nao| K1[Transacao passa a FAILED]
    K1 --> K2[Auditoria: transacao rejeitada - motivo]
    K2 --> K3[Notificacao ao arrendatario para reenviar numero de operacao]
    K3 --> G1
```

**Nota:** este é o fluxo temporário do MVP — a confirmação é manual porque a integração direta com a EMIS/Multicaixa Express ainda não existe. Quando essa integração ficar disponível, o passo I5–I7 (operador confirma manualmente) é substituído por um callback automático do gateway, sem alterar o resto do fluxo.

---

## 3. Fluxo Detalhado — Sinistro e Devolução de Caução

```mermaid
flowchart TD
    A[Reserva em estado ACTIVE] --> B[Arrendatario devolve o equipamento]
    B --> C{Arrendador reporta incidente?}
    C -->|Nao| D[Reserva passa a COMPLETED]
    D --> E[Cria transacao DEPOSIT_RELEASE - held_balance libertado para available_balance]
    E --> F[Auditoria: libertacao de caucao registada]
    F --> G[Evento transaction.deposit_released publicado - notifica arrendatario]

    C -->|Sim| H[Utilizador abre sinistro em /sinistros - descricao + fotos]
    H --> I[Sinistro criado com status OPEN]
    I --> J[Auditoria: sinistro aberto]
    J --> K[Operador acede a fila de sinistros em /admin]
    K --> L[Sinistro passa a UNDER_REVIEW]
    L --> M{Operador decide}
    M -->|Sem responsabilidade do arrendatario| N[Cria transacao DEPOSIT_RELEASE]
    M -->|Dano parcial| O[Cria transacao DEPOSIT_WITHHOLD - valor parcial]
    M -->|Dano total| P[Cria transacao DEPOSIT_WITHHOLD - valor total]
    N --> Q[Sinistro passa a RESOLVED]
    O --> Q
    P --> Q
    Q --> R[Auditoria: resolucao registada - ator, valor retido]
    R --> S[Evento claim.resolved publicado - notifica ambas as partes]
    S --> T[Reserva passa a COMPLETED]
```

---

## 4. State Diagram — Reserva (Booking)

```mermaid
stateDiagram-v2
    [*] --> PENDING: arrendatario cria pedido
    PENDING --> CONFIRMED: arrendador aceita
    PENDING --> CANCELLED: arrendador recusa ou pedido expira
    CONFIRMED --> ACTIVE: equipamento entregue
    CONFIRMED --> CANCELLED: cancelamento antes da entrega
    ACTIVE --> COMPLETED: devolucao concluida sem pendencias
    COMPLETED --> [*]
    CANCELLED --> [*]
```

## 5. State Diagram — KYC

```mermaid
stateDiagram-v2
    [*] --> PENDING: utilizador submete documentos
    PENDING --> APPROVED: moderador aprova
    PENDING --> REJECTED: moderador rejeita
    REJECTED --> PENDING: utilizador resubmete documentos
    APPROVED --> [*]
```

## 6. State Diagram — Transação (Ledger, tabela `transactions`)

```mermaid
stateDiagram-v2
    [*] --> PENDING_VERIFICATION: transacao criada com numero de operacao
    PENDING_VERIFICATION --> CONFIRMED: operador confirma o numero contra o extrato EMIS
    PENDING_VERIFICATION --> FAILED: operador rejeita ou numero invalido
    FAILED --> PENDING_VERIFICATION: arrendatario submete novo numero de operacao
    CONFIRMED --> REVERSED: estorno por cancelamento ou decisao de sinistro
    CONFIRMED --> [*]
    REVERSED --> [*]
```

Este único diagrama de estados serve para qualquer `type` de transação (`RENTAL_PAYMENT`, `DEPOSIT_HOLD`, `DEPOSIT_RELEASE`, `DEPOSIT_WITHHOLD`, `REFUND`, `PAYOUT`) — o `type` diz _o que_ o movimento representa, o `status` diz _em que ponto_ do ciclo de verificação está.

## 7. State Diagram — Sinistro (Claim)

```mermaid
stateDiagram-v2
    [*] --> OPEN: utilizador abre sinistro
    OPEN --> UNDER_REVIEW: operador inicia analise
    UNDER_REVIEW --> RESOLVED: operador decide desfecho
    RESOLVED --> [*]
```

---

## 8. Sequence Diagram — Autenticação (JWT + Spring Security)

```mermaid
sequenceDiagram
    participant U as Utilizador
    participant F as Frontend
    participant API as API - Spring Security
    participant DB as Base de Dados

    U->>F: Introduz email e password
    F->>API: POST /auth/login
    API->>DB: Valida credenciais
    DB-->>API: Utilizador valido
    API-->>F: Access Token JWT + Refresh Token
    F-->>U: Login concluido

    U->>F: Acede a rota privada
    F->>API: Pedido com header Authorization Bearer JWT
    API->>API: Valida assinatura e expiracao do token

    alt Token valido
        API-->>F: Resposta autorizada
    else Token expirado
        F->>API: POST /auth/refresh com Refresh Token
        API->>DB: Valida refresh token e verifica revogacao
        DB-->>API: Refresh token valido
        API-->>F: Novo Access Token
        F->>API: Repete pedido original
        API-->>F: Resposta autorizada
    else Refresh invalido
        API-->>F: 401 Unauthorized
        F-->>U: Forca novo login
    end
```

---

## 9. Sequence Diagram — Pagamento via Multicaixa Express (verificação manual do número de operação)

```mermaid
sequenceDiagram
    participant AT as Arrendatario
    participant F as Frontend
    participant API as API Kubiko
    participant OP as Operador em /admin
    participant MQ as RabbitMQ
    participant NOTIF as Servico de Notificacoes

    AT->>F: Escolhe pagar via Multicaixa Express
    F-->>AT: Mostra numero Multicaixa da Kubiko e instrucoes
    AT->>AT: Efetua pagamento na app Multicaixa Express
    AT->>F: Introduz o numero de operacao recebido
    F->>API: POST /bookings/id/transactions com operation_number
    API->>API: Cria transacao RENTAL_PAYMENT com status PENDING_VERIFICATION
    API->>MQ: Publica evento transaction.pending_verification
    MQ->>NOTIF: Notifica operador de nova verificacao pendente

    OP->>API: Consulta fila de transacoes pendentes em /admin
    OP->>OP: Confirma numero de operacao contra o extrato EMIS
    OP->>API: PATCH /transactions/id com decisao

    alt Numero confirmado
        API->>API: Transacao passa a CONFIRMED + auditoria
        API->>API: Cria transacao DEPOSIT_HOLD associada
        API->>MQ: Publica evento transaction.confirmed
        MQ->>NOTIF: Notifica arrendatario e arrendador
    else Numero rejeitado
        API->>API: Transacao passa a FAILED + auditoria
        API->>MQ: Publica evento transaction.failed
        MQ->>NOTIF: Notifica arrendatario para reenviar numero de operacao
    end
```

Este fluxo é **temporário**: assume que a Kubiko ainda não tem integração direta (webhook automático) com a EMIS/Multicaixa Express, por isso a confirmação passa por um operador humano. Quando essa integração existir, o bloco "Operador confirma manualmente" é substituído por um callback automático do gateway — a tabela `transactions` e os eventos publicados não mudam.

---

## 10. Sequence Diagram — Mensageria Assíncrona (RabbitMQ) para Notificações

```mermaid
sequenceDiagram
    participant API as API Kubiko
    participant MQ as RabbitMQ - exchange kubiko.events
    participant NOTIF as Servico de Notificacoes
    participant CANAL as WhatsApp / Email / In-app

    API->>MQ: Publica evento, exemplo booking.confirmed
    MQ->>NOTIF: Fila notifications.queue entrega o evento
    NOTIF->>NOTIF: Monta mensagem conforme o canal preferido
    NOTIF->>CANAL: Envia notificacao
    CANAL-->>NOTIF: Confirmacao de entrega quando aplicavel
    NOTIF->>API: Atualiza estado da notificacao - SENT ou FAILED
```
