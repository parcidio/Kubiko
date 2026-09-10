import BeeznoCategories from "../../components/landing/Categories";
import BeeznoHero from "../../components/landing/Hero";
import BeeznoNavbar from "../../components/landing/Navbar";

export default function Home() {
  return (
    <div>
      <main>
        <BeeznoNavbar />
        <BeeznoHero />
        <BeeznoCategories />
      </main>
    </div>
  );
}
