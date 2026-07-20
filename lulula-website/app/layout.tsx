import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import { site } from "@/lib/site";
import "./globals.css";

const heading = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const body = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

// The exact signature script from the original site (Grand Junction Script),
// self-hosted so the "Lulula" wordmark matches 1:1.
const script = localFont({
  src: "./fonts/grand-junction-script.ttf",
  variable: "--font-script",
  display: "swap",
});

// Declare the site as light-only so mobile browsers (Chrome/Samsung "force dark")
// don't auto-invert the cream palette into the dark maroon you saw.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#faf6f4",
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Nails at Lulula | Professional Nail Salon in Geldermalsen",
    template: "%s | Nails at Lulula",
  },
  description:
    "Nails at Lulula — a professional nail salon in Geldermalsen, Netherlands. Gel, BIAB and acrylic nails, manicures, and luxury foot treatments by Lauren. Book your appointment online today.",
  keywords: [
    "nail salon Geldermalsen",
    "nails Geldermalsen",
    "gel nails",
    "BIAB nails",
    "acrylic nails",
    "manicure Geldermalsen",
    "Nails at Lulula",
    "nagels Geldermalsen",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: site.url,
    siteName: site.name,
    title: "Nails at Lulula | Professional Nail Salon in Geldermalsen",
    description:
      "Gel, BIAB and acrylic nails, manicures, and luxury foot treatments by Lauren in Geldermalsen, Netherlands.",
  },
  robots: { index: true, follow: true },
};

// LocalBusiness structured data — helps Google show hours, location and rating.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "NailSalon",
  name: site.name,
  image: `${site.url}/og-image.jpg`,
  url: site.url,
  email: site.email,
  telephone: site.phoneDisplay,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Geldermalsen",
    addressCountry: "NL",
  },
  sameAs: [site.instagram, site.facebook],
  priceRange: "€€",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} ${script.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
