# Ombala SMS — Integração para OTP

## Visão geral

O Beeznoo usa a **Ombala** (https://useombala.ao) para enviar códigos OTP
por SMS. A Ombala é uma startup angolana de envio de SMS — a escolha natural
para um produto focado em Luanda, Angola.

---

## Pré-requisitos

1. Criar conta em https://useombala.ao
2. Gerar um **Bearer token** na consola da Ombala
3. Registar e obter aprovação para um **nome de remetente** (sender ID)
   — ex: `BEEZNOO`
4. Garantir saldo de créditos suficiente para o volume de OTPs esperado

---

## Variáveis de ambiente

```env
OMBALA_TOKEN=<bearer token da consola Ombala>
OMBALA_SENDER=BEEZNOO
OMBALA_OTP_EXPIRATION_MINUTES=10
```

---

## Endpoint de envio

```http
POST https://api.useombala.ao/v1/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  message: O teu código Beeznoo é 123456. Válido por 10 minutos. Não partilhes este código.,
  from: BEEZNOO,
  to: 923000000
}
```

**Nota sobre o formato do número:** com base nos SDKs disponíveis, o número
deve ser enviado sem prefixo internacional (ex: `923000000`). Confirmar com
o suporte da Ombala se o formato `+244923000000` também é aceite, e ajustar
`OmbalaSmsService.normalizePhone()` conforme necessário.

---

## Fluxo de autenticação

```
1. Utilizador introduz número de telefone
       ↓
2. POST /api/v1/auth/otp/send { phone: +244923... }
       ↓
3. Backend gera OTP de 6 dígitos + guarda BCrypt hash em otp_codes (TTL: 10 min)
       ↓
4. OmbalaSmsService → POST api.useombala.ao/v1/messages
       ↓
5. Utilizador recebe SMS com o código
       ↓
6. POST /api/v1/auth/otp/verify { phone, code }
       ↓
7. Backend valida hash + expiração + not used
       ↓
8. Perfil não existe → criado agora (registo implícito)
   Perfil existe → apenas autentica
       ↓
9. Access Token JWT (15 min) + Refresh Token (30 dias)
```

---

## Segurança

| Regra | Implementação |
|---|---|
| OTP nunca em claro | Guardado como BCrypt hash em `otp_codes.code_hash` |
| OTP expira em 10 minutos | `expires_at` validado antes de comparar |
| OTP de uso único | `used_at` preenchido após verificação bem-sucedida |
| OTPs anteriores invalidados | `OtpCodeRepository.invalidateAllForPhone()` |
| Número mascarado nos logs | `923***000` — nunca o número completo |
| Rate limiting | A implementar via Spring Rate Limiter em `/otp/send` |

---

## Verificar saldo de créditos

```http
GET https://api.useombala.ao/v1/credits/balance
Authorization: Bearer <token>
```

Recomenda-se configurar um alerta quando o saldo baixar de um limiar
mínimo — sem créditos, os OTPs não são enviados e os utilizadores
não conseguem autenticar-se.

---

## Questões em aberto

| Questão | Impacto |
|---|---|
| Formato do número: local (`923...`) ou E.164 (`+244923...`)? | Ajustar `normalizePhone()` em `OmbalaSmsService` |
| Existe webhook de status de entrega? | Útil para logs e debugging de OTPs não entregues |
| Limite de rate da API? | Define o throttle a configurar em `/otp/send` |
