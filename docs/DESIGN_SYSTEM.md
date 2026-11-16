# Design System — Identidade Verde v4 · "Colmeia em movimento"

**Versão:** 4.0 · **Data:** 2026-11-16 · **Estado:** ⚑ a validar pelo André (ver `claude/decisoes-produto.md`, 2026-11-16)
**Substitui:** v3 (2026-10-17). Paleta, fontes, raios e vocabulário mantêm-se; a v4 acrescenta profundidade, movimento e
3D leve, e leva a linguagem da nova landing a toda a app.
**Referência visual:** canvas "Beeznoo — Nova landing page" no Claude Design (landing + ecrãs da app).

---

## 1. Princípios

1. **Confiança primeiro, espetáculo depois.** Cada ecrã responde "porque é seguro avançar?" antes de impressionar.
2. **Próximo passo sempre visível.** Em cada reserva há um `NextStepCard` no topo: o que falta, quem age, até quando.
3. **Movimento que explica.** Na app, uma animação existe para mostrar que algo apareceu, mudou de estado ou avançou.
   Na landing pode encantar — com moderação e sempre com `prefers-reduced-motion`.
4. **Profundidade com significado.** O 3D marca o que é "objeto" (telemóvel, bilhete da reserva, hexágonos da marca).
   Listas, formulários e texto ficam planos.
5. **Feito para a rua.** Android de gama média, sol, rede fraca: contraste AA, alvos ≥ 44px, pouco peso.

## 2. Cor

Proporção: **70% areia · 20% verde · 10% âmbar**.

| Token                | Hex                   | Uso                                                                           |
| -------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `ambar`              | `#F0A22E`             | Botão principal (um por ecrã), hexágonos decorativos, foco                    |
| `ambar-hover`        | `#E08F17`             | Hover/pressed do principal                                                    |
| `ambar-tint`         | `#FDF0DC`             | Fundo de prazos e avisos                                                      |
| `aviso-texto`        | `#7A4A0B`             | Texto sobre `ambar-tint`                                                      |
| `verde`              | `#0E2A1F`             | Títulos, texto forte, **fundos escuros** (hero, confiança, rodapé, cabeçalho) |
| `verde-medio`        | `#1F5C42`             | Estados positivos, bloco de CTA secundário                                    |
| `areia`              | `#FAF6EF`             | Fundo base                                                                    |
| `areia-2`            | `#F3E9D8`             | Secções alternadas, placeholder de foto, segmented control                    |
| `branco`             | `#FFFFFF`             | Cartões, campos                                                               |
| `mel`                | `#B76E12`             | Ícones decorativos (nunca texto pequeno)                                      |
| `mel-texto`          | `#9A5C0E`             | Links, eyebrows sobre fundo claro                                             |
| `salvia`             | `#8FC0A8`             | Selo, **texto de destaque sobre verde**, eyebrows sobre fundo escuro          |
| `salvia-tint`        | `#E3F0E9`             | Fundo do selo "Verificado", badges positivos, texto corrido sobre verde       |
| `texto-corpo`        | `#2C3A33`             | Texto corrido                                                                 |
| `cinza`              | `#5E6B64`             | Metadados                                                                     |
| `borda`              | `#E1E5DB`             | Bordas de cartões                                                             |
| `borda-forte`        | `#B9C2B5`             | Campos, chips, botões secundários                                             |
| `erro` / `erro-tint` | `#B3261E` / `#FBEAE8` | Erros, recusar, reportar problema                                             |
| `skeleton`           | `#ECE6DA`             | Carregamento                                                                  |

**Regras**

- Branco sobre âmbar é proibido (2,1:1). Âmbar leva sempre texto `verde` (7,2:1).
- Sobre `verde`: títulos `#FFFFFF`, corpo `salvia-tint`, destaque `salvia`. Nunca âmbar em texto.
- Pares de estado: prazo → `ambar-tint` + `aviso-texto` · positivo → `salvia-tint` + `verde-medio` · erro → `erro-tint`
  - `erro` · neutro → `areia-2` + `verde`.
- Estado nunca só por cor: ícone + texto.

## 3. Tipografia

| Papel                          | Fonte                              | Desktop / Mobile                                       |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------ |
| Display (hero)                 | Bricolage Grotesque 800            | 76 / 42, `line-height 1.02`, `letter-spacing -0.025em` |
| Título de secção               | Bricolage 700                      | 52 / 34                                                |
| Título de ecrã (app)           | Bricolage 700                      | 32 / 26                                                |
| Título de cartão / equipamento | Bricolage 700                      | 18–20                                                  |
| Preço / montante               | Bricolage 700, `tabular-nums`      | 22–26                                                  |
| Corpo                          | DM Sans 400                        | 16 / **15 mínimo**                                     |
| Label                          | DM Sans 500                        | 14                                                     |
| Legenda                        | DM Sans 400                        | 13                                                     |
| Eyebrow                        | DM Sans 700, maiúsculas, `+0.12em` | 12                                                     |

## 4. Forma, espaço, profundidade

- Raios: `radius-sm` **12px** (botões, campos, tiles) · `radius-md` **16px** (cartões) · `radius-lg` **24px**
  (painéis, sheets, blocos escuros, cartão do formulário) · `pill` (badges, chips, avatar).
- Espaçamento em múltiplos de 4 (4, 8, 12, 16, 24, 32, 48, 56, 120). Margem lateral 16px mobile / 48px desktop.
  Secções da landing: 120px desktop / 80px mobile.
- Cartões: borda `borda`, **sem sombra**.
- Sombras (só elementos que flutuam):
  - `shadow-float`: `0 24px 50px -18px rgba(0,0,0,.55)` — cartões flutuantes de marketing sobre verde.
  - `shadow-bar`: `0 -8px 24px rgba(14,42,31,.12)` — `StickyCTABar`.
  - `shadow-sheet`: `0 -12px 40px rgba(14,42,31,.18)` — sheets e `<dialog>`.
- Alvos de toque ≥ 44px; botão principal 48px (52px no formulário final).

## 5. Logo

- Símbolo: **hexágono âmbar de vértice para cima com três faixas verdes horizontais** (as "camadas" da colmeia).
  SVG de referência (512×512): polígono `256,34 450,147 450,371 256,478 62,371 62,147` em `#F0A22E`; faixas
  `x=62 w=388 h=42` em `y=161 / 238 / 315`, cor `#0E2A1F`.
- Palavra: `beeznoo` em minúsculas, Bricolage 800. Sobre verde: `#FAF6EF`; sobre areia: `#0E2A1F`.
- Área livre = ½ da altura do símbolo. Tamanho mínimo: 24px de símbolo. Não rodar, esticar, recolorir nem pôr sombra.
- Ficheiros: `frontend/public/png/beeznoo-icon-512.png` (+ exportar `beeznoo-icon.svg`).

## 6. Movimento

### Tokens

```css
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1); /* entradas, hover */
--ease-in-out: cubic-bezier(0.6, 0, 0.4, 1); /* progresso, trocas */
--ease-pop: cubic-bezier(0.2, 1.4, 0.4, 1); /* confirmações (check) */
--dur-fast: 200ms; /* hover, cor, foco */
--dur-base: 350ms; /* cartões, separadores, sheets */
--dur-slow: 600ms; /* entradas de secção, sucesso */
```

### Padrões

| Padrão                | Onde                                                      | Como                                                                   |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Linha a linha**     | Títulos do hero                                           | Cada linha sobe 105% → 0, 900ms, atraso 120ms entre linhas             |
| **Traço desenhado**   | Palavra de destaque                                       | SVG `stroke-dashoffset` 520 → 0, 1,2s, âmbar                           |
| **Aparecer ao rolar** | Secções da landing                                        | `animation-timeline: view()` com `@supports`; sem suporte fica visível |
| **Levantar**          | Cartões clicáveis                                         | `translateY(-4px)` a `-6px`, borda escurece, 350ms                     |
| **Inclinação 3D**     | Cartões de categoria, mockups                             | `rotateX(6deg) rotateY(-8deg)` no hover; **só com `(hover: hover)`**   |
| **Hexágono a virar**  | `HexTile` em passos e confiança                           | `rotateY(180deg)` no hover, ícone contra-roda                          |
| **Hexágonos 3D**      | Hero, blocos escuros (landing)                            | 5 camadas com `translateZ` e brilho decrescente, rotação 6–16s         |
| **Faixa a deslizar**  | Marquee de equipamento                                    | `translateX(-50%)` 38s linear, pausa no hover                          |
| **Timeline viva**     | Timeline de 6 passos                                      | Preenchimento `scaleX` + pontos acendem em sequência                   |
| **Check de sucesso**  | Lista de espera, "Pedido enviado", "Pagamento confirmado" | Círculo `salvia-tint` com `--ease-pop`, 600ms                          |
| **Skeleton**          | Listas a carregar                                         | Brilho 1,4s; `role="status"`                                           |

### Regras da app (não da landing)

- Nada de animação infinita em listas nem em ecrãs de trabalho (Explorar, Reservas, Pedidos, Admin).
- Sem parallax nem inclinação por rato/giroscópio no telemóvel.
- Uma animação contínua por ecrã no máximo (ex.: contagem de prazo).
- Animar só `transform` e `opacity`.
- `@media (prefers-reduced-motion: reduce)` desliga tudo, mostrando o estado final.

## 7. 3D

- Só CSS: `perspective` (1000–1400px), `transform-style: preserve-3d`, `translateZ`. Sem WebGL/three.js na app.
- Objetos 3D da marca: **telemóvel** (landing), **bilhete da reserva** (`BookingTicket`, leve inclinação que endireita
  ao tocar), **hexágonos** (decoração), **mockups** de valores na landing.
- Espessura falsa: 2–5 camadas atrás com `translateZ(-3px…-14px)` e cor mais escura.

## 8. Componentes (em `frontend/src/components/bz/`)

Existentes da v3 mantêm-se. Novos ou alterados na v4:

| Componente         | O que é                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`           | `primary` (âmbar, texto verde) · `secondary` (contorno `borda-forte`) · `on-dark` (contorno areia) · `ghost` · `danger`. Raio 12, altura 48, ícone `ArrowRight` que desliza 4px no hover |
| `AppHeader`        | Claro na app (areia + borda); **escuro translúcido** (`verde` 82% + blur 14px) na landing                                                                                                |
| `HexTile`          | Ícone dentro de hexágono (`clip-path`), 40–56px. Fundo `verde` com ícone âmbar, ou `salvia` com ícone verde                                                                              |
| `NextStepCard`     | `ambar-tint` + relógio + "Próximo passo" + ação e prazo; em positivo `salvia-tint`                                                                                                       |
| `Timeline`         | 6 passos: pedido → aceite → pago ao dono → entregue → devolvido → caução devolvida                                                                                                       |
| `BookingTicket`    | Cartão da reserva com recorte lateral (bilhete), código, datas e equipamento                                                                                                             |
| `PriceSummary`     | Linhas: aluguer, taxa de serviço 8%, caução **reembolsável** (badge), total "Pagas ao dono na entrega"                                                                                   |
| `SegmentedControl` | Fundo `areia-2`, raio 14, opção ativa `verde` com texto areia; `aria-pressed`                                                                                                            |
| `DeadlineChip`     | Normal → urgente (< 3 h) → expirado, sempre ícone + texto                                                                                                                                |
| `VerifiedBadge`    | Pill `salvia-tint` + check + "Verificado"                                                                                                                                                |
| `EquipmentCard`    | Foto 4:3, nome Bricolage, bairro, selo, preço/dia; hover levanta (desktop)                                                                                                               |
| `CategoryChip`     | Pill com ícone; ativa = `verde` + ícone âmbar                                                                                                                                            |
| `StickyCTABar`     | Barra fixa no telemóvel com o único botão âmbar e `shadow-bar`                                                                                                                           |
| `SuccessCheck`     | Círculo `salvia-tint` com check animado                                                                                                                                                  |
| `EmptyState`       | Hexágono `areia-2` + ícone + frase + uma ação                                                                                                                                            |
| `Footer` (landing) | Fundo `verde`, 3 colunas de links, redes em tiles 44px, palavra `beeznoo` gigante em contorno                                                                                            |

## 9. Copy (resumo — regras completas no CLAUDE.md §8)

- PT-PT com "tu". Botões com verbo: "Pedir reserva", "Confirmar que recebi", "Devolver caução".
- Pagamento (2026-11-15): "Pagas ao dono na entrega", "Confere o equipamento antes de pagar", "Nunca pagues antes do
  encontro", "O dono devolve-te a caução". **Nunca** "a Beeznoo guarda o pagamento/a caução".
- Proibido: seguro, apólice, sinistro, segurado, cobertura.
- Kz com ponto de milhares, sempre inteiros: `218.400 Kz`. Datas curtas: "23 a 25 out".

## 10. Tokens para `globals.css` (Tailwind v4)

```css
@theme {
  --color-ambar: #f0a22e;
  --color-ambar-hover: #e08f17;
  --color-ambar-tint: #fdf0dc;
  --color-aviso-texto: #7a4a0b;
  --color-verde: #0e2a1f;
  --color-verde-medio: #1f5c42;
  --color-areia: #faf6ef;
  --color-areia-2: #f3e9d8;
  --color-mel: #b76e12;
  --color-mel-texto: #9a5c0e;
  --color-salvia: #8fc0a8;
  --color-salvia-tint: #e3f0e9;
  --color-texto-corpo: #2c3a33;
  --color-cinza: #5e6b64;
  --color-borda: #e1e5db;
  --color-borda-forte: #b9c2b5;
  --color-erro: #b3261e;
  --color-erro-tint: #fbeae8;
  --color-skeleton: #ece6da;

  --font-titulo: "Bricolage Grotesque", system-ui, sans-serif;
  --font-corpo: "DM Sans", system-ui, sans-serif;

  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;

  --shadow-float: 0 24px 50px -18px rgb(0 0 0 / 0.55);
  --shadow-bar: 0 -8px 24px rgb(14 42 31 / 0.12);
  --shadow-sheet: 0 -12px 40px rgb(14 42 31 / 0.18);

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.6, 0, 0.4, 1);
  --ease-pop: cubic-bezier(0.2, 1.4, 0.4, 1);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

## 11. Changelog

| Data       | Mudança                                                                                                                                            | Porquê                                                         | Impacto no código                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-11-16 | v4: movimento (tokens + padrões), 3D em CSS, `HexTile`, `SegmentedControl`, `SuccessCheck`, rodapé escuro, cabeçalho escuro translúcido na landing | Landing parecia amadora; pedido de motion, 3D e mais confiança | Novos tokens em `globals.css`; componentes novos em `bz/`; landing reescrita |
| 2026-11-16 | Texto de destaque sobre verde passa a `salvia`                                                                                                     | Âmbar fica reservado ao botão principal                        | Trocar classes de destaque na landing                                        |
| 2026-11-16 | Timeline: "pago" → "pago ao dono"; "caução libertada" → "caução devolvida"                                                                         | Pagamento direto ao dono (2026-11-15)                          | Labels da `Timeline`                                                         |
| 2026-11-16 | Logo: hexágono com três faixas documentado como SVG                                                                                                | Faltava especificação vetorial                                 | Exportar `beeznoo-icon.svg`                                                  |
