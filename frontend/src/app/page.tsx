import BeeznoCategories from "../../components/landing/Categories";
import BeeznoFooter from "../../components/landing/Footer";
import BeeznoHero from "../../components/landing/Hero";
import BeeznoHighlights from "../../components/landing/Highlights";
import BeeznoHowItWorks from "../../components/landing/HowWorks";
import BeeznoNavbar from "../../components/landing/Navbar";
import BeeznoSecuring from "../../components/landing/Securing";
import BeeznoUseCases from "../../components/landing/UseCases";
import BeeznoWaitlist from "../../components/landing/Waitlist";

export default function Home() {
  return (
    <div>
      <main>
        <BeeznoNavbar />
        <BeeznoHero />
        <BeeznoCategories />
        <BeeznoUseCases />
        <BeeznoHowItWorks />
        <BeeznoHighlights />
        <BeeznoSecuring />
        <BeeznoWaitlist />
        <BeeznoFooter />
      </main>
    </div>
  );
}
