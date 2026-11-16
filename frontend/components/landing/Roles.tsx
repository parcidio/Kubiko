import { Clock } from "lucide-react";
import { Hex3D } from "./Brand";
import WaitlistLink from "./WaitlistLink";

/**
 * Uma conta, dois papéis. Os cartões em 3D são ilustrações com um exemplo de valores (aria-hidden),
 * não reservas reais.
 */
export default function LandingRoles() {
  return (
    <section id="donos" className="lp-sec" aria-labelledby="lp-roles-title">
      <div className="lp-wrap">
        <div className="lp-rv">
          <div className="lp-eyebrow">Uma conta, dois papéis</div>
          <h2 id="lp-roles-title" className="lp-sg lp-h2">
            Alugas quando precisas.
            <br />
            Ganhas quando não usas.
          </h2>
        </div>

        <div className="lp-roles">
          <article className="lp-role lp-role--a lp-rv">
            <div className="lp-eyebrow">Para quem precisa</div>
            <h3 className="lp-sg">
              Usa só quando precisas.
              <br />
              Paga só quando usas.
            </h3>
            <p>
              Um casamento, uma gravação, um evento no fim de semana: não compres equipamento que vai ficar parado. Vês o
              valor final antes de pedir, sem surpresas.
            </p>
            <WaitlistLink objetivo="alugar" className="lp-btn lp-btn--g">
              Quero alugar
            </WaitlistLink>
            <div className="lp-mock3d" aria-hidden="true">
              <div className="lp-mock lp-mock--sand lp-num">
                <div className="lp-sg lp-mock__title" style={{ marginBottom: 8 }}>
                  Sony A7 III · 23 a 25 out
                </div>
                <div className="lp-row">
                  <span>3 diárias × 35.000 Kz</span>
                  <span>105.000 Kz</span>
                </div>
                <div className="lp-row">
                  <span>Taxa de serviço (8%)</span>
                  <span>8.400 Kz</span>
                </div>
                <div className="lp-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    Caução <span className="lp-chip-pos">Reembolsável</span>
                  </span>
                  <span>105.000 Kz</span>
                </div>
                <div className="lp-row lp-row--total">
                  <span style={{ fontWeight: 700, color: "#0E2A1F" }}>Pagas ao dono na entrega</span>
                  <span className="lp-sg" style={{ fontSize: 22, color: "#0E2A1F", whiteSpace: "nowrap" }}>
                    218.400 Kz
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="lp-role lp-role--b lp-rv">
            <Hex3D tone="b" size={70} duration={12} className="lp-hide-sm" style={{ right: 40, top: 40, opacity: 0.8 }} />
            <div className="lp-eyebrow lp-eyebrow--dark" style={{ position: "relative" }}>
              Para quem tem equipamento
            </div>
            <h3 className="lp-sg">
              Equipamento parado?
              <br />
              Põe-no a render.
            </h3>
            <p>
              Particular ou empresa: publicas o que tens, defines o preço e as datas e aceitas só os pedidos que quiseres,
              com contrato e caução em cada reserva.
            </p>
            <WaitlistLink objetivo="disponibilizar" className="lp-btn lp-btn--o">
              Quero disponibilizar
            </WaitlistLink>
            <div className="lp-mock3d" aria-hidden="true">
              <div className="lp-mock lp-mock--white">
                <div className="lp-owner__top">
                  <div>
                    <div style={{ fontSize: 13, color: "#5E6B64" }}>Novo pedido · Kilamba</div>
                    <div className="lp-sg lp-mock__title" style={{ marginTop: 2 }}>
                      Sony A7 III · 23 a 25 out
                    </div>
                  </div>
                  <span className="lp-chip-warn">
                    <Clock size={13} strokeWidth={2} />
                    Responde até 18:30
                  </span>
                </div>
                <div className="lp-owner__get">
                  <span style={{ fontWeight: 500, color: "#1F5C42" }}>Recebes pelo aluguer</span>
                  <span className="lp-sg lp-num" style={{ fontSize: 26, color: "#0E2A1F", whiteSpace: "nowrap" }}>
                    105.000 Kz
                  </span>
                </div>
                <div className="lp-owner__btns">
                  <span style={{ border: "1.5px solid #B9C2B5" }}>Recusar</span>
                  <span style={{ background: "#0E2A1F", color: "#FAF6EF" }}>Aceitar pedido</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
