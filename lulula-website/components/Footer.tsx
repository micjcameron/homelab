import { site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          <strong>{site.name}</strong> · {site.location}
        </p>
        <p>
          <a href={`mailto:${site.email}`}>{site.email}</a> ·{" "}
          <a href={site.whatsapp} target="_blank" rel="noopener noreferrer">
            {site.phoneDisplay}
          </a>
        </p>
        <p className="footer__small">
          © {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
