"use client";

import { useEffect, useRef } from "react";

export default function GalleryCarousel({ images }: { images: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || images.length < 2) return;

    const id = setInterval(() => {
      if (paused.current) return;
      const first = track.querySelector<HTMLElement>(".gallery-slide");
      if (!first) return;

      const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
      const step = first.offsetWidth + gap;
      const atEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + step,
        behavior: "smooth",
      });
    }, 2000);

    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div
      className="gallery-carousel"
      ref={trackRef}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={() => (paused.current = true)}
      onTouchEnd={() => (paused.current = false)}
    >
      {images.map((src, i) => (
        <figure className="gallery-slide" key={src}>
          <img
            src={src}
            alt={`Nail art by Nails at Lulula, example ${i + 1}`}
            loading="lazy"
          />
        </figure>
      ))}
    </div>
  );
}
