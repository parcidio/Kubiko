"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Peças das tabelas do Admin (decisoes-produto.md 2026-11-18): densas, calmas, só tokens de cor.
 * A tabela rola na horizontal dentro do cartão em ecrãs estreitos (nunca a página).
 */

export function DataTable({ label, children, className, minWidth = 760 }: { label: string; children: React.ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table aria-label={label} className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <th scope="col" className={cn("h-10 border-b border-borda bg-areia px-4 text-xs font-bold tracking-[0.08em] text-cinza uppercase whitespace-nowrap", align === "right" && "text-right", className)}>
      {children}
    </th>
  );
}

/** Cabeçalho ordenável: botão com aria-sort no <th>. */
export function SortTh<K extends string>({
  label, sortKey, sort, direction, onSort, align = "left", className,
}: { label: string; sortKey: K; sort: K; direction: "asc" | "desc"; onSort: (key: K) => void; align?: "left" | "right"; className?: string }) {
  const active = sort === sortKey;
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-10 border-b border-borda bg-areia px-2 text-xs font-bold tracking-[0.08em] text-cinza uppercase whitespace-nowrap", align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex min-h-9 items-center gap-1 rounded-campo px-2 uppercase hover:bg-areia-2 hover:text-verde", active && "text-verde")}
      >
        {label}
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </th>
  );
}

export function Td({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return <td className={cn("border-b border-borda px-4 py-2.5 align-middle", align === "right" && "text-right", className)}>{children}</td>;
}

/** Linha com destaque no hover; o link principal fica na 1.ª célula (teclado: Tab chega ao link). */
export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("transition-colors duration-200 hover:bg-areia [&:last-child>td]:border-0", className)}>{children}</tr>;
}

/** Barra de ferramentas: pesquisa + filtros, quebra em linhas no telemóvel. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end gap-2 border-b border-borda p-3", className)}>{children}</div>;
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative min-w-0 flex-1 basis-64">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={100}
        className="h-10 w-full rounded-campo border border-borda-forte bg-branco pr-3 pl-9 text-[15px] text-verde outline-none placeholder:text-cinza focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
      />
    </label>
  );
}

/** Filtro compacto (select nativo) com rótulo visível. */
export function FilterSelect<T extends string>({
  label, value, onChange, options, allLabel = "Todos",
}: { label: string; value: T | ""; onChange: (v: T | "") => void; options: { value: T; label: string }[]; allLabel?: string }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-bold text-cinza">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T | "")}
          className="h-10 appearance-none rounded-campo border border-borda-forte bg-branco pr-8 pl-3 text-sm text-verde outline-none focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
        >
          <option value="">{allLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
      </div>
    </div>
  );
}

export function DateFilter({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-bold text-cinza">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-campo border border-borda-forte bg-branco px-3 text-sm text-verde outline-none focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
      />
    </div>
  );
}

/** Paginação do servidor: "1–25 de 312" + anterior/seguinte. */
export function Pagination({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-2 border-t border-borda px-4 py-2.5 text-sm text-cinza">
      <span className="num" aria-live="polite">
        {from}–{to} de {total}
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
          className="inline-flex size-9 items-center justify-center rounded-campo border border-borda text-verde hover:bg-areia-2 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden />
        </button>
        <span className="num px-2">
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Página seguinte"
          className="inline-flex size-9 items-center justify-center rounded-campo border border-borda text-verde hover:bg-areia-2 disabled:opacity-40"
        >
          <ChevronRight className="size-4" strokeWidth={1.8} aria-hidden />
        </button>
      </span>
    </nav>
  );
}

/** Linhas a carregar dentro da tabela (role="status"). */
export function TableSkeleton({ rows = 6, label = "A carregar" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 rounded-campo bg-skeleton" />
      ))}
    </div>
  );
}

/**
 * Separadores do Admin (sublinhado, densos): role=tablist, setas do teclado. O painel tem id `${idBase}-panel`.
 */
export function AdminTabs<T extends string>({
  label, value, onChange, options, idBase,
}: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; idBase: string }) {
  function onKey(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onChange(options[next].value);
    document.getElementById(`${idBase}-tab-${options[next].value}`)?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-borda [scrollbar-width:none]">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            id={`${idBase}-tab-${o.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idBase}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors duration-200",
              active ? "border-verde-medio font-bold text-verde" : "border-transparent text-cinza hover:text-verde",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="num rounded-full bg-areia-2 px-1.5 text-xs text-cinza">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Total de uma página do Spring (PagedModel ou PageImpl). */
export function pageTotal(p: { page?: { totalElements: number }; totalElements?: number; content: unknown[] } | undefined) {
  return p?.page?.totalElements ?? p?.totalElements ?? p?.content.length ?? 0;
}
