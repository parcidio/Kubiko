import { Check, ClipboardCheck, FileText, Search, Wallet } from "lucide-react";
import { getT } from "@/lib/i18n/server";

const STEP_ICONS = [Search, FileText, Wallet, ClipboardCheck];

/** Como funciona: 4 passos + timeline viva dos 6 estados da reserva. */
export default async function LandingHowItWorks() {
  const t = (await getT()).landing.how;
  const STEPS = t.steps.map((s, i) => ({ ...s, n: `0${i + 1}`, icon: STEP_ICONS[i] }));
  return (
    <section id="como" className="lp-sec lp-sec--sand" aria-labelledby="lp-como-title">
      <div className="lp-wrap">
        <div className="lp-head-split lp-rv">
          <div>
            <div className="lp-eyebrow">{t.eyebrow}</div>
            <h2 id="lp-como-title" className="lp-sg lp-h2">
              {t.title}
            </h2>
          </div>
          <p className="lp-lead">{t.lead}</p>
        </div>

        <ol className="lp-steps">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <li className="lp-step lp-rv" key={s.n}>
                <div className="lp-step__top">
                  <span className="lp-sg lp-step__n" aria-hidden="true">
                    {s.n}
                  </span>
                  <span className="lp-hextile" aria-hidden="true">
                    <Icon size={24} strokeWidth={1.8} />
                  </span>
                </div>
                <h3 className="lp-sg">{s.title}</h3>
                <p>{s.text}</p>
              </li>
            );
          })}
        </ol>

        <div className="lp-tl lp-rv">
          <div className="lp-tl__head">
            <h3 className="lp-sg lp-tl__title">{t.timelineTitle}</h3>
            <span className="lp-tl__sub">{t.timelineSub}</span>
          </div>
          <div className="lp-tl__track">
            <div className="lp-tl__line" aria-hidden="true">
              <div className="lp-tl__fill" />
            </div>
            <ol className="lp-tl__row">
              {t.timeline.map((step) => (
                <li className="lp-tl__s" key={step}>
                  <span className="lp-tl__d" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
