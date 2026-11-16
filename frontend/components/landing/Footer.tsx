import Link from "next/link";
import { ArrowUp, Mail, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/booking";
import { BeeznooMark, Hex3D } from "./Brand";

const WHATSAPP = whatsappLink("Olá! Tenho interesse em saber mais sobre a Beeznoo.");
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
export default function LandingFooter() {
  return (
    <>
      <section className="lp-cta" aria-labelledby="lp-cta-title">
        <div className="lp-wrap">
          <div className="lp-cta__box lp-rv">
            <Hex3D tone="a" size={90} duration={11} className="lp-hide-sm" style={{ right: "34%", top: -26, opacity: 0.9 }} />
            <Hex3D tone="d" size={46} duration={8} className="lp-hide-sm" style={{ right: "28%", bottom: 18 }} />
            <div className="lp-cta__text">
              <h2 id="lp-cta-title" className="lp-sg">
                Tens dúvidas ou uma empresa com equipamento?
              </h2>
              <p>Fala connosco no WhatsApp: respondemos a particulares, empresas e parceiros.</p>
            </div>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--o">
              <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div className="lp-foot-brand">
              <a href="#topo" className="lp-brand" aria-label="Beeznoo, voltar ao início">
                <BeeznooMark size={40} />
                <span className="lp-sg lp-brand__word" aria-hidden="true">
                  beeznoo
                </span>
              </a>
              <p className="lp-sg lp-foot-tag">Por que comprar quando podes alugar?</p>
              <p className="lp-foot-desc">Marketplace de aluguer de equipamento entre pessoas e empresas, em Luanda.</p>
              <div className="lp-socials">
                <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="lp-soc" aria-label="Instagram da Beeznoo">
                  <InstagramIcon />
                </a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="lp-soc" aria-label="WhatsApp da Beeznoo">
                  <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />
                </a>
                <a href={`mailto:${EMAIL}`} className="lp-soc" aria-label="Enviar email à equipa Beeznoo">
                  <Mail size={20} strokeWidth={1.8} aria-hidden="true" />
                </a>
              </div>
            </div>
            <nav aria-label="Plataforma" className="lp-fcol">
              <h3>Plataforma</h3>
              <Link href="/explorar">Explorar equipamento</Link>
              <Link href="/publicar">Publicar equipamento</Link>
              <a href="#como">Como funciona</a>
              <Link href="/registar">Criar conta</Link>
            </nav>
            <nav aria-label="Ajuda" className="lp-fcol">
              <h3>Ajuda</h3>
              <a href="#faq">Perguntas frequentes</a>
              <a href="#confianca">Caução e verificação</a>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                Falar no WhatsApp
              </a>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </nav>
            <nav aria-label="Legal" className="lp-fcol">
              <h3>Legal</h3>
              <Link href="/privacidade">Política de Privacidade</Link>
            </nav>
          </div>
          <div className="lp-wordmark" aria-hidden="true">
            beeznoo
          </div>
          <div className="lp-foot-bottom">
            <span>© 2026 Beeznoo · Feito em Luanda, Angola</span>
            <a href="#topo" className="lp-totop">
              Voltar ao topo
              <ArrowUp size={20} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
