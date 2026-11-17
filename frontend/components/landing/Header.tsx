import Link from "next/link";
import { LangSwitch } from "@/components/bz/lang-switch";
import { getT } from "@/lib/i18n/server";
import { BeeznooMark } from "./Brand";

/** Cabeçalho escuro translúcido da landing (verde 82% + blur 14px). */
export default async function LandingHeader() {
  const t = (await getT()).landing.nav;
  const LINKS = [
    { href: "#como", label: t.how },
    { href: "#categorias", label: t.categories },
    { href: "#donos", label: t.owners },
    { href: "#confianca", label: t.trust },
    { href: "#faq", label: t.faq },
  ];
  return (
    <header className="lp-nav">
      <div className="lp-wrap lp-nav__bar">
        <a href="#topo" className="lp-brand" aria-label={t.home}>
          <BeeznooMark size={36} />
          <span className="lp-sg lp-brand__word" aria-hidden="true">
            beeznoo
          </span>
        </a>
        <nav className="lp-navlinks" aria-label={t.main}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav__actions">
          {/* Abaixo de 400px o seletor fica só no rodapé (não cabe ao lado dos dois botões) */}
          <LangSwitch dark className="lp-lang-hdr" />
          <Link href="/entrar" className="lp-btn lp-btn--l">
            {t.signIn}
          </Link>
          <Link href="/registar" className="lp-btn lp-btn--n">
            {t.signUp}
          </Link>
        </div>
      </div>
    </header>
  );
}
