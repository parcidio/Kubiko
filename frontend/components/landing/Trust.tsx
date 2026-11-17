import { BadgeCheck, FileText, ShieldCheck, Wallet } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { HexGrid } from "./Brand";

const TRUST_ICONS = [BadgeCheck, Wallet, ShieldCheck, FileText];

/** Confiança: bloco escuro com 4 garantias (HexTile salvia que vira no hover). */
export default async function LandingTrust() {
  const tr = (await getT()).landing.trust;
  const TRUST = tr.items.map((it, i) => ({ ...it, icon: TRUST_ICONS[i] }));
  return (
    <section id="confianca" className="lp-sec lp-sec--dark" aria-labelledby="lp-trust-title">
      <HexGrid id="lp-hx-trust" faint />
      <div className="lp-wrap" style={{ position: "relative" }}>
        <div className="lp-rv" style={{ maxWidth: 760 }}>
          <div className="lp-eyebrow lp-eyebrow--dark">{tr.eyebrow}</div>
          <h2 id="lp-trust-title" className="lp-sg lp-h2">
            {tr.title1}
            <br />
            {tr.title2}
          </h2>
          <p className="lp-lead">
            {tr.lead}
          </p>
        </div>
        <ul className="lp-trust-grid">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <li className="lp-trust lp-rv" key={t.title}>
                <span className="lp-hextile lp-hextile--salvia" aria-hidden="true">
                  <Icon size={24} strokeWidth={1.8} />
                </span>
                <h3 className="lp-sg">{t.title}</h3>
                <p>{t.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
