# Nails at Lulula — website

A rebuild of [lulula.nl](https://lulula.nl) as a **Next.js static-export** site. It builds
to a folder of plain HTML/CSS/JS (`out/`) that can be served by anything — ideal for the
Pi behind the Cloudflare tunnel. No PHP, no database, near-zero maintenance.

## Stack

- **Next.js 15** (App Router) with `output: "export"` → static files, no server needed
- **React 19** + TypeScript
- **Web3Forms** for the contact form (client-side POST → email to her inbox, no backend)
- Google Fonts via `next/font` (Cormorant Garamond + Montserrat)

## Local development

```bash
npm install
cp .env.example .env.local   # then paste your real Web3Forms key
npm run dev                  # http://localhost:3000
```

## Build the static site

```bash
npm run build     # outputs to ./out
npm run serve     # preview the built ./out locally (npx serve)
```

Deploy = copy `out/` to wherever the tunnel serves from.

## Before it goes live — checklist

1. **Contact form key.** Sign up at [web3forms.com](https://web3forms.com) with the
   destination email (info@lulula.nl or her Gmail), put the key in `.env.local` as
   `NEXT_PUBLIC_WEB3FORMS_KEY`. Without it the form will fail.
2. **Photos.** Placeholders show rose panels until you add real images:
   - `public/lauren.jpg` — the About photo
   - `public/gallery/1.jpg … 8.jpg` — gallery tiles
   - `public/og-image.jpg` — social share preview (referenced in structured data)
   Grab these from the current WordPress site before you cancel the hosting.
3. **SEO / don't lose rankings.** The domain stays the same, so rankings carry over IF:
   - URLs stay the same. The old site used `/#about-me`, `/#pricelist` etc. — anchors on
     one page. This rebuild keeps those exact anchor IDs, so inbound links still work.
   - After launch: verify the domain in **Google Search Console** and submit
     `https://lulula.nl/sitemap.xml`.
4. **Email/MX.** Cancelling the WordPress *hosting* is fine, but check the domain's **MX
   records** at GoDaddy first — if the current host handles the info@lulula.nl mailbox,
   set up forwarding (GoDaddy or Cloudflare Email Routing) so mail keeps reaching Gmail.

## Editing content

All copy, prices, testimonials, hours and links live in **`lib/site.ts`** — edit there,
rebuild, redeploy. No need to touch the components for routine text/price changes.
