"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Armchair,
  Camera,
  Car,
  Cpu,
  LayoutGrid,
  Lightbulb,
  Mic,
  Projector,
  Speaker,
  Tent,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { whatsappLink } from "@/lib/booking";
import { useT } from "@/lib/i18n/client";
import { Hex3D } from "./Brand";

type Key = "foto" | "audio" | "eventos" | "mais";
type Shape = {
  key: Key;
  icon: LucideIcon;
  /** Categoria real no Explorar (slug de V2__items_categories.sql); sem slug = ainda não existe. */
  href?: string;
  /** Ícone de cada exemplo e se ainda não existe ("Em breve"). Nomes e usos vêm do dicionário. */
  items: { icon: LucideIcon; soon?: boolean }[];
};

// Exemplos do tipo de equipamento de cada categoria (não são anúncios reais: sem preço nem dono).
const SHAPES: Shape[] = [
  { key: "foto", icon: Camera, href: "/explorar?categoria=fotografia", items: [{ icon: Camera }, { icon: Camera }, { icon: Video }, { icon: Lightbulb }] },
  { key: "audio", icon: Mic, href: "/explorar?categoria=audio", items: [{ icon: Mic }, { icon: Speaker }, { icon: Mic }, { icon: Speaker }] },
  {
    key: "eventos",
    icon: Projector,
    href: "/explorar?categoria=eventos",
    items: [{ icon: Projector }, { icon: Lightbulb }, { icon: Tent, soon: true }, { icon: Armchair, soon: true }],
  },
  {
    key: "mais",
    icon: LayoutGrid,
    items: [{ icon: Wrench, soon: true }, { icon: Cpu, soon: true }, { icon: Armchair, soon: true }, { icon: Car, soon: true }],
  },
];

/** Categorias em separadores acessíveis (setas, Home/End). Cada separador abre o Explorar filtrado. */
export default function LandingCategories() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const t = useT().landing.categories;
  const CATS = SHAPES.map((c) => {
    const d = t.cats[c.key];
    return {
      ...d,
      key: c.key,
      icon: c.icon,
      explore: c.href ? { href: c.href, label: d.explore } : undefined,
      items: c.items.map((it, i) => ({ ...it, name: d.names[i], use: d.uses[i] })),
    };
  });
  const cur = CATS[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = CATS.length - 1;
    const next =
      e.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : e.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="categorias" className="lp-sec" aria-labelledby="lp-cat-title">
      <div className="lp-wrap">
        <div className="lp-rv">
          <div className="lp-eyebrow">{t.eyebrow}</div>
          <h2 id="lp-cat-title" className="lp-sg lp-h2">
            {t.title1}
            <br />
            {t.title2}
          </h2>
        </div>

        <div className="lp-tabs lp-rv" role="tablist" aria-label={t.tabsLabel} onKeyDown={onKey}>
          {CATS.map((c, i) => {
            const Icon = c.icon;
            const selected = i === active;
            return (
              <button
                key={c.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`lp-tab-${c.key}`}
                aria-selected={selected}
                aria-controls="lp-cat-panel"
                tabIndex={selected ? 0 : -1}
                className="lp-tab"
                onClick={() => setActive(i)}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                {c.label}
              </button>
            );
          })}
        </div>

        <div id="lp-cat-panel" className="lp-cat-panel lp-rv" role="tabpanel" aria-labelledby={`lp-tab-${cur.key}`}>
          <div className="lp-cat-intro">
            <Hex3D tone="a" size={120} duration={16} style={{ right: -30, top: -20, opacity: 0.9 }} />
            <div style={{ position: "relative" }}>
              <div className="lp-eyebrow lp-eyebrow--dark">{cur.kicker}</div>
              <h3 className="lp-sg">{cur.title}</h3>
              <p>{cur.text}</p>
            </div>
            {cur.explore ? (
              <Link href={cur.explore.href} className="lp-btn lp-btn--o">
                {cur.explore.label}
                <ArrowRight className="lp-btn__arr" size={20} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            ) : (
              <a href={whatsappLink(t.tellUsMessage)} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--o">
                {t.tellUs}
              </a>
            )}
          </div>
          {/* key: ao trocar de separador os cartões voltam a entrar */}
          <ul className="lp-cat-items" key={cur.key}>
            {cur.items.map((it) => {
              const Icon = it.icon;
              return (
                <li className="lp-item" key={it.name}>
                  <div className="lp-ph">
                    <Icon size={56} strokeWidth={1.4} aria-hidden="true" />
                  </div>
                  <div className="lp-item__row">
                    <span className="lp-sg lp-item__name">{it.name}</span>
                    {it.soon && <span className="lp-soon">{t.soon}</span>}
                  </div>
                  <div className="lp-item__use">{it.use}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
