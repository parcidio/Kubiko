import Link from "next/link";
import { BeeznooMark } from "./Brand";

const LINKS = [
  { href: "#como", label: "Como funciona" },
  { href: "#categorias", label: "Categorias" },
  { href: "#donos", label: "Para donos" },
  { href: "#confianca", label: "Confiança" },
  { href: "#faq", label: "Perguntas" },
];

/** Cabeçalho escuro translúcido da landing (verde 82% + blur 14px). */
export default function LandingHeader() {
  return (
    <header className="lp-nav">
      <div className="lp-wrap lp-nav__bar">
        <a href="#topo" className="lp-brand" aria-label="Beeznoo, início">
          <BeeznooMark size={36} />
          <span className="lp-sg lp-brand__word" aria-hidden="true">
            beeznoo
          </span>
        </a>
        <nav className="lp-navlinks" aria-label="Principal">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav__actions">
          <Link href="/entrar" className="lp-btn lp-btn--l">
            Entrar
          </Link>
          <Link href="/registar" className="lp-btn lp-btn--n">
            Criar conta
          </Link>
        </div>
      </div>
    </header>
  );
}
