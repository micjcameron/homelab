"use client";

import { useEffect, useRef, useState } from "react";
import { testimonials } from "@/lib/site";

export default function Testimonials() {
  const count = testimonials.length;
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const go = (n: number) => setI((n + count) % count);

  useEffect(() => {
    const id = setInterval(() => {
      if (!paused.current) setI((p) => (p + 1) % count);
    }, 7000);
    return () => clearInterval(id);
  }, [count]);

  const t = testimonials[i];

  return (
    <section className="section testimonials" id="testimonials">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title">What Clients Say</h2>
          <p>A few kind words from the Lulula chair.</p>
        </div>

        <div
          className="testi-slider"
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => (paused.current = false)}
        >
          <button
            className="testi-arrow testi-arrow--prev"
            onClick={() => go(i - 1)}
            aria-label="Previous review"
          >
            ‹
          </button>

          <div className="testi-slide" key={i}>
            <span className="testi-mark" aria-hidden="true">
              &ldquo;
            </span>
            <p className="testi-text">{t.quote}</p>
            <div className="testi-stars" aria-label="5 out of 5 stars">
              ★★★★★
            </div>
            <p className="testi-name">{t.name}</p>
          </div>

          <button
            className="testi-arrow testi-arrow--next"
            onClick={() => go(i + 1)}
            aria-label="Next review"
          >
            ›
          </button>
        </div>

        <div className="testi-dots">
          {testimonials.map((_, d) => (
            <button
              key={d}
              className={`testi-dot${d === i ? " is-active" : ""}`}
              onClick={() => go(d)}
              aria-label={`Go to review ${d + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
