"use client";

import { useState } from "react";
import { Banknote, Search, Bookmark, Calendar, ChevronDown } from "lucide-react";

const CATEGORIAS = [
  "Fotografia", "Vídeo", "Áudio", "Eventos",
  "Ferramentas", "Eletrónica", "Mobiliário", "Veículos",
];

// ── Exportado para usar em Arrendatario e BeeznoItems ─────────
export type Filters = {
  pesquisa:   string;
  categorias: string[];
  precoMin:   string;
  precoMax:   string;
  dataInicio: string;
  dataFim:    string;
};

export const EMPTY_FILTERS: Filters = {
  pesquisa: "", categorias: [],
  precoMin: "", precoMax: "",
  dataInicio: "", dataFim: "",
};

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function buildChips(f: Filters): string[] {
  const chips: string[] = [];
  if (f.pesquisa) chips.push(`"${f.pesquisa}"`);
  f.categorias.forEach(c => chips.push(c));
  if (f.precoMin || f.precoMax)
    chips.push(`${f.precoMin || "0"} – ${f.precoMax || "∞"} Kz`);
  if (f.dataInicio && f.dataFim)
    chips.push(`${formatDate(f.dataInicio)} → ${formatDate(f.dataFim)}`);
  else if (f.dataInicio) chips.push(`A partir de ${formatDate(f.dataInicio)}`);
  else if (f.dataFim)    chips.push(`Até ${formatDate(f.dataFim)}`);
  return chips;
}

function hasDraft(f: Filters) {
  return !!f.pesquisa || f.categorias.length > 0 ||
    !!f.precoMin || !!f.precoMax || !!f.dataInicio || !!f.dataFim;
}

interface BeeznoFiltersProps {
  mobile?:        boolean;
  onSave:         (filters: Filters) => void;
  initialFilters?: Filters;  // ← para pré-seleccionar categoria vinda da URL
}

export default function BeeznoFilters({ mobile = false, onSave, initialFilters }: BeeznoFiltersProps) {
  const [draft, setDraft] = useState<Filters>(initialFilters ?? EMPTY_FILTERS);
  const [saved, setSaved] = useState<Filters>(initialFilters ?? EMPTY_FILTERS);
  const [open,  setOpen]  = useState<string | null>(null);

  const toggle = (key: string) => setOpen(prev => prev === key ? null : key);

  const toggleCategoria = (cat: string) =>
    setDraft(prev => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter(c => c !== cat)
        : [...prev.categorias, cat],
    }));

  const handleSave = () => {
    setSaved({ ...draft });
    onSave({ ...draft });   // ← notifica o pai
    setOpen(null);
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    setSaved(EMPTY_FILTERS);
    onSave(EMPTY_FILTERS);  // ← limpa no pai também
    setOpen(null);
  };

  const savedChips = buildChips(saved);

  const sections = [
    {
      key: "pesquisa", icon: Search, label: "Pesquisar",
      content: (
        <input
          type="text"
          placeholder="Pesquisar equipamentos..."
          value={draft.pesquisa}
          onChange={e => setDraft(p => ({ ...p, pesquisa: e.target.value }))}
          className="w-full rounded-lg border border-border-bg bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
        />
      ),
    },
    {
      key: "categoria", icon: Bookmark, label: "Categoria",
      content: (
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map(cat => (
            <button key={cat} onClick={() => toggleCategoria(cat)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                draft.categorias.includes(cat)
                  ? "border-shield bg-shield-soft text-shield"
                  : "border-border-bg bg-background text-muted-foreground hover:border-shield hover:text-shield"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "preco", icon: Banknote, label: "Preço",
      content: (
        <div className="flex items-center gap-2">
          <input type="number" placeholder="Mín (Kz)" value={draft.precoMin}
            onChange={e => setDraft(p => ({ ...p, precoMin: e.target.value }))}
            className="w-full rounded-lg border border-border-bg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
          />
          <span className="shrink-0 text-xs text-muted-foreground">–</span>
          <input type="number" placeholder="Máx (Kz)" value={draft.precoMax}
            onChange={e => setDraft(p => ({ ...p, precoMax: e.target.value }))}
            className="w-full rounded-lg border border-border-bg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield"
          />
        </div>
      ),
    },
    {
      key: "datas", icon: Calendar, label: "Datas de disponibilidade",
      content: (
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Início do arrendamento</label>
            <input type="date" value={draft.dataInicio}
              onChange={e => setDraft(p => ({ ...p, dataInicio: e.target.value }))}
              className="w-full rounded-lg border border-border-bg bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-shield"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Fim do arrendamento</label>
            <input type="date" value={draft.dataFim} min={draft.dataInicio}
              onChange={e => setDraft(p => ({ ...p, dataFim: e.target.value }))}
              className="w-full rounded-lg border border-border-bg bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-shield"
            />
          </div>
        </div>
      ),
    },
  ];

  const content = (
    <div className="rounded-lg border border-border-bg bg-card">
      {!mobile && (
        <div className="flex justify-center border-b border-border-bg px-6 py-1.5">
          <h2 className="font-light text-card-foreground">Filtros</h2>
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">
        {/* Preferências guardadas */}
        <div className="rounded-xl bg-accent px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-accent-foreground">As tuas preferências</h3>
            {savedChips.length > 0 && (
              <button onClick={handleClear} className="text-xs text-accent-foreground/60 transition-colors hover:text-accent-foreground">
                Limpar todos
              </button>
            )}
          </div>
          {savedChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {savedChips.map(chip => (
                <span key={chip} className="rounded-full bg-background/60 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-accent-foreground/60">Nenhuma preferência guardada ainda.</p>
          )}
        </div>

        {/* Editar preferências */}
        <div className="rounded-lg bg-background px-5 py-4">
          <h3 className="font-bold text-foreground">Editar preferências</h3>

          {sections.map(({ key, icon: Icon, label, content: body }) => (
            <div key={key} className="border-b border-border-bg last:border-0">
              <button onClick={() => toggle(key)}
                className={`flex w-full cursor-pointer items-center justify-between py-4 ${mobile ? "py-3" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`text-muted-foreground ${mobile ? "h-5 w-5" : "h-4 w-4"}`} />
                  <span className={`font-semibold text-foreground ${mobile ? "text-base" : "text-sm"}`}>{label}</span>
                </div>
                <ChevronDown className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open === key ? "rotate-180" : ""} ${mobile ? "h-5 w-5" : "h-4 w-4"}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-out ${open === key ? "max-h-96 pb-4 opacity-100" : "max-h-0 opacity-0"}`}>
                {body}
              </div>
            </div>
          ))}

          <div className="mt-5 flex flex-col gap-2">
            <button onClick={handleSave}
              className="group relative w-full cursor-pointer overflow-hidden rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-shadow duration-300 hover:shadow-lift"
            >
              <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              <span className={`relative ${mobile ? "text-base" : "text-sm"}`}>Guardar</span>
            </button>

            {hasDraft(draft) && (
              <button onClick={handleClear}
                className="w-full cursor-pointer rounded-lg border border-border py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!mobile) return <aside className="w-72 shrink-0 sticky top-24">{content}</aside>;
  return <div>{content}</div>;
}