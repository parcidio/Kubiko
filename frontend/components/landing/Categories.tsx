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
import { Hex3D } from "./Brand";

type Item = { name: string; use: string; icon: LucideIcon; soon?: boolean };
type Cat = {
  key: string;
  label: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  text: string;
  /** Categoria real no Explorar (slug de V2__items_categories.sql); sem slug = ainda não existe. */
  explore?: { href: string; label: string };
  items: Item[];
};

// Exemplos do tipo de equipamento de cada categoria (não são anúncios reais: sem preço nem dono).
const CATS: Cat[] = [
  {
    key: "foto",
    label: "Foto e vídeo",
    icon: Camera,
    kicker: "Foto e vídeo",
    title: "Grava como um profissional, sem comprar como um.",
    text: "Câmaras, estabilizadores e luz de estúdio para casamentos, videoclipes e conteúdo para redes.",
    explore: { href: "/explorar?categoria=fotografia", label: "Ver foto e vídeo" },
    items: [
      { name: "Sony A7 III", use: "Casamentos e retratos", icon: Camera },
      { name: "Canon EOS R6", use: "Foto e vídeo 4K", icon: Camera },
      { name: "DJI Ronin RS3", use: "Planos estáveis em movimento", icon: Video },
      { name: "Godox AD600", use: "Flash de estúdio portátil", icon: Lightbulb },
    ],
  },
  {
    key: "audio",
    label: "Áudio",
    icon: Mic,
    kicker: "Áudio",
    title: "Som limpo para gravar, falar ou fazer festa.",
    text: "Microfones sem fio para entrevistas e podcasts, colunas para o fim de semana.",
    explore: { href: "/explorar?categoria=audio", label: "Ver áudio" },
    items: [
      { name: "Rode Wireless GO II", use: "Entrevistas e reels", icon: Mic },
      { name: "JBL PartyBox", use: "Festas e aniversários", icon: Speaker },
      { name: "Microfone de mão", use: "Conferências e cultos", icon: Mic },
      { name: "Coluna amplificada", use: "Eventos ao ar livre", icon: Speaker },
    ],
  },
  {
    key: "eventos",
    label: "Eventos",
    icon: Projector,
    kicker: "Eventos",
    title: "Tudo para o teu evento, só pelo fim de semana.",
    text: "Projeção, luz e som para casamentos, aniversários e apresentações.",
    explore: { href: "/explorar?categoria=eventos", label: "Ver eventos" },
    items: [
      { name: "Projetor Epson", use: "Apresentações e cinema em casa", icon: Projector },
      { name: "Kit de iluminação", use: "Pista e decoração", icon: Lightbulb },
      { name: "Tendas", use: "Festas no quintal", icon: Tent, soon: true },
      { name: "Cadeiras e mesas", use: "Receções", icon: Armchair, soon: true },
    ],
  },
  {
    key: "mais",
    label: "Mais categorias",
    icon: LayoutGrid,
    kicker: "A seguir",
    title: "Do berbequim à carrinha.",
    text: "Começamos por foto, vídeo, áudio e eventos. Diz-nos na lista de espera o que procuras e abrimos primeiro as categorias mais pedidas.",
    items: [
      { name: "Ferramentas", use: "Obras e reparações em casa", icon: Wrench, soon: true },
      { name: "Eletrónica", use: "Consolas, ecrãs, portáteis", icon: Cpu, soon: true },
      { name: "Mobiliário", use: "Eventos e escritórios", icon: Armchair, soon: true },
      { name: "Veículos", use: "Carrinhas e transporte", icon: Car, soon: true },
    ],
  },
];

/** Categorias em separadores acessíveis (setas, Home/End). Cada separador abre o Explorar filtrado. */
export default function LandingCategories() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
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
          <div className="lp-eyebrow">O que vais encontrar</div>
          <h2 id="lp-cat-title" className="lp-sg lp-h2">
            Do casamento ao videoclipe.
            <br />O equipamento certo, quando precisas.
          </h2>
        </div>

        <div className="lp-tabs lp-rv" role="tablist" aria-label="Categorias" onKeyDown={onKey}>
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
              <a href="#lista" className="lp-btn lp-btn--o">
                Diz-nos o que procuras
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
                    {it.soon && <span className="lp-soon">Em breve</span>}
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
