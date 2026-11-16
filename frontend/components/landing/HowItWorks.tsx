import { Check, ClipboardCheck, FileText, Search, Wallet } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: Search,
    title: "Encontra e pede",
    text: "Escolhe o equipamento e as datas, vê o valor final e envia o pedido ao dono.",
  },
  {
    n: "02",
    icon: FileText,
    title: "O dono responde em 24 h",
    text: "Se aceitar, recebes o contrato com as datas, os valores e a caução reembolsável, tudo por escrito antes do encontro.",
  },
  {
    n: "03",
    icon: Wallet,
    title: "Conferes e pagas na entrega",
    text: "Primeiro vês o equipamento, depois pagas ao dono: numerário, transferência ou Multicaixa Express. Recebes o comprovativo na app.",
  },
  {
    n: "04",
    icon: ClipboardCheck,
    title: "Fotos na entrega e na devolução",
    text: "Checklist com fotos dos dois lados. Correu tudo bem? O dono devolve-te a caução.",
  },
];

const TIMELINE = ["Pedido", "Aceite", "Pago ao dono", "Entregue", "Devolvido", "Caução devolvida"];

/** Como funciona: 4 passos + timeline viva dos 6 estados da reserva. */
export default function LandingHowItWorks() {
  return (
    <section id="como" className="lp-sec lp-sec--sand" aria-labelledby="lp-como-title">
      <div className="lp-wrap">
        <div className="lp-head-split lp-rv">
          <div>
            <div className="lp-eyebrow">Como funciona</div>
            <h2 id="lp-como-title" className="lp-sg lp-h2">
              Alugar em quatro passos.
            </h2>
          </div>
          <p className="lp-lead">Sabes sempre o que falta, quem tem de agir e até quando.</p>
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
            <h3 className="lp-sg lp-tl__title">Cada reserva, do pedido à caução</h3>
            <span className="lp-tl__sub">Acompanhas tudo num só ecrã</span>
          </div>
          <div className="lp-tl__track">
            <div className="lp-tl__line" aria-hidden="true">
              <div className="lp-tl__fill" />
            </div>
            <ol className="lp-tl__row">
              {TIMELINE.map((t) => (
                <li className="lp-tl__s" key={t}>
                  <span className="lp-tl__d" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
