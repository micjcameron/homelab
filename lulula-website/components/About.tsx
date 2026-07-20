import { aboutText, site } from "@/lib/site";

export default function About() {
  return (
    <section className="section" id="about-me">
      <div className="container about__grid">
        <div className="about__photo">
          {/* Drop a photo of Lauren at /public/lauren.jpg to replace this panel. */}
          <img src="/lauren.jpg" alt="Lauren, owner of Nails at Lulula" />
        </div>
        <div className="about__body">
          <span className="section__eyebrow">About me</span>
          <h2 className="section__title">Hi, I&apos;m {site.owner}</h2>
          <p>{aboutText}</p>
          <p className="about__sign">{site.owner}</p>
        </div>
      </div>
    </section>
  );
}
