import { formatFeeRate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { ChevronDown } from "lucide-react";

/** Perguntas frequentes: acordeão nativo (<details>/<summary>), acessível por teclado sem JS. */
export default async function LandingFaq({ feeRate }: { feeRate: number }) {
  const t = (await getT()).landing.faq;
  const rate = formatFeeRate(feeRate, await getLang());
  const FAQ = t.items.map((f) => ({ q: f.q, a: fmt(f.a, { rate }) }));
  return (
    <section id="faq" className="lp-sec" aria-labelledby="lp-faq-title">
      <div className="lp-wrap lp-faq-grid">
        <div className="lp-rv">
          <div className="lp-eyebrow">{t.eyebrow}</div>
          <h2 id="lp-faq-title" className="lp-sg lp-h2">
            {t.title}
          </h2>
        </div>
        <div className="lp-faq lp-rv">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                <span className="lp-sg">{f.q}</span>
                <span className="lp-chev" aria-hidden="true">
                  <ChevronDown size={18} strokeWidth={1.8} />
                </span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
