import Hero from "@/components/sections/hero";
import Navbar from "@/components/sections/navbar";
import FeaturesSection from "@/components/sections/features";
import HowWorks from "@/components/sections/how-works";
import Footer from "@/components/sections/footer";
import Cta from "@/components/sections/Cta";
import Faq from "@/components/sections/faq";
import Pricing from "@/components/sections/pricing";
import Testimonials from "@/components/sections/testimonials";
import Dashboard from "@/components/sections/dashboard";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <FeaturesSection />
      <HowWorks />

      <Dashboard />
      <Testimonials />

      <Pricing />

      <Cta />

      <Faq />

      <Footer />
    </main>
  );
}
