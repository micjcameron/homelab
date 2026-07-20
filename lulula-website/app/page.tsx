import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import PriceList from "@/components/PriceList";
import Gallery from "@/components/Gallery";
import AfterCare from "@/components/AfterCare";
import Testimonials from "@/components/Testimonials";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <PriceList />
        <Gallery />
        <AfterCare />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
