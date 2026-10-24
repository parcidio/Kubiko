# Beeznoo — Design system "Identidade Verde v3"

Substitui o antigo `DESIGIN_SYSTEM.md` (v1/v2, baseado em shadcn). Decisão: `claude/decisoes-produto.md` (2026-10-17).
Código: `frontend/src/components/bz/` · Tokens: `frontend/src/app/globals.css` (bloco `@theme` "Identidade Verde v3").

> **Ideia em 3 palavras:** quente, confiável, com ritmo.
> A Beeznoo é uma app de rua: abre-se no telemóvel, ao sol, com rede fraca, para tratar de dinheiro e de equipamento caro.
> O visual tem de transmitir **confiança** (verde profundo, números grandes e claros) e **energia** (âmbar, colmeia, movimento curto).

---

## 1. Princípios

1. **Próximo passo sempre visível.** Cada reserva mostra um `NextStepCard`: o que falta, quem age e até quando.
2. **A reserva é um bilhete.** O `BookingTicket` (verde escuro, recortes laterais, linha picotada, código `BZ-XXXXXX`) é a peça de identidade da app.
3. **Números são heróis.** Preços, montantes e prazos em Bricolage 800, grandes, com `tabular-nums`.
4. **Um botão âmbar por ecrã.** O resto é verde, contorno ou texto.
5. **Colmeia como assinatura.** Hexágonos no padrão de fundo dos heróis, no `ConditionMeter`, nos nós da `Timeline` e nas ilustrações de estado vazio. Nunca como decoração gratuita em cima de conteúdo.
6. **Mobile-first a 360px**, desktop a 1280px. Corpo ≥ 15px, alvos ≥ 44px, foco sempre visível.
7. **Honestidade.** Ecrã sem backend mostra o aviso `BackendPending`; nunca finge que guardou.

## 2. Cor

Proporção: 60% areia · 25% verde · 10% âmbar · 5% estados.

| Token (Tailwind) | Hex | Uso |
|---|---|---|
| `ambar` | `#F0A22E` | Botão principal (texto **verde**), destaques sobre verde escuro |
| `ambar-hover` | `#E08F17` | Hover/pressed |
| `ambar-tint` | `#FDF0DC` | Prazos, esperas |
| `aviso-texto` | `#7A4A0B` | Texto sobre `ambar-tint` |
| `verde-noite` | `#081A13` | Fundo do herói, câmara da checklist |
| `verde` | `#0E2A1F` | Títulos, texto forte, bilhete, cabeçalhos escuros |
| `verde-medio` | `#1F5C42` | Positivo: aceite, pago, caução libertada |
| `areia` | `#FAF6EF` | Fundo base |
| `areia-2` | `#F3E9D8` | Callouts, placeholder de foto, chips inativos |
| `branco` | `#FFFFFF` | Cartões, campos |
| `mel` | `#B76E12` | Ícones decorativos (nunca texto pequeno) |
| `mel-texto` | `#9A5C0E` | Links |
| `salvia` / `salvia-tint` | `#8FC0A8` / `#E3F0E9` | Verificado, confiança |
| `texto-corpo` | `#2C3A33` | Texto corrido |
| `cinza` | `#5E6B64` | Metadados |
| `borda` / `borda-forte` | `#E1E5DB` / `#B9C2B5` | Bordas de cartão / campos |
| `erro` / `erro-tint` | `#B3261E` / `#FBEAE8` | Erros, recusar, reportar problema |
| `skeleton` | `#ECE6DA` | Carregamento |

Regras de contraste: âmbar só com texto verde (7,2:1). Sobre `verde`/`verde-noite` usa `areia` (texto) e `ambar` (destaque, 7,5:1). `mel` falha AA em texto pequeno → usa `mel-texto`.

## 3. Tipografia

| Papel | Fonte | Tamanho mobile / desktop |
|---|---|---|
| Display (herói, montantes grandes) | Bricolage Grotesque 800, tracking −0.03em | 34 / 52 |
| Título de ecrã | Bricolage 700 | 26 / 34 |
| Título de cartão, nome de equipamento | Bricolage 700 | 18 |
| Preço | Bricolage 800, `tabular-nums` | 22 (cartão) · 40 (resumo) |
| Corpo | DM Sans 400 | 15 / 16 |
| Label | DM Sans 500 | 14 |
| Legenda | DM Sans 400 | 13 |
| Etiqueta | DM Sans 700, maiúsculas, +0.1em | 12 |

Utilitários: `font-titulo` (Bricolage), `font-corpo` (DM Sans), `num` (tabular).

## 4. Forma, profundidade e espaço

- Raios: `rounded-campo` 12px (botões, campos, chips) · `rounded-cartao` 16px (cartões, fotos) · `rounded-sheet` 24px (sheets, herói) · `rounded-full` (badges, avatares).
- Profundidade: cartões **com borda e sem sombra**. Sombra só no que flutua: `shadow-flutua` (sheets, preço sobre foto, toasts) e `shadow-cta` (barra fixa).
- Espaço em múltiplos de 4. Margem lateral 16px (mobile) / 48px (desktop). Largura máx. de conteúdo 1152px; formulários 640px.

## 5. Movimento

Curto e útil — nunca decorativo em loop.

| Nome | Uso | Duração / easing |
|---|---|---|
| `animate-sobe` | Entrada de conteúdo e cartões | 280ms `cubic-bezier(.2,.8,.2,1)` |
| `animate-sheet` | Abrir sheet de baixo | 320ms mesma curva |
| `animate-pulso` | Ponto "ao vivo" no DeadlineChip urgente | 1.6s, só em urgente |
| `animate-aparece` | Elementos que surgem no lugar (escala .96 → 1) | 320ms mesma curva |
| `animate-estrela` | Estrela escolhida ao avaliar | 360ms com ressalto |
| `skeleton-brilho` | Skeleton: brilho a passar em vez de piscar | 1.4s, só enquanto carrega |
| Foto do cartão | `group-hover:scale-105` dentro da moldura | 500ms ease-out |
| Toque | `active:scale-[.98]` em botões e cartões | 120ms |

Tudo desliga com `prefers-reduced-motion`.

## 6. Componentes (`src/components/bz/`)

| Ficheiro | Componentes |
|---|---|
| `ui.tsx` | `Button`, `ButtonLink`, `IconButton`, `Badge`, `Callout`, `Card`, `Skeleton`, `Spinner`, `Kz`, `SectionTitle`, `BackLink` |
| `form.tsx` | `Field`, `TextField`, `TextArea`, `SelectField`, `PhoneField`, `PasswordField`, `OtpField`, `MoneyField`, `Checkbox`, `RadioCards`, `ChipGroup`, `StepProgress`, `FormError` |
| `overlay.tsx` | `Sheet` (`<dialog>` nativo: sheet no telemóvel, modal no desktop), `Toaster` + `toast()` |
| `tabs.tsx` | `Segmented` (separadores com `role="tablist"`) |
| `brand.tsx` | `Logo`, `HexPattern`, `HexIllustration`, `CategoryIcon` |
| `shell.tsx` | `AppShell`, `TopBar`, `BottomNav`, `ModeSwitch`, `OfflineBanner`, `StickyCTA`, `PageHeader` |
| `states.tsx` | `EmptyState`, `ErrorState`, `ListSkeleton`, `GridSkeleton`, `BackendPending` |
| `equipment.tsx` | `ItemPhoto`, `EquipmentCard` (destaque, avaliação, nº de alugueres), `Stars`, `RatingInline`, `ConditionMeter`, `VerifiedBadge`, `Avatar`, `CategoryTile` |
| `booking.tsx` | `BookingTicket`, `NextStepCard`, `DeadlineChip`, `Timeline`, `PriceSummary`, `BookingRow`, `RequestCard`, `bookingCode()` |
| `photo.tsx` | `PhotoPicker`, `CameraGuide` |
| `discover.tsx` | `Rail` (faixa horizontal, só aparece com itens), `TrustStrip`, `QuickSearches`, `PublishPromo`, `ReviewsSection` |

### Estados obrigatórios
Explorar, Reservas, Pedidos, Equipamentos e filas do Admin têm sempre: **vazio** (`EmptyState` + uma ação), **a carregar** (skeleton com a forma do conteúdo, `role="status"`) e **erro** (`ErrorState` com "Tentar outra vez").

## 7. Vocabulário e copy

- **Usa:** caução, proteção, reportar problema, verificado, em análise.
- **Nunca:** seguro, apólice, sinistro, segurado, cobertura.
- PT-PT, "tu". Kz com ponto nos milhares (`25.000 Kz`), datas curtas ("16 a 18 out"). Botões com verbo ("Pedir reserva", "Copiar referência", "Já paguei").

## 8. Ícones e imagem

Lucide (`lucide-react`), traço 1.8, 20–24px. Sem emoji. Fotos 4:3 com `rounded-cartao`; sem foto → `areia-2` + ícone da categoria.

## Changelog

| Data | O quê | Porquê | Impacto no código |
|---|---|---|---|
| 2026-10-24 | Explorar com faixas (Em destaque, Mais alugados, Mais bem avaliados), faixa de confiança, pesquisas rápidas e convite a publicar; herói mais baixo e grelha mais compacta | O ecrã parecia vazio; prova social real ajuda a confiar num desconhecido | `discover.tsx`, `explorar/page.tsx` |
| 2026-10-24 | Cartão de equipamento com etiqueta "Em destaque", estrelas e nº de alugueres ("Novo na Beeznoo" sem avaliações) | Mostrar dados reais da API (#21), nunca números inventados | `EquipmentCard`, `ItemSummary.categorySlug` para o ícone sem foto |
| 2026-10-24 | Detalhe: galeria fixa no desktop, pontos e miniaturas, avaliações, "Mais em {categoria}", botão de destaque para admin | Menos espaço morto ao lado do resumo; avaliações onde se decide | `equipamento/[id]/page.tsx` |
| 2026-10-24 | Skeleton com brilho; tokens `animate-aparece` e `animate-estrela`; utilitário `faixa` | Carregamento menos agressivo e movimento curto e útil | `globals.css`, `Skeleton` |
