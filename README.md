# Beeznoo

> Marketplace de aluguer de equipamento em Luanda, Angola.
> **Por que comprar quando podes alugar?**

A Beeznoo (ex-Kubiko) liga quem tem equipamento parado — câmaras, drones, som, luzes, projetores, equipamento para eventos — a quem precisa de o usar por alguns dias, com **verificação de identidade, contrato e caução**. Primeiro vertical: **fotografia/vídeo e eventos**.

O objetivo do MVP é **o primeiro aluguer real, pago e concluído**. North Star: alugueres pagos e concluídos por mês.

Antes de escrever código, lê o [`CLAUDE.md`](CLAUDE.md) (como trabalhamos) e o [`SPEC.md`](SPEC.md) (o que construímos). As decisões fechadas estão em [`claude/decisoes-produto.md`](claude/decisoes-produto.md).

---

## Índice

- [Como funciona](#como-funciona)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Estado atual](#estado-atual)
- [Começar (setup local)](#começar-setup-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Como trabalhamos — GitHub Flow](#como-trabalhamos--github-flow)
- [Dados de demonstração (seed)](#dados-de-demonstração-seed)
- [Equipa](#equipa)

---

## Como funciona

```
Explorar → Detalhe → Pedido → [dono aceita: contrato gerado] → arrendatário aceita o contrato e paga
→ [equipa valida o pagamento] → Entrega (checklist) → Uso → Devolução (checklist) → [equipa decide a caução]
```

| Papel | Pode |
|---|---|
| Visitante | Explorar e ver detalhe |
| Arrendatário | Pedir reserva, aceitar contrato, pagar, registar/confirmar entrega e devolução, reportar problema |
| Dono | Publicar equipamento com fotos, aceitar/recusar pedidos, registar/confirmar entrega e devolução |
| Admin (equipa Beeznoo) | Aprovar verificações (KYC), validar pagamentos, libertar/reter caução, resolver problemas |

Verificação de identidade (KYC) é obrigatória para **pedir reserva** e **publicar**. Pagamento, verificação e problemas são **manuais** no MVP (modelo concierge).

Estados da reserva no backend: `PENDING_OWNER → ACCEPTED → ACTIVE (pago) → IN_PROGRESS (entregue) → RETURNED (devolvido) → COMPLETED`, mais `CANCELLED_RENTER`, `CANCELLED_OWNER` e `DISPUTED`.

Mapa de ecrãs e rotas do frontend: [`docs/ECRAS.md`](docs/ECRAS.md).

---

## Stack

| Camada | Tecnologia | Hosting |
|---|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · componentes próprios em `src/components/bz/` (sem shadcn) · `lucide-react` | Vercel |
| Backend | Java 21 · Spring Boot 4 · Spring Data JPA · Flyway · RabbitMQ · Testcontainers | Render |
| Base de dados | PostgreSQL (Neon em staging/produção, Docker em local) | Neon |
| Storage privado | Backblaze B2 pela API S3 (KYC, fotos, checklists, problemas) — só URLs assinadas | Backblaze |
| Email | Resend (API REST), enviado depois do commit | Resend |
| SMS (OTP) | Ombala | — |

O browser fala só com o Next; `next.config.ts` faz proxy de `/api/v1` para o Spring.

---

## Estrutura do projeto

```
api/                              # Backend Spring Boot (pacote com.beeznoo.api)
├── src/main/java/com/beeznoo/api/
│   ├── auth/  profile/  kyc/      # contas, perfil (/profiles/me), verificação de identidade
│   ├── item/                      # equipamento, categorias, fotos
│   ├── booking/  contract/        # reservas e contrato
│   ├── transaction/               # pagamentos por referência, ledger, contas
│   ├── handover/  deposit/        # checklists de entrega/devolução, cauções
│   ├── claim/                     # reportar problema
│   ├── notification/  audit/      # notificações (app + email), auditoria
│   ├── common/                    # storage (B2), formatos, erros
│   └── seed/                      # dados de demonstração (perfil "seed")
├── src/main/resources/db/migration/   # migrações Flyway V1–V15 (única fonte do schema)
└── src/test/                      # testes de integração com Testcontainers
frontend/                         # Next.js
├── src/app/                       # rotas (App Router) — ver docs/ECRAS.md
├── src/components/bz/             # design system "Identidade Verde v3"
└── src/lib/                       # cliente da API, tipos, formatos
docs/                             # design system, ecrãs, lacunas do backend, modelo de dados
claude/decisoes-produto.md        # registo de decisões (fonte de verdade)
docker-compose.yml                # Postgres + RabbitMQ + API em local
```

---

## Estado atual

- **Backend do fluxo completo do MVP feito:** autenticação (telefone + OTP, Google), perfil, KYC com documentos no B2, equipamento com fotos, reservas, contrato, pagamento por referência **simulado** (validação manual pela equipa), ledger, entrega/devolução, caução (libertar/reter parcial), reportar problema, notificações na app e por email, auditoria. Swagger em `http://localhost:8081/swagger-ui.html`.
- **Frontend:** vários ecrãs ainda mostram "Falta backend" (`BackendPending`) e estão a ser ligados à API. Estado por ecrã em [`docs/ECRAS.md`](docs/ECRAS.md); o que ainda falta na API em [`docs/BACKEND_GAPS.md`](docs/BACKEND_GAPS.md).
- **Pagamento real (EMIS/Multicaixa) ainda não existe** — a referência é simulada e o pagamento é validado à mão.
- **Vocabulário:** caução, proteção, reportar problema. Nunca "seguro", "apólice" ou "sinistro" (não existe seguradora parceira).

---

## Começar (setup local)

**Pré-requisitos:** Docker, Java 21, Node.js 20+.

```bash
# 1. Variáveis de ambiente (pede os valores à equipa — nunca no Git)
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# 2. Backend: Postgres + RabbitMQ + API em http://localhost:8081
docker compose up -d --build

# 3. Frontend em http://localhost:3000
cd frontend && npm install && npm run dev
```

A API não arranca sem as variáveis `B2_*` (storage privado). O email fica desligado até `NOTIFICATIONS_EMAIL_ENABLED=true`.

---

## Variáveis de ambiente

Lista completa e comentada em [`.env.example`](.env.example) (backend) e [`frontend/.env.example`](frontend/.env.example). As principais:

| Variável | Para quê |
|---|---|
| `DB_*`, `RABBITMQ_*` | Postgres e RabbitMQ |
| `JWT_SECRET` | assinatura dos tokens (`openssl rand -base64 64`) |
| `GOOGLE_CLIENT_ID/SECRET` | login com Google |
| `OMBALA_TOKEN`, `OMBALA_SENDER` | SMS de OTP |
| `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET`, `B2_ACCESS_KEY`, `B2_SECRET_KEY` | storage privado (obrigatório). Bucket **privado**, chave restrita a esse bucket |
| `NOTIFICATIONS_EMAIL_ENABLED`, `RESEND_API_KEY`, `RESEND_FROM` | email (só com o domínio verificado no Resend) |
| `PAYMENTS_*` | pagamento simulado; `PAYMENTS_AUTO_CONFIRM=false` em produção |
| `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | frontend |

Valores com espaços ou `<>` vão entre aspas (ex.: `RESEND_FROM="Beeznoo <noreply@beeznoo.ao>"`). **Nunca** commitar `.env` nem chaves.

---

## Scripts

```bash
# Backend (pasta api/)
./mvnw test              # testes de integração (precisa de Docker)
./mvnw spring-boot:run   # correr fora do Docker (exporta o .env antes)

# Frontend (pasta frontend/)
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run lint       # linting
npm run typecheck  # verificação de tipos
```

---

## Como trabalhamos — GitHub Flow

Usamos **GitHub Flow** (simples e rápido, ideal para uma equipa pequena que faz deploy frequente). A regra de ouro:

> **`main` está sempre estável e pronta para deploy.** Nunca se faz commit direto na `main`.

O ciclo de cada tarefa:

```
1. Partir da main atualizada
      │
2. Criar uma branch a partir da main   →  feat/nome-curto
      │
3. Trabalhar em commits pequenos e frequentes
      │
4. Push da branch para o GitHub
      │
5. Abrir Pull Request (PR) para a main
      │
6. Revisão de código (1 aprovação) + CI verde
      │
7. Merge na main (squash)  →  branch é apagada
      │
8. Deploy automático da main
```

Passos em comandos:

```bash
# 1 + 2 — sempre partir da main atualizada
git checkout main
git pull origin main
git checkout -b feat/publicar-item

# 3 — commits pequenos e com significado
git add .
git commit -m "feat(publicar): adiciona formulário de publicação de item"

# 4 — enviar a branch
git push -u origin feat/publicar-item

# 5 — abrir o PR no GitHub (usa o template)
# 6 + 7 — após aprovação e CI verde, fazer merge (squash) pela interface
# 8 — apagar a branch após merge
```

Regras:

- **Uma branch = uma tarefa/feature.** Branches curtas, vida curta (idealmente < 2–3 dias). Branches longas geram conflitos.
- **Não fazer commit/push direto na `main`.** A `main` deve estar protegida (ver "Proteção da main" abaixo).
- **Sincronizar cedo e muitas vezes:** `git pull origin main` para a tua branch antes de abrir o PR, para reduzir conflitos.
- **PR pequeno é PR bom.** PRs grandes demoram a rever e escondem bugs.

**Proteção da `main` (configurar no GitHub → Settings → Branches):**

- Exigir Pull Request antes de merge (mínimo **1 aprovação**).
- Exigir que os checks de CI passem (lint + typecheck + build).
- Proibir push direto.

---

## Convenção de branches

`tipo/descricao-curta-em-kebab-case`

| Prefixo     | Uso                              |
| ----------- | -------------------------------- |
| `feat/`     | nova funcionalidade              |
| `fix/`      | correção de bug                  |
| `chore/`    | manutenção, config, dependências |
| `refactor/` | refactor sem mudar comportamento |
| `docs/`     | documentação                     |

Exemplos: `feat/checkout-multicaixa`, `fix/calculo-caucao`, `docs/readme`.

---

## Convenção de commits

Usamos **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
tipo(escopo): descrição no imperativo e em minúsculas

feat(itens): adiciona filtro por província
fix(checkout): corrige cálculo da taxa de serviço
docs(readme): documenta o GitHub Flow
```

Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`.

Mensagens curtas, específicas e no imperativo ("adiciona", não "adicionado").

---

## Pull Requests

- Todo o trabalho entra na `main` **por PR**, usando o template `docs/PULL_REQUEST_TEMPLATE.md`.
- O título do PR segue a convenção de commits (ex.: `feat(publicar): formulário de publicação`).
- Descreve **o quê** e **porquê**, como testar, e liga a issue/tarefa (`Closes #12`).
- Pelo menos **1 aprovação** e **CI verde** antes de merge.
- Preferir **Squash and merge** (histórico limpo na `main`).
- Apagar a branch após o merge.

---

## Definition of Done

Uma tarefa só está _Done_ quando:

- [ ] Implementada de acordo com o critério de aceitação
- [ ] Revista em code review (1 aprovação)
- [ ] Testada (funcional; testes automatizados onde aplicável)
- [ ] Integrada na `main` sem conflitos
- [ ] **Responsiva** (mobile + desktop)
- [ ] Sem erros críticos nem no console
- [ ] Publicada (deploy) e verificável
- [ ] **Validada pelo Product Manager**

---

## Deploy

- A `main` faz deploy (automático via CI/CD quando configurado).
- Se um deploy partir produção, reverter primeiro (`git revert` do merge ou rollback do host), investigar depois.

---

## Dados de demonstração (seed)

Enche a BD **local** com 7 contas (todas com KYC aprovado), 14 equipamentos e 12 reservas em todos os estados — à espera do dono, aceite, com referência, paga, entregue, devolvida (caução a decidir), concluída, recusada, cancelada e com problema reportado (`api/src/main/java/com/beeznoo/api/seed/DevSeeder.java`).
Usa os serviços reais, por isso contratos, pagamentos, ledger, checklists e cauções ficam coerentes. As fotos das checklists vão para o bucket B2 configurado. Corre uma vez e sai; se já existir, não faz nada.

```bash
docker compose up -d postgres rabbitmq
cd api && set -a && . ../.env && set +a
DB_HOST=localhost SPRING_PROFILES_ACTIVE=seed ./mvnw spring-boot:run
```

Password de todas as contas: `beeznoo123` (ou a variável `SEED_PASSWORD`). **Nunca correr com o perfil `seed` em staging ou produção.**

| Telefone | Conta | Papel |
|---|---|---|
| +244 900 000 000 | Equipa Beeznoo | Admin |
| +244 900 000 001 | Edson Manuel | Dono |
| +244 900 000 002 | Luzia Kiala Produções | Dono |
| +244 900 000 003 | Paulo Neto | Aluga e é dono |
| +244 900 000 004 | Ana Domingos | Arrendatária |
| +244 900 000 005 | Mauro Fernandes | Arrendatário |
| +244 900 000 006 | Telma Sebastião | Arrendatária |

---

## Equipa

| Pessoa | Papel |
|---|---|
| Parcídio André | Founder / Product Manager |
| Victor | Backend |
| Melzira | Frontend |
| Designer freelancer | Identidade, assets, criativos |

Sprints semanais: segunda planning · terça–quinta execução · sexta demo, métricas e retro.
