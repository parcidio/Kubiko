import "../../components/landing/landing.css";
import { getServiceFeeRate } from "@/lib/config-server";
import LandingCategories from "../../components/landing/Categories";
import LandingFaq from "../../components/landing/Faq";
import LandingFooter from "../../components/landing/Footer";
import LandingHeader from "../../components/landing/Header";
import LandingHero from "../../components/landing/Hero";
import LandingHowItWorks from "../../components/landing/HowItWorks";
import LandingMarquee from "../../components/landing/Marquee";
import LandingRoles from "../../components/landing/Roles";
import LandingTrust from "../../components/landing/Trust";
import LandingWaitlist from "../../components/landing/Waitlist";

/**
 * Landing beeznoo.ao — Identidade Verde v4 (docs/DESIGN_SYSTEM.md, decisão 2026-11-16).
 * A taxa de serviço vem da API (PAYMENTS_SERVICE_FEE_RATE), revalidada a cada 5 min: mudar a variável no servidor
 * atualiza o exemplo de preço e a pergunta frequente sem novo build.
 */
export const revalidate = 300;

export default async function Home() {
  const feeRate = await getServiceFeeRate();
  return (
    <div className="lp">
      <LandingHeader />
      <main>
        <LandingHero feeRate={feeRate} />
        <LandingMarquee />
        <LandingCategories />
        <LandingHowItWorks />
        <LandingRoles feeRate={feeRate} />
        <LandingTrust />
        <LandingWaitlist />
        <LandingFaq feeRate={feeRate} />
      </main>
      <LandingFooter />
    </div>
  );
}
