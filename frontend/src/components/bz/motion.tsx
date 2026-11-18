"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Transição entre ecrãs (docs/DESIGN_SYSTEM.md §6): o ecrã antigo desvanece e o novo sobe 6px, com a curva da marca.
 * Usa a View Transitions API (capturas do ecrã): não mexe no layout nem parte barras `position: fixed`.
 * Sem suporte no browser, a navegação acontece como sempre. Desliga com prefers-reduced-motion (globals.css).
 *
 * `key={pathname}` + `default="none"`: só anima quando muda o ecrã. Filtros, pesquisas, mudanças de língua
 * (router.refresh) e outras atualizações dentro de transições do React deixam de fazer "piscar" a página toda.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="pagina-entra" exit="pagina-sai" default="none">
      {children}
    </ViewTransition>
  );
}
