import Link from "next/link";
import { ArrowUp, Mail, MessageCircle } from "lucide-react";
import { LangSwitch } from "@/components/bz/lang-switch";
import { whatsappLink } from "@/lib/booking";
import { getT } from "@/lib/i18n/server";
import { BeeznooMark, Hex3D } from "./Brand";

const INSTAGRAM = "https://www.instagram.com/beeznoo.ao";
const EMAIL = "equipa@beeznoo.ao";

/** Ícone de traço do Instagram (o lucide-react 1.x deixou de ter ícones de marcas). */
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

/** CTA final (WhatsApp) + rodapé escuro: 3 colunas de links, redes em tiles 44px, palavra gigante em contorno. */
export default async function LandingFooter() {
  const t = (await getT()).landing.footer;
  const WHATSAPP = whatsappLink(t.waHello);
  return (
    <>
      <section className="lp-cta" aria-labelledby="lp-cta-title">
        <div className="lp-wrap">
          <div className="lp-cta__box lp-rv">
            <Hex3D tone="a" size={90} duration={11} className="lp-hide-sm" style={{ right: "34%", top: -26, opacity: 0.9 }} />
            <Hex3D tone="d" size={46} duration={8} className="lp-hide-sm" style={{ right: "28%", bottom: 18 }} />
            <div className="lp-cta__text">
              <h2 id="lp-cta-title" className="lp-sg">
                {t.ctaTitle}
              </h2>
              <p>{t.ctaText}</p>
            </div>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--o">
              <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />
              {t.whatsapp}
            </a>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div className="lp-foot-brand">
              <a href="#topo" className="lp-brand" aria-label={t.backHome}>
                <BeeznooMark size={40} />
                <span className="lp-sg lp-brand__word" aria-hidden="true">
                  beeznoo
                </span>
              </a>
              <p className="lp-sg lp-foot-tag">{t.tagline}</p>
              <p className="lp-foot-desc">{t.desc}</p>
              <div className="lp-socials">
                <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="lp-soc" aria-label={t.instagram}>
                  <InstagramIcon />
                </a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="lp-soc" aria-label={t.whatsappLabel}>
                  <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />
                </a>
                <a href={`mailto:${EMAIL}`} className="lp-soc" aria-label={t.emailLabel}>
                  <Mail size={20} strokeWidth={1.8} aria-hidden="true" />
                </a>
              </div>
              <LangSwitch dark className="mt-4" />
            </div>
            <nav aria-label={t.platform} className="lp-fcol">
              <h3>{t.platform}</h3>
              <Link href="/explorar">{t.explore}</Link>
              <Link href="/publicar">{t.publish}</Link>
              <a href="#como">{t.how}</a>
              <Link href="/registar">{t.signUp}</Link>
            </nav>
            <nav aria-label={t.help} className="lp-fcol">
              <h3>{t.help}</h3>
              <a href="#faq">{t.faq}</a>
              <a href="#confianca">{t.trust}</a>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                {t.whatsapp}
              </a>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </nav>
            <nav aria-label={t.legal} className="lp-fcol">
              <h3>{t.legal}</h3>
              <Link href="/privacidade">{t.privacy}</Link>
            </nav>
          </div>
          <div className="lp-wordmark" aria-hidden="true">
            beeznoo
          </div>
          <div className="lp-foot-bottom">
            <span>{t.copyright}</span>
            <a href="#topo" className="lp-totop">
              {t.toTop}
              <ArrowUp size={20} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
