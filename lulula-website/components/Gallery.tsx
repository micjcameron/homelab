import fs from "fs";
import path from "path";
import GalleryCarousel from "./GalleryCarousel";

// Read every image in /public/gallery at build time. Drop new files in that folder
// and rebuild (`npm run build`) — they're picked up automatically, no code changes.
function getGalleryImages(): string[] {
  const dir = path.join(process.cwd(), "public", "gallery");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => `/gallery/${f}`);
  } catch {
    return [];
  }
}

export default function Gallery() {
  const images = getGalleryImages();

  return (
    <section className="section" id="gallery">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title">Gallery</h2>
          <p>A little look at some of the sets I&apos;ve created.</p>
        </div>
      </div>

      {images.length > 0 ? (
        <GalleryCarousel images={images} />
      ) : (
        <p className="gallery__hint">
          Add photos to <code>public/gallery/</code> and rebuild to fill this
          space.
        </p>
      )}
    </section>
  );
}
