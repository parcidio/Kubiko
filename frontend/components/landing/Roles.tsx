import { landingExample } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { Clock } from "lucide-react";
import { Hex3D } from "./Brand";
import Link from "next/link";

/**
 * Uma conta, dois papéis. Os cartões em 3D são ilustrações com um exemplo de valores (aria-hidden),
 * não reservas reais.
 */
// feeRate: taxa em vigor (PAYMENTS_SERVICE_FEE_RATE via API); o exemplo de preço recalcula-se com ela
export default async function LandingRoles({ feeRate }: { feeRate: number }) {
  const ex = landingExample(feeRate, await getLang());
  const t = (await getT()).landing.roles;
  return (
    <section id="donos" className="lp-sec" aria-labelledby="lp-roles-title">
      <div className="lp-wrap">
        <div className="lp-rv">
          <div className="lp-eyebrow">{t.eyebrow}</div>
          <h2 id="lp-roles-title" className="lp-sg lp-h2">
            {t.title1}
            <br />
            {t.title2}
          </h2>
        </div>

        <div className="lp-roles">
          <article className="lp-role lp-role--a lp-rv">
            <div className="lp-eyebrow">{t.renterEyebrow}</div>
            <h3 className="lp-sg">
              {t.renterTitle1}
              <br />
              {t.renterTitle2}
            </h3>
            <p>
              {t.renterText}
            </p>
            <Link href="/explorar" className="lp-btn lp-btn--g">
              {t.renterCta}
            </Link>
            <div className="lp-mock3d" aria-hidden="true">
              <div className="lp-mock lp-mock--sand lp-num">
                <div className="lp-sg lp-mock__title" style={{ marginBottom: 8 }}>
                  {t.mockTitle}
                </div>
                <div className="lp-row">
                  <span>{t.mockDays}</span>
                  <span>105.000 Kz</span>
                </div>
                <div className="lp-row">
                  <span>{fmt(t.mockFee, { rate: ex.rateLabel })}</span>
                  <span>{`${ex.fee.toLocaleString("de-DE")} Kz`}</span>
                </div>
                <div className="lp-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {t.mockDeposit} <span className="lp-chip-pos">{t.mockRefundable}</span>
                  </span>
                  <span>105.000 Kz</span>
                </div>
                <div className="lp-row lp-row--total">
                  <span style={{ fontWeight: 700, color: "#0E2A1F" }}>{t.mockPay}</span>
                  <span className="lp-sg" style={{ fontSize: 22, color: "#0E2A1F", whiteSpace: "nowrap" }}>
                    {`${ex.total.toLocaleString("de-DE")} Kz`}
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="lp-role lp-role--b lp-rv">
            <Hex3D tone="b" size={70} duration={12} className="lp-hide-sm" style={{ right: 40, top: 40, opacity: 0.8 }} />
            <div className="lp-eyebrow lp-eyebrow--dark" style={{ position: "relative" }}>
              {t.ownerEyebrow}
            </div>
            <h3 className="lp-sg">
              {t.ownerTitle1}
              <br />
              {t.ownerTitle2}
            </h3>
            <p>
              {t.ownerText}
            </p>
            <Link href="/publicar" className="lp-btn lp-btn--o">
              {t.ownerCta}
            </Link>
            <div className="lp-mock3d" aria-hidden="true">
              <div className="lp-mock lp-mock--white">
                <div className="lp-owner__top">
                  <div>
                    <div style={{ fontSize: 13, color: "#5E6B64" }}>{t.ownerNew}</div>
                    <div className="lp-sg lp-mock__title" style={{ marginTop: 2 }}>
                      {t.mockTitle}
                    </div>
                  </div>
                  <span className="lp-chip-warn">
                    <Clock size={13} strokeWidth={2} />
                    {t.ownerReply}
                  </span>
                </div>
                <div className="lp-owner__get">
                  <span style={{ fontWeight: 500, color: "#1F5C42" }}>{t.ownerGet}</span>
                  <span className="lp-sg lp-num" style={{ fontSize: 26, color: "#0E2A1F", whiteSpace: "nowrap" }}>
                    105.000 Kz
                  </span>
                </div>
                <div className="lp-owner__btns">
                  <span style={{ border: "1.5px solid #B9C2B5" }}>{t.ownerDecline}</span>
                  <span style={{ background: "#0E2A1F", color: "#FAF6EF" }}>{t.ownerAccept}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
