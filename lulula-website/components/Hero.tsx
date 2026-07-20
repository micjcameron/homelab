import { site } from "@/lib/site";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__overlay" />
      <div className="container hero__content">
        <p className="hero__eyebrow">Welcome to</p>
        <h1 className="hero__title">
          <span className="hero__title-caps">Nails at</span>
          <span className="hero__script">Lulula</span>
        </h1>
        <div className="hero__actions">
          <a
            className="btn btn--hero"
            href={site.booking}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book an Appointment <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
