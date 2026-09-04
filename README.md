# Kubiko

> Marketplace peer-to-peer de aluguer de equipamentos em Angola.
> **Para quem precisa usar, não precisa possuir.**

A Kubiko liga quem tem equipamento parado (câmaras, drones, som, luzes, projetores, ferramentas, equipamento para eventos) a quem precisa de o usar por algumas horas, dias ou semanas — de forma simples, com contrato, caução e proteção. Foco inicial: **Luanda**, vertical de **fotografia, vídeo, áudio e eventos**.

O objetivo dos primeiros meses não é ter software bonito — é **conseguir transações reais**. North Star Metric: **nº de alugueres pagos e concluídos por mês**.

---

## Índice

- [Sobre a aplicação](#sobre-a-aplicação)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Estado atual](#estado-atual)
- [Começar (setup local)](#começar-setup-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Como trabalhamos — GitHub Flow](#como-trabalhamos--github-flow)
- [Convenção de branches](#convenção-de-branches)
- [Convenção de commits](#convenção-de-commits)
- [Pull Requests](#pull-requests)
- [Definition of Done](#definition-of-done)
- [Deploy](#deploy)
- [Equipa](#equipa)

---

## Sobre a aplicação

A aplicação web tem duas jornadas principais:

**Arrendador** (dono do equipamento) — cria conta, verifica identidade (KYC), publica equipamento, define preço (diário/semanal/mensal) e disponibilidade, recebe pedidos, acompanha alugueres e ganhos.

**Arrendatário** — procura e filtra equipamento, consulta disponibilidade e detalhes, reserva, paga, recebe o contrato, utiliza, devolve e avalia.

**Moderador** - verifica a identidade dos utilizadores e aprova transações.

Rotas principais:

| Rota                   | Descrição                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `/`                    | Landing page (hero, categorias, destaques, como funciona)                                       |
| `/itens`               | Marketplace com pesquisa e filtros (categoria, província, preço, datas)                         |
| `/itens/$id`           | Detalhe do equipamento (fotos, cobertura, disponibilidade, dono, reviews, calculadora de preço) |
| `/checkout/$id`        | Reserva e pagamento (Multicaixa Express — **atualmente simulado**)                              |
| `/publicar`            | Publicação de equipamento pelo arrendador                                                       |
| `/verificacao`         | KYC (indivíduo e empresa)                                                                       |
| `/sinistros`           | Registo e acompanhamento de sinistros                                                           |
| `/painel-arrendador`   | Dashboard do arrendador (ganhos, performance, reservas)                                         |
| `/painel-arrendatario` | Dashboard do arrendatário (alugueres ativos/passados)                                           |
| `/admin`               | Operações (verificações, aprovações, sinistros, contratos)                                      |

---

## Stack

- **[TanStack Start](https://tanstack.com/start)** — framework full-stack React
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** — UI e design system
- **Supabase/Neon/ Escolha do Dev** — auth, PostgreSQL, storage (ainda em scaffolding)
- **Recharts** — gráficos dos dashboards

---

## Estrutura do projeto

```
frontend/
├── assets/            # Ficheiros como imagense e fontes
├── routes/            # Rotas (file-based routing do TanStack Start)
├── components/        # Componentes de UI reutilizáveis (shadcn/ui + próprios)
├── lib/
│   └── marketplace.ts # ⚠️ Dados mock atuais (a substituir por Supabase)
├── hooks/             # Hooks React partilhados
├── .env               # Variaveis de ambiente (os valores devem ser excluida do commit e partilhados por outra via)
└── styles/            # Estilos globais / Tailwind

Backendend/
├── reusables/
│   └── enums          # Classes enumeraveis (ex: tipos de pagamentos)
│   └── types          # Tipos custimizados (ex: pagament)
│   └── utils          # Funções pequenas ajudantes (ex: calcular aluguel)
├── routes/            # Rotas que expoem os serviços
├── models/            # Modelos de dados
├── middleware/        # Funções que correm antes de um pedido
├── validation/        # Funções que validam dados submetidos
├── config/            # Configurações
├── .env               # Variaveis de ambiente (os valores devem ser excluida do commit e partilhados por outra via)
├── controllers/       # Funções que controlam o acesso base  de dados
└── services/          # Funções que manipulam os dados antes de serem expostos

README.md                 # Documento introdutorio a app
PULL_REQUEST_TEMPLATE.md  # Template para efectuar pull request

```

---

## Estado atual

> Ler antes de começar a contribuir.

- **Sem persistência real ainda.** Os dados vêm de `src/lib/marketplace.ts` (mock). O Supabase está preparado/scaffolded, mas ainda não é a fonte de dados.
- **Pagamento simulado.** O checkout (Multicaixa Express) valida um ID de transação de forma simulada — não há integração de pagamento real.
- **Lógica de negócio existente:** cotação de proteção (`cotacaoSeguro`), cálculo de aluguer (`calcularAluguer`) e caução. Ver `src/lib/`.
- **Prioridade do produto:** validar → transacionar → aprender. Não construir features que não aproximem de uma transação real.

---

## Começar (setup local)

**Pré-requisitos:** Node.js 20+ e npm (ou pnpm), conta Supabase (para as fases com persistência).

```bash
# 1. Clonar
git clone <URL_DO_REPO>
cd kubiko

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# preencher os valores (ver secção abaixo)

# 4. Arrancar em desenvolvimento
npm run dev
```

A app fica disponível em `http://localhost:3000` (ou a porta indicada no terminal).

---

## Variáveis de ambiente

Criar `.env.local` a partir de `.env.example`. Valores esperados (a confirmar conforme a integração avança):

```bash
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
# Server-side (nunca expor no cliente)
SUPABASE_SERVICE_ROLE_KEY=
```

> **Nunca** commitar `.env.local` nem chaves. O `.gitignore` já deve cobri-los — confirmar antes do primeiro push.

---

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run start      # servir o build
npm run lint       # linting
npm run typecheck  # verificação de tipos TypeScript
```

> Ajustar conforme o `package.json` real do projeto.

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

- Todo o trabalho entra na `main` **por PR**, usando o template `.github/PULL_REQUEST_TEMPLATE.md`.
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
