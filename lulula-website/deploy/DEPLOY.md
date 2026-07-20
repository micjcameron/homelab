# Deploying lulula.nl to the VPS

The site is a **static export** — a folder of plain files. Serving it = point a web
server at that folder. No Docker, no Node on the server, no reverse proxy.

## One-time setup

### 1. DNS (at GoDaddy)
Point the domain at the VPS's static IP:

| Type  | Host | Value              |
|-------|------|--------------------|
| A     | @    | `<VPS_STATIC_IP>`  |
| A     | www  | `<VPS_STATIC_IP>`  |

> ⚠️ **Leave the MX records alone.** Where the *website* is hosted and where
> *email* (info@lulula.nl → Gmail) is handled are independent. Don't touch MX/TXT
> when changing the A records, or her mail forwarding breaks.

DNS can take up to a few hours to propagate.

### 2. VPS: install Caddy + make the web folder
```bash
sudo apt install -y caddy          # or the official Caddy repo
sudo mkdir -p /var/www/lulula
sudo chown -R "$USER" /var/www/lulula
```
Open ports **80** and **443** in the firewall (Caddy needs 80 to get the TLS cert).

### 3. VPS: install the Caddyfile
Copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile`, then:
```bash
sudo systemctl reload caddy
```
Caddy automatically fetches a Let's Encrypt certificate once DNS resolves to the box.
That's HTTPS done — no certbot.

## Every deploy (from your laptop)

```bash
cd lulula-website
VPS=youruser@your.vps.ip ./deploy/deploy.sh
```
This builds locally and rsyncs `out/` to the server. Adding gallery photos? Drop them
in `public/gallery/`, then run the same command — the build picks them up and `--delete`
cleans out anything removed.

## Alternative: build on the VPS
If you'd rather `git pull && build` on the box (needs Node 20+ installed there):
```bash
git clone <repo> /srv/lulula && cd /srv/lulula/lulula-website
npm ci && npm run build
rsync -a --delete out/ /var/www/lulula/
```
The 2 GB box handles this build fine, but the laptop-rsync route keeps the server minimal.

## Don't forget
- `NEXT_PUBLIC_WEB3FORMS_KEY` must be set at **build time** (in `.env.local` where you
  build) or the contact form won't send. It's baked into the static files.
- After go-live: verify the domain in **Google Search Console** and submit
  `https://lulula.nl/sitemap.xml`.
