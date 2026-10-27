# Ecrãs da app — mapa, estado e divisão de trabalho

Design: `docs/DESIGN_SYSTEM.md` · Lacunas da API: `docs/BACKEND_GAPS.md` · Código: `frontend/src/app/` e `frontend/src/components/bz/`.

Legenda de estado (frontend): **Ligado** = fala com a API e funciona · **Parcial** = funciona, mas uma parte espera backend · **UI** = desenhado e navegável, sem API.
Coluna **API**: ✅ o endpoint já existe (o ecrã pode deixar de mostrar `BackendPending`) · 🟡 parte existe · ⬜ por fazer. Números = linhas de `BACKEND_GAPS.md`.

## Fluxo principal

```
Explorar → Detalhe → Pedido (4 passos) → [dono aceita em Pedidos: contrato gerado] → Contrato (arrendatário aceita)
→ Pagamento → [admin valida] → Checklist de entrega → Uso → Checklist de devolução → [admin liberta/retém caução] → Avaliar
```
O centro de tudo é o **Detalhe da reserva** (`/reservas/[id]`): bilhete, próximo passo com prazo, timeline, valores e ações.

## Mapa

| Rota | Ecrã | Papel | Estado | Frente | API (2026-10-23) |
|---|---|---|---|---|---|
| `/` | Landing (não mexer) | Todos | — | — | — |
| `/entrar` | Entrar (telefone ou email + password, Google) | Todos | Ligado | A | ✅ |
| `/registar` | Criar conta (dados → código) | Todos | Ligado | A | ✅ |
| `/recuperar` | Recuperar password | Todos | Ligado | A | ✅ |
| `/oauth2/callback` | Retorno do Google + telefone | Todos | Ligado | A | ✅ |
| `/bem-vindo` | Onboarding (3 ecrãs) | Todos | UI (estático) | A | — |
| `/explorar` | Explorar: herói com pesquisas rápidas, faixa de confiança, categorias, faixas Em destaque / Mais alugados / Mais bem avaliados, grelha, convite a publicar | Todos | Parcial (filtros no cliente) | A | 🟡 sem pesquisa no servidor (#17) |
| `/equipamento/[id]` | Detalhe: galeria, avaliações, estado, dono, datas + preço, caução, mais da categoria | Todos | Parcial (sem disponibilidade) | A | 🟡 sem disponibilidade (#8), selo (#15) |
| `/equipamento/[id]/reservar` | Pedido de reserva (datas → entrega → mensagem → rever) | Arrendatário | Ligado | A | ✅ |
| `/reservas` | As minhas reservas | Arrendatário | Ligado | A | ✅ |
| `/reservas/[id]` | **Detalhe da reserva (hub)** | Ambos | Ligado | A | ✅ estados novos (#10) |
| `/reservas/[id]/pagar` | Pagamento por referência | Arrendatário | Parcial (sem comprovativo) | A | 🟡 contrato antes de pagar ✅, comprovativo ⬜ (#5) |
| `/reservas/[id]/contrato` | Contrato | Ambos | UI | A | ✅ `/bookings/{id}/contract` |
| `/reservas/[id]/avaliar` | Avaliar | Arrendatário | Ligado | A | ✅ |
| `/atividade` | Atividade | Arrendatário | Parcial (reservas recentes) | A | ✅ `/notifications/me` |
| `/conta` | Conta, modo, sair | Ambos | Parcial (sem perfil) | A | ✅ `/profiles/me` |
| `/verificacao` | Verificação (BI + selfie / NIF) | Ambos | UI | A | ✅ `/kyc/submit`, `/kyc/me` |
| `/painel` | Painel do dono | Dono | Ligado | B | ✅ |
| `/pedidos` | Pedidos recebidos (aceitar/recusar) | Dono | Ligado | B | ✅ |
| `/publicar` | Publicar (fotos → detalhes → preço → pré-visualização) | Dono | Parcial (sem fotos) | B | ✅ fotos `/items/{id}/photos` |
| `/equipamentos` | O meu equipamento | Dono | Ligado | B | ✅ |
| `/equipamentos/[id]` | Gerir equipamento (editar, pausar, eliminar, datas) | Dono | Parcial (sem datas) | B | 🟡 sem datas (#8) |
| `/carteira` | Carteira e movimentos | Dono | Ligado (sem levantamentos) | B | 🟡 sem levantamentos (#23) |
| `/reservas/[id]/checklist` | Checklist com fotos (câmara) | Ambos | UI | B | ✅ `/bookings/{id}/checklists` |
| `/reservas/[id]/problema` | Reportar problema | Ambos | Parcial (estado + WhatsApp) | B | ✅ `/bookings/{id}/incidents` |
| `/admin` | Visão geral das filas | Admin | UI | B | ✅ filas de admin |
| `/admin/pagamentos` | Validar pagamento | Admin | Parcial (ação por ID) | B | ✅ `/admin/payments` (comprovativo ⬜) |
| `/admin/caucoes` | Libertar caução | Admin | Parcial (ação por ID) | B | ✅ `/admin/deposits` |
| `/admin/verificacoes` | Verificações | Admin | UI | B | ✅ `/admin/kyc` |
| `/admin/problemas` | Problemas | Admin | UI | B | ✅ `/admin/incidents` |
| 404 / erro | `not-found.tsx`, `error.tsx` | Todos | — | A | — |

`/items`, `/arrendador` e `/arrendatario` são páginas antigas da fase 0 (dados mock em `lib/marketplace.ts`). **Por decidir** se saem.

## Divisão em duas frentes

- **Frente A — arrendatário + entrada:** autenticação, onboarding, Explorar, Detalhe, Pedido, Reservas, hub da reserva, Pagamento, Contrato, Avaliar, Conta, Verificação, Atividade.
- **Frente B — dono + operação:** Painel, Pedidos, Publicar, Equipamento, Carteira, Checklist, Reportar problema, Admin.

**Componentes partilhados** (`components/bz/`) — quem mexer avisa a outra pessoa no PR:
`ui`, `form`, `overlay`, `tabs`, `brand`, `shell`, `states`, `equipment`, `booking`. A frente B é dona de `requests`, `item-form`, `photo`, `calendar`, `admin`.

**Ordem sugerida para ligar ao backend** (a API destes passos já existe — 2026-10-23):
1. `/profiles/me` → Conta e gate de KYC (A); KYC → Verificação (A) e Admin › Verificações (B).
2. Fotos → Publicar e Gerir (B).
3. Contrato → Contrato e passo "aceitar antes de pagar" no Pagamento (A).
4. Estados `IN_PROGRESS`/`RETURNED` na timeline (A) + Checklists (B).
5. Reportar problema (B) + filas de Admin: pagamentos, cauções, problemas (B).
6. Notificações → Atividade e sino com polling (A).

Ainda sem API: comprovativo de pagamento (#5), disponibilidade (#8), avaliações (#21).

## Regras para mexer nos ecrãs

- Nada de shadcn nem outras bibliotecas de UI (decisão de 2026-10-17). Novo componente → `components/bz/` e linha no `DESIGN_SYSTEM.md`.
- Ecrã de lista tem sempre vazio, a carregar e erro.
- Quando ligares um endpoint, **remove o `BackendPending`** desse ecrã e risca a linha em `BACKEND_GAPS.md`.
- Um botão âmbar (`variant="primary"`) por ecrã.
