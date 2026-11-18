# Contrato — Admin (papéis, mensagens, zonas, mapa) e localização

Fonte de verdade para backend e frontend desta entrega (2026-11-17). Decisão: `claude/decisoes-produto.md` 2026-11-17.
Todas as rotas sob `/api/v1`. Erros no formato já usado pela API (`ApiError`). Códigos de erro em `code`.

## Migrações
- **V28__admin_messages.sql** — `message_templates`, `admin_messages`, `message_deliveries` (+ seeds de modelos).
- **V27__service_areas_location.sql** — `service_areas` (+ seeds Luanda e Bengo, 60 km), colunas de localização em `profiles`,
  `location_events`.

## Papéis
`PATCH /admin/users/{id}/role` body `{ "admin": true|false }` → `AdminUserDtos` atual do utilizador.
Ao retirar admin, o papel volta a `BOTH`. 409 `last_admin`, 409 `self_demotion`, 409 `account_suspended`.
Lista `GET /admin/users` aceita `?role=ADMIN`.

## Mensagens
- `GET /admin/messages/templates` → `[{ id, key, name, channel|null, subject|null, body, predefined, updatedAt }]`
- `POST /admin/messages/templates` `{ name, subject?, body, channel? }` (body ≤ 1000, name ≤ 80)
- `PUT /admin/messages/templates/{id}` · `DELETE /admin/messages/templates/{id}` (predefinidos: 409 `predefined_template`)
- `GET /admin/messages/whatsapp-check?phone=+2449…` → `{ phone, hasWhatsApp: true|false|null, international: bool }`
  (`null` = gateway indisponível)
- `POST /admin/messages/preview` `{ channel, audience, templateId?, subject?, body? }` →
  `{ recipients, reachable, skipped: { noPhone, noEmail, foreignNoWhatsapp, … }, sample: { subject, body } }`
- `POST /admin/messages` mesmo body → 202 `{ id, recipients, reachable }`
- `GET /admin/messages?page=` → página de `{ id, channel, subject, bodyPreview, audienceLabel, recipients, sent, failed, pending, createdAt, createdBy }`
- `GET /admin/messages/{id}` → envio + `deliveries: [{ userId, name, destinationMasked, status, error, sentAt }]`

`channel`: `WHATSAPP | EMAIL | SMS`. `audience`:
`{ "type": "USERS", "userIds": [...] }` (≤ 200) · `{ "type": "ALL" }` · `{ "type": "VERIFIED" }` ·
`{ "type": "CITY", "areaId": "uuid" }` · `{ "type": "UNVERIFIED" }`.
Variáveis no texto: `{{nome}}`, `{{primeiro_nome}}`. Limite por envio: 2000 destinatários (WhatsApp: 300).
SMS a número não +244 → ignorado (`foreignNoWhatsapp`/`foreignSms`). Estado da entrega: `PENDING | SENT | FAILED | SKIPPED`.

## Zonas de serviço
- `GET /service-areas` (público) → `[{ id, province, city, active }]` ativas.
- `GET /admin/service-areas` · `POST /admin/service-areas` `{ province, city, lat, lng, radiusKm, active }` ·
  `PUT /admin/service-areas/{id}` · (sem delete: desativar).
- `POST /me/location` `{ lat, lng, accuracyM?, context: "SIGNUP"|"KYC"|"PUBLISH"|"APP" }` → `{ inServiceArea, area: {province, city}|null }`.
  Guarda arredondado a 2 casas.
- `GET /me/location` → `{ consented, consentAt, updatedAt, inServiceArea, area: {province, city}|null, storedZoneUsable }`
  (sem coordenadas; também em `GET /profiles/me` como `location`). Decisão 2026-11-18.
- Publicar (`POST /items`) e reativar (`PATCH /items/{id}/activate`): `location: {lat,lng}` (posição do browser), ou
  `areaId` (zona escolhida à mão; 403 se o browser disse "fora" nas últimas 24 h), ou nada (zona guardada na conta:
  última localização ≤ 30 dias numa zona ativa). Sem nenhuma → 422 `location_required`; fora → 403 `area_not_available`.
  `GET /me/publish-eligibility?lat=&lng=` → `{ allowed, reason: null|"location_required"|"area_not_available", areas: [...] }`.

## Mapa
`GET /admin/metrics/heatmap?scope=KYC_APPROVED|KYC_SUBMITTED|SIGNUP` →
`{ scope, cellSizeDeg: 0.05, coarseCellSizeDeg: 0.25, minCount: 3, cells: [{ lat, lng, count, sizeDeg }], byProvince: [{ province, count }],
outsideAreas, suppressed, withoutLocation, withLocation }`. Quem não chega a 3 numa célula de 0,05° junta-se na de 0,25°
(`sizeDeg`); o que nem assim chega fica em `suppressed`.
