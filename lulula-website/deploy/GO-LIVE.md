# Lulula — full go-live runbook

Everything needed to move lulula.nl off the €15/mo WordPress hosting onto the VPS,
with `info@lulula.nl` forwarding to a new Gmail. **Do the steps roughly in this order** —
the ordering matters (don't cancel hosting until mail + site are proven working).

---

## The mental model (read this first)

- **Domain registration** = GoDaddy. Unchanged. (Keep paying the ~€15/yr renewal.)
- **DNS** (where the domain's records live) = moving from GoDaddy → **Cloudflare**.
- **Website** = static files on your **VPS**, served by Caddy.
- **Email** = a **new Gmail** is the real inbox; **Cloudflare Email Routing** forwards
  `info@lulula.nl` → that Gmail. `info@` is a *forward*, not a mailbox.

Three independent things share the domain: **A records** (website), **MX records** (email),
**nameservers** (who answers DNS). Changing one need not break the others — as long as you
don't drop the MX records.

---

## Phase 0 — Prep (nothing live changes yet)

1. **Screenshot the current DNS at GoDaddy.** Log in → DNS management for lulula.nl →
   capture **every** record: A, CNAME, **MX**, **TXT** (SPF/DKIM), any subdomains. This is
   your safety net when moving to Cloudflare.
2. **Get the Web3Forms key** (contact form): web3forms.com → enter the new Gmail as the
   destination → paste the key into `lulula-website/.env.local`:
   `NEXT_PUBLIC_WEB3FORMS_KEY=...`
3. **Create the new business Gmail** (e.g. nailsatlulula@gmail.com).
4. **Create a free Brevo account** (used in Phase 5b for sending as info@lulula.nl).
5. **Build & smoke-test locally:** `npm run build && npm run serve` → click every link,
   submit the contact form, confirm it lands in the new Gmail.

## Phase 1 — Migrate her existing emails (WHILE OLD HOSTING IS STILL ON)

> ⚠️ Once hosting is cancelled the old mailbox is deleted. Migrate first.

1. Get the old mailbox's **IMAP settings + password** from the host's control panel
   (cPanel / webmail → email accounts → connect devices).
2. Install **Thunderbird** (free). Add two accounts:
   - the **old mailbox** via IMAP,
   - the **new Gmail** via IMAP (enable IMAP in Gmail settings first).
3. In Thunderbird, select the old mail (incl. the invoice folders), **drag-copy** into a
   folder under the new Gmail account. Verify they appear in Gmail (web).
   - Alternative: Gmail → Settings → Accounts and Import → **Import mail and contacts**
     (POP-based, one-click, but grabs the inbox only — Thunderbird is better for folders).

## Phase 2 — Prep the VPS (can run in parallel with the above)

Follow **`DEPLOY.md`**. Summary:
1. Install Caddy, `mkdir -p /var/www/lulula`, open ports 80/443 (+ your VPN port).
2. Harden: SSH keys only, disable root/password login, ufw default-deny, fail2ban,
   unattended-upgrades. (Ask me for the hardening script.)
3. Deploy the built site: from `lulula-website/`, `VPS=user@ip ./deploy/deploy.sh`.
4. Install `deploy/Caddyfile` at `/etc/caddy/Caddyfile`, `sudo systemctl reload caddy`.
   (Cert won't issue until DNS points here — that's Phase 4.)

## Phase 3 — Add the domain to Cloudflare

1. Cloudflare (free plan) → **Add a site** → `lulula.nl`.
2. It scans and imports existing DNS. **Compare against your Phase-0 screenshot** — make
   sure **MX and TXT records came across**. Add any that are missing. (At this point keep
   the old host's MX so mail keeps flowing to the old mailbox during the transition.)
3. Cloudflare shows **two nameservers** — note them for Phase 5.
4. Set the website records:
   - `A  @   → <VPS_IP>`  — **grey cloud (DNS only)**
   - `A  www → <VPS_IP>`  — **grey cloud (DNS only)**
   > Grey cloud = traffic goes straight to the VPS, so Caddy's automatic Let's Encrypt just
   > works. (You can switch to orange-cloud proxy/CDN later; it needs a Cloudflare Origin
   > cert in Caddy — not worth it for launch.)
5. SSL/TLS mode: **Full** is fine (grey cloud makes it moot).

## Phase 4 — Point the nameservers (the actual cutover)

1. At **GoDaddy**: domain settings → **Nameservers** → change to Cloudflare's two.
2. Wait for propagation (Cloudflare emails you when active — minutes to a few hours).
3. Once active, Caddy issues the HTTPS cert automatically. Visit `https://lulula.nl`.

## Phase 5 — Email: receive AND send as info@lulula.nl

The goal: live entirely in the new Gmail, but read *and* send as info@lulula.nl. Three free
pieces — Cloudflare (inbound), Brevo (outbound SMTP), Gmail (the inbox).

### 5a — Inbound (Cloudflare Email Routing) — forward info@ → Gmail
1. Cloudflare → **Email → Email Routing** → enable. It adds the routing **MX + TXT**
   records (this **replaces** the old host's MX — from now, new mail forwards to Gmail,
   not the old mailbox).
2. **Destination addresses** → add the new Gmail → Gmail gets a verify email → click it.
3. **Routing rules** → `info@lulula.nl` → new Gmail. (Optionally a **catch-all** → Gmail.)
4. **Test:** email info@lulula.nl from your phone → confirm it lands in the new Gmail.

### 5b — Outbound (send as info@lulula.nl from Gmail)
Cloudflare forwarding is inbound-only, so sending *as* info@ needs an SMTP relay + auth records.
1. Create a free **Brevo** account → **SMTP & API** → note the SMTP host, port 587, login,
   and SMTP key. (Free = 300 emails/day, ample.)
2. In Brevo, **add & verify the domain lulula.nl** → it gives you an **SPF** and a **DKIM**
   record → add both in **Cloudflare DNS** (TXT). These authorise Brevo to send as @lulula.nl
   and keep mail out of spam.
3. Gmail → Settings → **Accounts and Import → "Send mail as" → Add another email address**
   → `info@lulula.nl` → enter Brevo's SMTP (host, 587, login, key).
4. Gmail sends a verification code to info@ → Cloudflare forwards it back to this Gmail →
   enter the code.
5. **Test:** compose in Gmail, set **From: info@lulula.nl**, send to yourself → confirm it
   arrives and shows the right sender (check it's not in spam).

### 5c — Final old-mailbox sweep
6. Do a **last check of the old mailbox** for any stragglers before Phase 7.

> Simpler alternative to 5b: use **Zoho Mail free** as a real info@ mailbox (send+receive in
> one service) instead of Cloudflare-forward + Brevo. Still needs SPF/DKIM. Chosen path here
> is Gmail-centric so she stays in Gmail.

## Phase 6 — Verify everything

- [ ] `https://lulula.nl` loads with a padlock; `www` redirects to apex.
- [ ] Every nav link, booking button (Salonized), WhatsApp, socials work.
- [ ] Contact form submits → arrives in new Gmail (Web3Forms).
- [ ] Test email to info@lulula.nl → arrives in new Gmail.
- [ ] Looks right on a real phone.

## Phase 7 — Cancel the old hosting 🎉

Only after Phase 1 (emails saved) **and** Phase 5 (new mail verified) **and** Phase 6.
Cancel the **hosting** plan. **Do NOT cancel the domain registration** at GoDaddy — that's
separate and must stay.

## Phase 8 — SEO (keep her rankings)

1. **Google Search Console** → add property `lulula.nl` → verify via a **DNS TXT record**
   (add it in Cloudflare).
2. Submit `https://lulula.nl/sitemap.xml`.
3. Spot-check a few pages with URL Inspection. URLs/anchors are preserved, so rankings carry
   over within days.

---

## One-page checklist

```
[ ] Screenshot GoDaddy DNS (A/CNAME/MX/TXT)
[ ] Web3Forms key → .env.local
[ ] Create new business Gmail
[ ] Create free Brevo account (for send-as)
[ ] Build + local smoke test (form → Gmail)
[ ] Migrate old emails via Thunderbird (hosting still ON)
[ ] VPS: Caddy + hardening + deploy + Caddyfile
[ ] git init the site into its own repo
[ ] Cloudflare: add site, verify MX/TXT imported, set A records (grey cloud)
[ ] GoDaddy: nameservers → Cloudflare
[ ] Caddy HTTPS cert issues; site loads
[ ] Email 5a inbound: Cloudflare Routing info@ → Gmail, test
[ ] Email 5b outbound: Brevo SMTP + SPF/DKIM in Cloudflare + Gmail Send-As, test
[ ] Full verify pass (site + form + inbound + outbound + mobile)
[ ] Cancel old hosting (NOT the domain)
[ ] Search Console: verify + submit sitemap
```
