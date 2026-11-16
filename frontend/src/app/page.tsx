import "../../components/landing/landing.css";
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

/** Landing beeznoo.ao — Identidade Verde v4 (docs/DESIGN_SYSTEM.md, decisão 2026-11-16). */
export default function Home() {
  return (
    <div className="lp">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingMarquee />
        <LandingCategories />
        <LandingHowItWorks />
        <LandingRoles />
        <LandingTrust />
        <LandingWaitlist />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
