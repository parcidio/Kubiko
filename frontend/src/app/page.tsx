import BeeznoCategories from "../../components/landing/Categories";
import BeeznoHero from "../../components/landing/Hero";
import BeeznoHowItWorks from "../../components/landing/HowWorks";
import BeeznoNavbar from "../../components/landing/Navbar";

export default function Home() {
  return (
    <div>
      <main>
        <BeeznoNavbar />
        <BeeznoHero />
        <BeeznoHowItWorks />
        <BeeznoCategories />
      </main>
    </div>
  );
}
