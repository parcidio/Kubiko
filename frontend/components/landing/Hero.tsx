import { landingExample } from "@/lib/format";
import { ArrowRight, BadgeCheck, Camera, Check, Clock, Search, Undo2 } from "lucide-react";
import { Hex3D, HexGrid } from "./Brand";
import { Countdown, HeroStage } from "./HeroClient";

const PERKS = ["Acesso antecipado à plataforma", "Aviso quando abrirmos na tua província", "Benefícios para os primeiros inscritos"];

/**
 * Hero escuro: título "linha a linha", traço desenhado na palavra de destaque (salvia sobre verde),
 * telemóvel e hexágonos 3D só em CSS. Sem formulário: a lista de espera tem secção própria (#lista).
 * O telemóvel é uma ilustração (aria-hidden) com um exemplo de preço, não um anúncio real.
 */
// feeRate: taxa em vigor (PAYMENTS_SERVICE_FEE_RATE via API); o exemplo de preço recalcula-se com ela
export default function LandingHero({ feeRate }: { feeRate: number }) {
  const ex = landingExample(feeRate);
  return (
    <section id="topo" className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__glow" aria-hidden="true" />
      <HexGrid id="lp-hx-hero" />

      <div className="lp-wrap lp-hero__grid">
        <div>
          <span className="lp-pill lp-fade lp-fade--0">
            <span className="lp-dot" aria-hidden="true" />
            Em breve em Luanda · Lista de espera aberta
          </span>
          <h1 id="lp-hero-title" className="lp-sg lp-h1">
            <span className="lp-h1__l">
              <span>Precisas de</span>
            </span>
            <span className="lp-h1__l">
              <span>equipamento?</span>
            </span>
            <span className="lp-h1__l lp-h1__l--accent">
              <span className="lp-accent">
                Aluga, não compres.
                <svg className="lp-swoosh" viewBox="0 0 400 26" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path d="M4 18 C 90 4, 220 2, 396 14" fill="none" stroke="#F0A22E" strokeWidth="6" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          </h1>
          <p className="lp-hero__lead lp-fade">
            Câmaras, som, luzes e projetores de quem os tem parados, perto de ti e com caução reembolsável. Pagas só os dias
            que usas, ao dono, na entrega.
          </p>
          <div className="lp-hero__ctas lp-fade lp-fade--2">
            <a href="#lista" className="lp-btn lp-btn--p">
              Entrar na lista de espera
              <ArrowRight className="lp-btn__arr" size={20} strokeWidth={1.8} aria-hidden="true" />
            </a>
            <a href="#como" className="lp-btn lp-btn--o">
              Ver como funciona
            </a>
          </div>
          <div className="lp-hero__meta lp-fade lp-fade--3">
            <Countdown />
            <ul className="lp-perks">
              {PERKS.map((p) => (
                <li key={p}>
                  <Check size={18} strokeWidth={1.8} aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lp-scene" aria-hidden="true">
          <HeroStage>
            <div className="lp-floor" />
            <Hex3D tone="a" size={64} duration={9} z={40} style={{ left: "6%", top: 8 }} />
            <Hex3D tone="b" size={40} duration={7} z={120} style={{ right: "4%", top: 120 }} />
            <Hex3D tone="c" size={88} duration={14} z={-80} style={{ right: "10%", bottom: 40 }} />
            <Hex3D tone="d" size={30} duration={6} z={160} style={{ left: "30%", bottom: 20 }} />

            <div className="lp-phone-wrap">
              <div className="lp-phone-edge" />
              <div className="lp-phone-edge2" />
              <div className="lp-phone">
                <div className="lp-screen">
                  <div className="lp-notch" />
                  <div className="lp-screen__body">
                    <div className="lp-screen__top">
                      <span className="lp-sg" style={{ fontSize: 17 }}>
                        beeznoo
                      </span>
                      <span className="lp-avatar">NK</span>
                    </div>
                    <div className="lp-fakesearch">
                      <Search size={15} strokeWidth={1.8} />
                      Câmara para casamento
                    </div>
                    <div className="lp-mini">
                      <div className="lp-mini__ph">
                        <Camera size={54} strokeWidth={1.4} />
                      </div>
                      <div className="lp-mini__row">
                        <span className="lp-sg" style={{ fontSize: 16 }}>
                          Sony A7 III
                        </span>
                        <span className="lp-sg lp-num" style={{ fontSize: 15 }}>
                          35.000 Kz
                          <span style={{ fontWeight: 400, fontSize: 11, color: "#5E6B64", letterSpacing: 0 }}>/dia</span>
                        </span>
                      </div>
                      <div className="lp-mini__meta">
                        Talatona ·
                        <span className="lp-badge-ok">
                          <Check size={11} strokeWidth={2.4} />
                          Verificado
                        </span>
                      </div>
                    </div>
                    <div className="lp-mini-sum lp-num">
                      <div>
                        <span>3 diárias × 35.000 Kz</span>
                        <span>105.000 Kz</span>
                      </div>
                      <div>
                        <span>Taxa de serviço ({ex.rateLabel})</span>
                        <span>{`${ex.fee.toLocaleString("de-DE")} Kz`}</span>
                      </div>
                      <div className="lp-pos">
                        <span>Caução reembolsável</span>
                        <span>105.000 Kz</span>
                      </div>
                      <div className="lp-tot">
                        <span>Total</span>
                        <span className="lp-sg">{`${ex.total.toLocaleString("de-DE")} Kz`}</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-screen__bar">
                    <div className="lp-screen__cta">Pedir reserva</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-fcard lp-f1">
              <div className="lp-fcard__row">
                <span className="lp-fcard__ic">
                  <BadgeCheck size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Pedido aceite</div>
                  <div style={{ fontSize: 12, color: "#5E6B64" }}>O dono aceitou o teu pedido</div>
                </div>
              </div>
            </div>
            <div className="lp-fcard lp-f2">
              <div className="lp-f2__k">
                <Clock size={15} strokeWidth={2} />
                Próximo passo
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>Pagas ao dono na entrega · sáb, 10:00</div>
              <div className="lp-sg lp-num" style={{ fontSize: 20, marginTop: 2 }}>
                {`${ex.total.toLocaleString("de-DE")} Kz`}
              </div>
            </div>
            <div className="lp-fcard lp-f3">
              <div className="lp-fcard__row">
                <Undo2 size={26} strokeWidth={1.8} color="#1F5C42" />
                <div>
                  <div style={{ fontSize: 12, color: "#1F5C42", fontWeight: 700 }}>Caução devolvida</div>
                  <div className="lp-sg lp-num" style={{ fontSize: 17 }}>
                    105.000 Kz
                  </div>
                </div>
              </div>
            </div>
          </HeroStage>
        </div>
      </div>
    </section>
  );
}
