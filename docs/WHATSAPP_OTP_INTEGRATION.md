# WhatsApp OTP — Integração com Meta for Developers

## Visão geral

O Beeznoo usa a **WhatsApp Business API (Cloud API)** da Meta para enviar
códigos OTP de autenticação. O utilizador recebe o código no WhatsApp,
introduz na app, e o backend valida contra o hash guardado na base de dados.

O template usado é do tipo **AUTHENTICATION** com botão **COPY_CODE** —
o utilizador toca em "Copiar código" e cola na app.

---

## Pré-requisitos (Meta for Developers)

1. Conta em [developers.facebook.com](https://developers.facebook.com)
2. Criar uma **Meta App** do tipo Business
3. Adicionar o produto **WhatsApp** à app
4. Criar ou associar um **WhatsApp Business Account (WABA)**
5. Registar um número de telefone como **sender** (número da Beeznoo)
6. Criar o template de autenticação (ver secção abaixo)
7. Gerar um **System User Token** permanente (não usar o token temporário do dashboard)

---

## Variáveis de ambiente necessárias

Adicionar ao `.env` e ao `.env.example`:

```env
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v19.0
WHATSAPP_PHONE_NUMBER_ID=<id do número registado no Meta>
WHATSAPP_BUSINESS_ACCOUNT_ID=<id do WABA>
WHATSAPP_TOKEN=<system user token permanente>
WHATSAPP_OTP_TEMPLATE_NAME=beeznoo_otp
WHATSAPP_OTP_EXPIRATION_MINUTES=10
```

---

## Criar o template de autenticação

Usar a Upsert Templates API uma única vez (substituir os IDs):

```bash
curl 'https://graph.facebook.com/v19.0/<WHATSAPP_BUSINESS_ACCOUNT_ID>/upsert_message_templates' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer <WHATSAPP_TOKEN>' \
-d '{
  "name": "beeznoo_otp",
  "languages": ["pt_PT"],
  "category": "AUTHENTICATION",
  "components": [
    {
      "type": "BODY",
      "add_security_recommendation": true
    },
    {
      "type": "FOOTER",
      "code_expiration_minutes": 10
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "OTP",
          "otp_type": "COPY_CODE"
        }
      ]
    }
  ]
}'
```

O template fica pendente de aprovação pela Meta (normalmente minutos a horas).
Só após `"status": "APPROVED"` é que o envio funciona em produção.

---

## Fluxo de autenticação completo

```
1. Utilizador introduz o número de telefone na app
        ↓
2. Frontend → POST /api/v1/auth/otp/send { phone: "+244923..." }
        ↓
3. Backend gera OTP de 6 dígitos, guarda o hash em otp_codes com TTL de 10 min
        ↓
4. Backend chama a WhatsApp Cloud API → envia template beeznoo_otp para o número
        ↓
5. Utilizador recebe o código no WhatsApp e copia/introduz na app
        ↓
6. Frontend → POST /api/v1/auth/otp/verify { phone, code }
        ↓
7. Backend valida hash + expiração + not used
        ↓
8. Se perfil não existe → cria Profile + Account (registo implícito)
   Se perfil já existe → apenas autentica
        ↓
9. Backend emite Access Token (JWT, 15 min) + Refresh Token (30 dias)
        ↓
10. Frontend guarda os tokens e acede às rotas privadas
```

---

## Enviar o OTP — chamada à API

```http
POST https://graph.facebook.com/v19.0/<PHONE_NUMBER_ID>/messages
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "+244923000000",
  "type": "template",
  "template": {
    "name": "beeznoo_otp",
    "language": { "code": "pt_PT" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      }
    ]
  }
}
```

---

## Segurança

| Regra                                     | Implementação                                                 |
| ----------------------------------------- | ------------------------------------------------------------- |
| OTP nunca guardado em claro               | Guardado como `BCrypt hash` em `otp_codes.code_hash`          |
| OTP expira em 10 minutos                  | `expires_at = NOW() + 10 min`, validado antes de comparar     |
| OTP só pode ser usado uma vez             | `used_at` preenchido após verificação bem-sucedida            |
| OTPs anteriores invalidados ao pedir novo | `OtpCodeRepository.invalidateAllForPhone()`                   |
| Rate limiting                             | A implementar via Spring Rate Limiter no endpoint `/otp/send` |
| Número no formato E.164                   | Validado por `@Pattern` no DTO antes de chegar ao serviço     |

---

## Notas de produção

- Usar sempre um **System User Token permanente** — o token de teste
  do dashboard expira em 24h e vai quebrar o envio em produção.
- Em desenvolvimento, usar o **número de teste** que a Meta fornece
  na consola (permite enviar para até 5 números verificados sem aprovação
  de template).
- O template `beeznoo_otp` precisa de estar `APPROVED` antes de ir a produção.
  Em desenvolvimento, o número de teste ignora este requisito.
- Subscrever o webhook `messages > status` para saber se o OTP foi
  entregue, lido ou falhou — útil para logs e debugging.
