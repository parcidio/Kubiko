# CLAUDE.md — Beeznoo

Guia para o Claude (e para qualquer pessoa nova no repo). Lê isto antes de escrever código.
Para *o quê* construir, ver `SPEC.md`. Este ficheiro diz *como*.

> **Nome:** o produto chama-se **Beeznoo** (ex-Kubiko, ex-Beezno). O nome está congelado (domínio `beeznoo.ao`, Instagram `@beeznoo`). Em código novo, UI e textos usa sempre "Beeznoo". O slug do repo (`parcidio/kubiko`) e alguns nomes antigos ainda não foram renomeados — não os alteres sem pedido explícito.

---

## 1. O que é

Marketplace de aluguer de equipamento em Luanda, Angola. Primeiro vertical: **fotografia/vídeo e eventos**. Slogan: *"Por que comprar quando podes alugar?"* O nome vem de *business* (beezno), não de abelha.

Objetivo do MVP: **o primeiro aluguer real pago e concluído** — não parecer uma grande startup. North Star: alugueres pagos e concluídos por mês.

## 2. Equipa

| Pessoa | Papel |
|---|---|
| Parcídio André | Founder / Product Manager — decide produto, prioridades e trade-offs |
| Victor | Backend (42 Luanda) |
| Melzira | Frontend (42 Luanda) |
| Designer freelancer | Identidade, assets, criativos |

Sprints semanais: segunda planning · terça–quinta execução · sexta demo, métricas, retro.

## 3. Regras de trabalho (não negociáveis)

1. **Nenhuma feature sem hipótese de negócio, utilizador-alvo e critério de sucesso.** Se um pedido não os tem, pergunta antes de construir.
2. **Manual antes de automatizar.** Pagamento, verificação e resolução de problemas são manuais no MVP. Não construas automação para isso sem decisão do PM.
3. **Documentação primeiro.** Decisões de arquitetura/schema escrevem-se em `claude/decisoes-produto.md` *antes* da implementação. Esse ficheiro é a fonte de verdade.
4. **Explica antes de executar.** Descreve o passo e pede confirmação em ações destrutivas, migrações em produção ou qualquer coisa com segredos.
5. **Apresenta trade-offs.** Em decisões em aberto, dá opção A vs B com consequências; o André decide.
6. **Desafia ideias fracas.** Se algo é caro, prematuro ou arriscado, diz "Não recomendo isto", explica e propõe alternativa.
7. Idioma: **português de Portugal**, tratamento por "tu" na UI. Código, nomes de variáveis e commits em inglês.

## 4. Stack

| Camada | Tecnologia | Hosting |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4, componentes próprios em `src/components/bz/` (sem shadcn), `lucide-react` para ícones | Vercel (preview por PR) |
| Backend | Spring Boot (Java) + PostgreSQL + RabbitMQ · Flyway (migrações) · Testcontainers (testes) | Render |
| Base de dados | Neon (Postgres serverless, com branching) | Neon |
| Storage privado | Backblaze B2 pela API S3 (AWS SDK v2) — KYC, fotos, checklists, problemas | Backblaze |
| Email | Resend (API REST via `RestClient`) | Resend |

**Mudança de stack (2026-09-16):** o backend passou de Supabase para Spring Boot. Consequência: autenticação, autorização por linha (antes RLS) e armazenamento de ficheiros são construídos no Spring.

> ⚠️ **A confirmar com o André:** algumas notas antigas ainda descrevem o repo como `frontend/` + `supabase/`. Se encontrares código ou CI de Supabase, pergunta se é para remover antes de lhe mexer.

### Notas de backend
- `spring.jpa.hibernate.ddl-auto: validate` — o schema vem **só** das migrações Flyway, nunca do Hibernate.
- Neon: usar a connection string **pooled** e ligações Hikari de vida curta (o Neon fecha ligações inativas).
- Pacotes Java organizados por domínio: `auth`, `profile`, `item`, `booking`, `contract`, `transaction`, `handover`, `deposit`, `kyc`, `claim`, `notification`, `audit`, `review`, `security`, `common`.
- Usa branches do Neon para testar migrações antes de staging/produção.
- **Migrações aplicadas: V1–V18.** Nunca editar nem renumerar uma migração já aplicada — cada mudança é uma nova (próxima: V19).
- **Estados da reserva:** `PENDING_OWNER → ACCEPTED → ACTIVE (pago) → IN_PROGRESS (entregue) → RETURNED (devolvido) → COMPLETED`, mais `CANCELLED_RENTER`, `CANCELLED_OWNER`, `DISPUTED`. Recusar = o dono faz `cancel` a um pedido `PENDING_OWNER`.
- **"Verificado"** = KYC aprovado (`KycService.isVerified`). `profiles.is_verified` é o **telefone** confirmado — não confundir.
- **Ficheiros:** validar com `UploadedFiles.validate(...)` (tipo pelos bytes, 5 MB) e ligar à transação com `StorageTransactions.deleteOnRollback(...)` / `deleteAfterCommit(...)`. A `storage_key` nunca sai em DTOs nem logs — só URLs assinadas.
- **Auditoria:** ações sensíveis de admin chamam `AuditService.record(...)` na mesma transação (`audit_logs` é append-only).
- **Notificações:** chamar `NotificationService.<evento>(...)` dentro do serviço de domínio. O email sai **depois do commit** e em segundo plano — nunca fazer HTTP externo dentro da transação de negócio.
- Spring Boot 4 não cria `RestClient.Builder` automaticamente: usar `RestClient.builder()`.
- Taxa de serviço: `ServiceFees.of(...)`. Formatos de Kz e datas para copy: `common.util.Formats`.

### Notas de frontend
- **Mobile-first**: desenhar a 360px (Android de gama média, rede instável), depois desktop a 1280px.
- **Sem shadcn/ui nem outras bibliotecas de UI** (decisão 2026-10-17). Usa os componentes de `src/components/bz/` e HTML nativo (`<dialog>`, `<input type="date">`). A acessibilidade é nossa: foco visível, teclado, ARIA.
- O browser fala só com o Next; `next.config.ts` faz proxy de `/api/v1` para o Spring (sem CORS).
- Mapa de ecrãs e divisão de trabalho: `docs/ECRAS.md`. O que falta na API: `docs/BACKEND_GAPS.md`.
- Dados mock antigos em `src/lib/marketplace.ts` (páginas `/items`, `/arrendador`, `/arrendatario`) — a substituir pela API.

## 5. Repositório e fluxo Git

- Monorepo privado `parcidio/kubiko`, branch `main` protegida.
- Branches: `feature/<tarefa>` e `fix/<bug>`. **Sem GitFlow.**
- PR com **review cruzado obrigatório** (frontend revê backend e vice-versa onde fizer sentido).
- CI em GitHub Actions bloqueia o merge se falhar: lint, typecheck, testes, build e validação de migrações.
- Ambientes: staging e produção, separados.

### Definition of Done
Implementado · revisto · testado · integrado · responsivo · sem erros críticos · publicado · validado pelo PM.

## 6. Segurança (crítico: KYC + pagamentos)

- **Nunca** commits de segredos. `.env` fora do Git; só `.env.example` com chaves vazias.
- Documentos de identidade (BI, selfie, NIF) e comprovativos de pagamento: armazenamento privado, acesso só por URL assinada de curta duração, nunca públicos.
- Toda a autorização no backend verifica dono/papel por recurso (`owner`, `renter`, `admin`). Nunca confies no frontend.
- Ações sensíveis (aprovar KYC, validar pagamento, libertar/reter caução) geram registo em `audit_logs`.
- Não escrevas números de BI, NIF ou referências de pagamento em logs.
- **OWASP Top 10:2025** — mapa de controlos, limites de pedidos e configuração por ambiente em `docs/SEGURANCA.md`. Ao criar um endpoint:
  autorização por recurso no serviço, DTO com `@Valid` e limites de tamanho, erros 4xx (nunca 500 por input do cliente),
  nada de segredos, tokens ou códigos em URLs ou logs, e ver se precisa de limite em `RateLimitFilter`.
- Segredos sem valor por omissão: a API não arranca sem `JWT_SECRET` (≥ 32 bytes) nem `B2_*`.
- Migrações aplicadas: V1–V18 (próxima: V19).

## 7. Design — "Identidade Verde v3"

Fonte de verdade: **`docs/DESIGN_SYSTEM.md`** (tokens, tipografia, componentes, movimento). Tokens em `frontend/src/app/globals.css`.
Resumo do que não pode falhar:

- Paleta areia / verde / âmbar. **Um botão âmbar por ecrã**, texto verde por cima (branco sobre âmbar é proibido). `mel` nunca em texto pequeno — usa `mel-texto`.
- Bricolage Grotesque (`font-titulo`) em títulos, nomes de equipamento e montantes; DM Sans (`font-corpo`) no resto. Corpo ≥ 15px no telemóvel.
- Raios 12 / 16 / 24px. Cartões com borda e sem sombra; sombra só no que flutua (sheets, barra de CTA, preço sobre foto).
- Motivos de marca: colmeia (hexágonos), reserva como bilhete (`BookingTicket`), próximo passo sempre visível (`NextStepCard`).
- Mobile-first a 360px, alvos ≥ 44px, ícones Lucide de traço, nada de emoji.
- Explorar, Reservas, Pedidos, Equipamento e filas do Admin têm sempre **vazio**, **a carregar** (`role="status"`) e **erro** ("Tentar outra vez").
- Ecrã sem endpoint mostra `BackendPending` — nunca finge que guardou.

## 8. Vocabulário e copy

- **Usa:** caução, proteção, reportar problema, verificado, em análise.
- **Nunca:** "seguro", "apólice", "sinistro", "segurado", "cobertura" — não existe seguradora parceira. Isto aplica-se a UI, nomes de rotas visíveis, emails e criativos.
- Tom direto e concreto: kwanzas, datas e equipamento com nome ("Sony A7 III, 16 a 18 out, 331.000 Kz"). Uma ideia por ecrã.
- Moeda: `Kz`, separador de milhares `.` (ex.: `25.000 Kz`). Valores guardados em **inteiros** (kwanzas), nunca float.

## 9. Coisas a NÃO construir agora

App mobile nativa, chat interno, IA/recomendações, mapas avançados, loyalty, pricing algorítmico, automação de pagamentos, pipeline automático de reclamações, emissão de "apólices", integração com API da AGT. Se te pedirem, aponta para `SPEC.md` §9 e pergunta se a decisão mudou.

## 10. Referências

- `SPEC.md` — especificação funcional do MVP.
- `claude/decisoes-produto.md` — registo de decisões (fonte de verdade).
- `docs/DESIGN_SYSTEM.md`, `docs/ECRAS.md`, `docs/BACKEND_GAPS.md`, `docs/DB-MODEL.md` (schema atual), `docs/SEGURANCA.md` (OWASP).
- Swagger da API em local: `http://localhost:8081/swagger-ui.html`.
- `Beeznoo — App v2.html` (raiz): exportação do Claude Design que serviu de ponto de partida (substituída pela v3).
- Roadmap de 24 semanas: `Kubiko_Roadmap_Startup.pdf`.
