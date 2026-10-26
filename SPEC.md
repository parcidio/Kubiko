# SPEC.md — Beeznoo MVP

**Versão:** 0.1 · **Data:** 2026-10-12 · **Owner:** Parcídio André (PM)
**Estado:** rascunho para revisão da equipa. Itens marcados **[EM ABERTO]** precisam de decisão antes de implementar.

Como trabalhar no código: ver `CLAUDE.md`. Decisões fechadas: `claude/decisoes-produto.md`.

---

## 1. Problema e hipótese

- **Donos** (fotógrafos, videomakers, estúdios, empresas de eventos) têm equipamento caro parado durante semanas.
- **Quem precisa** (criadores, produtoras, organizadores de eventos, empresas) só o usa por dias ou por projeto — comprar não compensa.
- **Hipótese:** em Luanda há oferta subutilizada e procura suficiente para um marketplace, **se** a confiança for resolvida com verificação, contrato e caução.
- **Regra de validação:** comportamento > opinião. Interesse não valida; reserva paga valida.

## 2. Objetivo do MVP

> Realizar o **primeiro aluguer real, pago e concluído** através da Beeznoo — e depois repeti-lo.

| Métrica | Meta |
|---|---|
| North Star | Alugueres pagos e concluídos / mês |
| Semana 4 | 1.º aluguer pago |
| Semana 8 | 5–10 alugueres pagos |
| Semana 12 | 20–30 donos, 50 equipamentos, 10–20 alugueres |
| Qualidade | Cancelamentos < 15% · incidentes < 5% |

## 3. Âmbito

- **Geografia:** Luanda.
- **Vertical principal:** fotografia e vídeo. **Secundário:** áudio e eventos.
- **Contas:** particulares **e** empresas (`account_type`: `individual` | `business`).
- **Modelo:** concierge marketplace — a app é catálogo + fluxo de reserva; pagamento, verificação e problemas são tratados manualmente pela equipa.

## 4. Papéis

| Papel | Pode |
|---|---|
| Visitante | Explorar e ver detalhe |
| Arrendatário | Pedir reserva, pagar, acompanhar reservas, fazer checklist, reportar problema |
| Dono | Publicar equipamento, gerir disponibilidade, aceitar/recusar pedidos, checklist |
| Admin (equipa Beeznoo) | Aprovar verificações, validar pagamentos, gerir caução, resolver problemas |

Um utilizador pode ser dono e arrendatário ao mesmo tempo.

## 5. Modelo económico (MVP)

- **Taxa de serviço:** 8% sobre o valor do aluguer, paga pelo arrendatário.
- **Caução reembolsável:** retida até à devolução e inspeção; libertada se tudo estiver em condições.
  - Regra atual no código: o **menor** entre 10% do valor do equipamento e 3 diárias. **[EM ABERTO]** confirmar — para equipamento caro, 3 diárias pode ser uma caução baixa face ao risco.
- **Preço:** diário, semanal e mensal definidos pelo dono; o cálculo usa a tarifa mais vantajosa para o período.
- **Pagamento:** Multicaixa Express / pagamento por referência, com **validação manual** pela equipa (comprovativo + ID da transação).
- **Sem seguro.** Comunicar apenas caução, contrato, verificação e proteção. Nada de "seguro/apólice/sinistro" até existir seguradora parceira.

**[EM ABERTO] Semântica de `total_amount`.** Proposta: `subtotal` = valor do aluguer · `service_fee` = 8% · `deposit_amount` = caução (campo de apresentação, espelha o registo em `deposits`) · `total_amount` = o que a Beeznoo efetivamente cobra. Decidir se a caução entra no `total_amount` para evitar dupla contagem na reconciliação.

## 6. Ecrãs do MVP

Fonte visual: `docs/DESIGN_SYSTEM.md` (Identidade Verde v3). Rotas e estado de cada ecrã: `docs/ECRAS.md`.

| # | Ecrã | Papel | Essencial |
|---|---|---|---|
| 1 | **Explorar** | Todos | Pesquisa, chips de categoria, filtros (bairro, preço, datas), grelha de `EquipmentCard`, estados vazio/a carregar/erro |
| 2 | **Detalhe** | Todos | Galeria, estado do equipamento, calendário de disponibilidade, dono (com selo se verificado), `PriceSummary`, CTA "Pedir reserva" + "Falar no WhatsApp", barra fixa no telemóvel |
| 3 | **Pedido de reserva** | Arrendatário | Datas, ponto de entrega/recolha, mensagem ao dono, aceitar termos, `PriceSummary`, aviso "o dono tem 24 h para responder" |
| 4 | **Pagamento** | Arrendatário | Instruções Multicaixa Express / referência (copiar), envio de comprovativo + ID da transação, estado "A validar" |
| 5 | **As minhas reservas** | Arrendatário | Separadores (ativas/passadas), estado, `Timeline` de 6 passos, ações |
| 6 | **Publicar** | Dono | Passos: fotos → detalhes (título, categoria, estado, descrição, bairro) → preços (Kz) → valor declarado → pré-visualização |
| 7 | **Pedidos recebidos** | Dono | `RequestCard` com arrendatário (selo), datas, valor, prazo (normal/urgente), Aceitar / Recusar |
| 8 | **Os meus equipamentos** | Dono | Lista com estado (ativo/pausado/alugado), bloquear datas no calendário |
| 9 | **Checklist de entrega/devolução** | Ambos | Fotos obrigatórias por ângulo, notas de estado, confirmação das duas partes |
| 10 | **Entrar** | Todos | Telefone (+244) + código OTP; escolher particular/empresa |
| 11 | **Verificação** | Todos | Particular: BI (frente/verso) + selfie · Empresa: NIF. Estado "Em análise" |
| 12 | **Admin** | Admin | Filas: verificações pendentes, pagamentos a validar, cauções a libertar/reter, problemas reportados |

Requisitos transversais: mobile-first (360px), corpo ≥ 15px, alvos ≥ 44px, funciona em rede lenta (skeletons, imagens comprimidas).

## 7. Fluxo principal

```
Explorar → Detalhe → Pedido → [dono aceita em 24 h] → Pagamento → [admin valida]
→ Entrega + checklist → Uso → Devolução + checklist → Inspeção → Caução libertada / retida
```

### Estados da reserva

| Estado | Quem muda | Próximo |
|---|---|---|
| `requested` | Arrendatário cria | `accepted`, `declined`, `expired` (24 h sem resposta), `cancelled` |
| `accepted` | Dono | `payment_pending` |
| `payment_pending` | Sistema | `payment_review` (comprovativo enviado), `expired`, `cancelled` |
| `payment_review` | Arrendatário envia | `paid`, `payment_rejected` |
| `paid` | Admin valida | `in_progress` (checklist de entrega feita), `cancelled` |
| `in_progress` | Checklist de entrega | `returned` |
| `returned` | Checklist de devolução | `completed` |
| `completed` | Admin após inspeção | — (caução: `released` ou `withheld`) |

Timeline visível ao utilizador (6 passos): pedido → aceite → pago → entregue → devolvido → caução libertada.

> **Implementação (2026-10-23).** O backend usa nomes próprios e ainda não tem os estados de comprovativo nem de expiração
> do pedido. Correspondência: `requested` = `PENDING_OWNER` · `declined` = `CANCELLED_OWNER` (a partir de `PENDING_OWNER`) ·
> `cancelled` = `CANCELLED_RENTER` / `CANCELLED_OWNER` · `accepted` / `payment_pending` = `ACCEPTED` (com contrato gerado e
> referência por pagar) · `paid` = `ACTIVE` · `in_progress` = `IN_PROGRESS` · `returned` = `RETURNED` · `completed` = `COMPLETED`
> (caução `RELEASED` ou `WITHHELD`, tabela `deposits`) · problema reportado = `DISPUTED`.
> Ainda por fazer: `payment_review` / `payment_rejected` (comprovativo) e `expired` (24 h sem resposta do dono).
> Ver `claude/decisoes-produto.md` (2026-10-23) e `docs/BACKEND_GAPS.md`.

**[EM ABERTO]** prazos: tempo para pagar depois de aceite; política de cancelamento e reembolso.

### Verificação (KYC)
- Obrigatória antes de **pedir** reserva ou de **publicar** equipamento (pode explorar sem conta).
- Manual: admin aprova, recusa ou pede mais informação. Estado visível: `pending` → `in_review` → `approved` | `rejected` | `info_requested`.
- Selo "Verificado" só aparece com `approved`.

### Reportar problema
Formulário simples (reserva, tipo: dano / perda / roubo / outro, descrição, fotos). Resolução 100% manual pela equipa, decide retenção total ou parcial da caução. Sem pipeline automático no MVP.

## 8. Modelo de dados (P0)

Decisões fechadas (ver `claude/decisoes-produto.md`):

| Tabela | Notas |
|---|---|
| `users` / `profiles` | `account_type` individual/business; papel por relação, não por flag única |
| `kyc_verifications` | Documentos em storage privado; histórico de decisões com autor e data |
| `categories`, `items`, `item_photos` | `items.declared_value`, preços diário/semanal/mensal em inteiros (Kz) |
| `availability_blocks` | Mecanismo único de bloqueio; `booking_id` opcional (bloqueio por reserva **ou** manual do dono) |
| `bookings` | **1:1 com item** (uma reserva = um equipamento) |
| `payments` | **1:N com booking** — trilho de auditoria imutável (tentativas falhadas, reembolsos) |
| `deposits` | **Tabela autónoma** (opção B): `amount`, `held_at`, `released_at`, `withheld_amount`, motivo |
| `contracts` | Gerado por reserva aceite; versão do texto + aceitação de cada parte |
| `checklists`, `checklist_photos` | Entrega e devolução |
| `reviews` | Só ligadas a reservas concluídas |
| `incident_reports` | Reportar problema |
| `notifications` | Mínimo: registo do que foi enviado (SMS/WhatsApp/email) |
| `audit_logs` | Ações de admin e mudanças de estado sensíveis |

Valores monetários em `BIGINT` (Kz). Datas de aluguer em `DATE`; instantes em `TIMESTAMPTZ`.

## 9. Fora do âmbito (não construir agora)

App nativa · chat interno (usa-se WhatsApp) · IA/recomendações · pesquisa por mapa · loyalty/referral · pricing algorítmico · pagamento automático por gateway · validação automática de NIF na AGT · emissão de seguro/apólices · reviews sofisticadas · dashboards analíticos para donos.

Só entram com evidência de que aumentam transações ou confiança.

## 10. Critérios de aceitação do MVP

- [ ] Um dono verificado publica um equipamento com fotos e preço, e ele aparece em Explorar.
- [ ] Um arrendatário verificado pede reserva para datas livres; datas ocupadas não são selecionáveis.
- [ ] O dono recebe o pedido, aceita, e as datas ficam bloqueadas.
- [ ] O arrendatário vê a referência de pagamento, envia comprovativo; o admin valida e a reserva passa a `paid`.
- [ ] Checklist de entrega e devolução com fotos fica registado nas duas pontas.
- [ ] Admin liberta ou retém (parcial/total) a caução, com registo em `audit_logs`.
- [ ] Nenhum texto da app usa "seguro", "apólice" ou "sinistro".
- [ ] Todos os ecrãs de lista têm estados vazio, a carregar e erro.
- [ ] Documentos de KYC e comprovativos não são acessíveis sem autorização.

## 11. Gates de decisão

| Gate | Pergunta | Se não |
|---|---|---|
| Semana 2 | Há donos dispostos e procura concreta? | Mudar segmento ou proposta |
| Semana 4 | Houve primeira transação paga? | Parar features; investigar aquisição, confiança, preço |
| Semana 8 | Repetimos transações? | Discovery antes de novas features |
| Semana 12 | Sinais de PMF (repetição, procura orgânica, operação controlável)? | Rever vertical/modelo |
| Semana 24 | Escalar, pivotar ou parar — com dados | — |

## 12. Questões em aberto

1. Semântica de `total_amount` e se a caução entra no total cobrado.
2. Regra da caução para equipamento de valor alto.
3. Prazo de pagamento após aceitação e política de cancelamento/reembolso.
4. Estado do repo: confirmar remoção de vestígios de Supabase após a migração para Spring Boot.
5. Quem faz entrega/recolha no MVP (dono, arrendatário, ou equipa Beeznoo) e se tem custo.
6. Contratos de blockchain (ideia do hackathon Colosseum): **fora do MVP** — só registo de hash do contrato, se for retomado, nunca pagamentos em cripto.
