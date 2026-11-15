import { ViewTransition } from "react";

/**
 * Transição entre ecrãs (docs/DESIGN_SYSTEM.md §5): o ecrã antigo desvanece e o novo sobe 8px, com a curva da marca.
 * Usa a View Transitions API (capturas do ecrã): não mexe no layout nem parte barras `position: fixed`.
 * Sem suporte no browser, a navegação acontece como sempre. Desliga com prefers-reduced-motion (globals.css).
 * Fica no layout: anima quando o conteúdo da rota muda (navegações do Next são transições do React).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <ViewTransition default="pagina">{children}</ViewTransition>;
}
