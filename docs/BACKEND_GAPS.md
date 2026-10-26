# O que falta no backend

Levantamento feito a 2026-10-17, ao ligar os ecrãs novos (`docs/ECRAS.md`) à API Spring. **Atualizado a 2026-10-23.**
No frontend, cada ponto aparece como aviso **"Falta backend"** (`BackendPending`) no ecrã afetado.
Prioridade pensada para o objetivo do MVP: **o primeiro aluguer pago e concluído**.

Legenda: ✅ feito no backend (falta ligar no frontend, se o ecrã ainda mostra `BackendPending`) · 🟡 parcial · ⬜ por fazer.
Detalhe de cada endpoint no Swagger (`http://localhost:8081/swagger-ui.html`). Decisões em `claude/decisoes-produto.md`.

## P0 — bloqueia o primeiro aluguer real

| # | Estado | O que falta | Como ficou / o que falta | Ecrãs |
|---|---|---|---|---|
| 1 | ✅ | Perfil da pessoa autenticada | `GET/PATCH /profiles/me` — nome, contactos, `accountType`, `phoneVerified`, `identityVerified`, `kycStatus` | Conta, Explorar (saudação), gate de KYC no Pedido e no Publicar |
| 2 | ✅ | Upload de fotos do equipamento | `POST /items/{id}/photos` (multipart `photos`, JPEG/PNG, 5 MB, máx. 8), `DELETE /items/{id}/photos/{photoId}`. Bucket privado + URL assinada de 12 h. **Comprimir no frontend antes de enviar** | Publicar, Gerir equipamento, Explorar, Detalhe |
| 3 | ✅ | KYC | `POST /kyc/submit` (multipart: `accountType` + `biFront`/`biBack`/`selfie` ou `nifDocument`/`businessDocument`), `GET /kyc/me`. Admin: `GET /admin/kyc`, `GET /admin/kyc/{id}` (URLs de 5 min), `PATCH /admin/kyc/{id}/review` | Verificação, Admin › Verificações |
| 4 | ✅ | Listagens de admin | `GET /admin/kyc`, `/admin/payments`, `/admin/deposits`, `/admin/incidents` (mais antigos primeiro), `/admin/audit-logs` | Admin (todas as filas) |
| 5 | ⬜ | **Comprovativo de pagamento**: `POST /payments/{id}/proof` (ficheiro + ID da transação) e estado `payment_review` | Hoje o admin valida com `PATCH /bookings/{id}/confirm-payment` sem prova anexada. **Próximo passo recomendado** | Pagamento, Admin › Pagamentos |
| 6 | ✅ | Reter caução (parcial ou total) | `POST /admin/deposits/{bookingId}/release` e `/withhold` (`amount` em Kz + `reason` obrigatório). `PATCH /bookings/{id}/complete` = libertar | Admin › Cauções |
| 7 | ✅ | `audit_logs` | KYC, confirmação manual de pagamento, ajuste de saldo, libertar/reter caução, resolver problema. Motivo opcional em `confirm-payment` e `complete` (`{ "reason": "..." }`) | Admin |

## P1 — necessário para repetir alugueres com confiança

| # | Estado | O que falta | Como ficou / o que falta | Ecrãs |
|---|---|---|---|---|
| 8 | ⬜ | **Disponibilidade**: `GET /items/{id}/availability` e `POST/DELETE /items/{id}/blocks` (`availability_blocks`) | Hoje só a sobreposição com reservas aceites/pagas é validada | Detalhe (calendário), Gerir › Datas, filtro por datas em Explorar |
| 9 | ✅ | Checklists de entrega e devolução | `POST /bookings/{id}/checklists/{delivery\|return}` (multipart `notes` + 2–10 `photos`), `POST …/{type}/confirm` (só a **outra** parte), `GET /bookings/{id}/checklists`. Sem código de 4 dígitos no MVP | Checklist |
| 10 | ✅ | Estados "entregue" / "devolvido" | `ACTIVE` (pago) → `IN_PROGRESS` → `RETURNED` → `COMPLETED`. **Atualizar a timeline** (`lib/booking.ts`) | Reserva (timeline, próximo passo) |
| 11 | 🟡 | Expiração automática | ✅ referência vencida → `EXPIRED` (a cada minuto). ⬜ pedido sem resposta em 24 h → `expired` | Pedidos, Reserva |
| 12 | ✅ | `incident_reports` | `POST /bookings/{id}/incidents` (multipart `type` DAMAGE/LOSS/THEFT/OTHER, `description`, até 6 `photos`) → reserva `DISPUTED`. Admin: `GET /admin/incidents`, `GET …/{id}`, `PATCH …/{id}/resolve` | Reportar problema, Admin › Problemas |
| 13 | ✅ | Contratos | Gerado quando o dono aceita; `GET /bookings/{id}/contract`, `POST …/contract/accept`. **O arrendatário tem de aceitar antes de gerar a referência.** Texto v1 é rascunho — rever com jurista | Contrato |
| 14 | ⬜ | Entrega/recolha como campos da reserva (modo, bairro, hora) | Ainda vão dentro de `renterMessage` | Pedido, Reserva |
| 15 | ⬜ | Selo "Verificado" e dados de confiança do dono no `ItemResponse` | `KycService.isVerified(ownerId)` já existe; falta expor no item | Detalhe, Pedidos recebidos |
| 16 | ⬜ | Telefone/WhatsApp do dono só para as partes de uma reserva aceite | O WhatsApp ainda fala com a equipa (`NEXT_PUBLIC_WHATSAPP_NUMBER`) | Reserva |

## P2 — melhora a experiência

| # | Estado | O que falta | Ecrãs |
|---|---|---|---|
| 17 | ⬜ | Pesquisa por texto, bairro e preço em `GET /items` (hoje só `categoryId`) | Explorar |
| 18 | ⬜ | Preço semanal/mensal no item (o SPEC pede a tarifa mais vantajosa) | Publicar, Detalhe, PriceSummary |
| 19 | ⬜ | Valor declarado (`declared_value`) para calcular a caução no backend | Publicar |
| 20 | ⬜ | Reativar um item pausado (só existe `deactivate`) | O meu equipamento |
| 21 | ✅ | Avaliações e destaques | `POST/GET /bookings/{id}/review` (arrendatário, reserva `COMPLETED`, uma vez), `GET /items/{id}/reviews`; `ratingAverage`/`ratingCount`/`completedRentals` nos itens; `GET /items?featured=true`, `?order=POPULAR|RATING`; admin: `PATCH /admin/items/{id}/featured` | Avaliar, Explorar, Detalhe |
| 22 | ✅ | Notificações | `GET /notifications/me`, `/me/unread-count` (polling ~60 s), `PATCH /{id}/read`, `POST /me/read-all`. Email via Resend depois do commit; sem WebSocket nem SMS | Atividade |
| 23 | ⬜ | Levantamento do saldo do dono e conta da plataforma para a taxa de 8% | Carteira |
| 24 | ⬜ | Contadores por estado (`GET /bookings/me/owner?status=…`) | Painel, Pedidos |

## Mudanças que o frontend tem de acompanhar (2026-10-23)

- **Pagar exige contrato aceite**: `POST /bookings/{id}/contract/accept` antes de `POST /bookings/{id}/payments`.
- **`PATCH /bookings/{id}/complete`** só funciona em `RETURNED` ou `DISPUTED` (antes era `ACTIVE`).
- **`PATCH /bookings/{id}/dispute`** continua, mas o ecrã de problema deve usar `POST /bookings/{id}/incidents`.
- **Fotos** (`photUrl`, `coverPhoto`) passam a ser URLs assinadas que expiram — não guardar em cache local por mais de 12 h.
- Notificação "pedido aceite" leva a `/reservas/{id}/pagar`; a de checklist a `/reservas/{id}/checklist`.
- **Login Google**: o redirect traz um `code` de uso único → `POST /auth/google/exchange` (já ligado em `oauth2/callback`). Estado novo `email_in_use`.
- **Limites de pedidos**: tratar `429` + `Retry-After` em todos os formulários (sobretudo login e pedidos de código). Ver `docs/SEGURANCA.md`.
- **Access token de 15 min** (antes 60): o frontend já renova com `/auth/refresh` ao receber `401` (`lib/api.ts`).

## Inconsistências encontradas

- **Estados da reserva**: o backend é a fonte de verdade; a correspondência com os nomes do SPEC está em `SPEC.md` §7.
- **Valores monetários**: `NUMERIC(12,2)` no schema vs inteiros em Kz no CLAUDE.md (já registado em `decisoes-produto.md`). A taxa e as retenções de caução são sempre em Kz inteiros.
- **Nomes de campos**: `PublishItemRequest.itemCondition` vs `UpdateItemRequest.condition`; `PhotoResponse.photUrl` (typo). O frontend adapta-se em `lib/api.ts`.
- **`ItemResponse.createdAt`** devolve o `updatedAt` (bug em `ItemService.toResponse`).
- **CORS**: não há config — está bem enquanto o browser passa pelo proxy do Next (`next.config.ts`).
