import { BadgeCheck, FileText, ShieldCheck, Wallet } from "lucide-react";
import { HexGrid } from "./Brand";

const TRUST = [
  {
    icon: BadgeCheck,
    title: "Perfis verificados",
    text: "O selo Verificado quer dizer que a pessoa confirmou a identidade: BI e selfie, ou NIF para empresas. Vês o selo antes de pedir.",
  },
  {
    icon: Wallet,
    title: "Pagas só na entrega",
    text: "Nada se paga antes do encontro. Conferes o equipamento, pagas ao dono e recebes o comprovativo na app.",
  },
  {
    icon: ShieldCheck,
    title: "Caução reembolsável",
    text: "Entregas a caução ao dono e ele devolve-ta depois da devolução. Se retiver uma parte e não concordares, tens 7 dias para contestar e a nossa equipa medeia.",
  },
  {
    icon: FileText,
    title: "Contrato em cada reserva",
    text: "Datas, preço, caução e condições por escrito, para os dois lados.",
  },
];

/** Confiança: bloco escuro com 4 garantias (HexTile salvia que vira no hover). */
export default function LandingTrust() {
  return (
    <section id="confianca" className="lp-sec lp-sec--dark" aria-labelledby="lp-trust-title">
      <HexGrid id="lp-hx-trust" faint />
      <div className="lp-wrap" style={{ position: "relative" }}>
        <div className="lp-rv" style={{ maxWidth: 760 }}>
          <div className="lp-eyebrow lp-eyebrow--dark">Confiança em primeiro lugar</div>
          <h2 id="lp-trust-title" className="lp-sg lp-h2">
            Alugar a um desconhecido,
            <br />
            sem desconfiança.
          </h2>
          <p className="lp-lead">
            Cada aluguer tem regras claras para os dois lados, e fica tudo registado na app: contrato, fotos, pagamento e
            caução.
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
