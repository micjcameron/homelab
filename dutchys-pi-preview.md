# Dutchys — Pi preview deploy runbook

How to (re)deploy the **Dutchys** dev/staging stack onto the Raspberry Pi for PO preview,
served via the Cloudflare tunnel, frontend behind an email gate.

- **App code lives in a separate repo:** `~/Desktop/Work/Repos/dutchys`
- **Pi:** `micjcameron@192.168.1.128`
- Naming is mildly inconsistent (live with it): repo dir = `dutchys`, compose project /
  image prefix = `dutchies-infra`, public hostnames = `dutchies.camcosolutions.nl`.

---

## ⛔ The golden rule: BUILD ON THE MAC, RUN ON THE PI

**The Pi cannot build this stack.** A full Next.js + NestJS compile pegs all 4 cores at
99%, which **browns out the Pi (undervoltage) and hard-reboots it** mid-build. Memory isn't
the issue — power/CPU is.

So the pattern is: **build the images on the Mac** (Apple Silicon = `arm64`, the same arch
the Pi runs), **ship the built images to the Pi**, and **only run them there**. Running
containers is light; compiling is the killer.

---

## Architecture / wiring (reference)

| Piece | Host port | Tunnel hostname | Access |
|---|---|---|---|
| Frontend (Next.js :3000) | `4007` | `dutchies.camcosolutions.nl` | 🔒 email-gated (you + PO) |
| Backend (Nest :4000) | `4008` | `dutchies-api.camcosolutions.nl` | 🌐 public |
| Postgres :5432 | `5434` | — | local only |

- The tunnel runs **on the Pi** (host network), so Cloudflare Public Hostnames point at
  **`http://localhost:4007` / `:4008`** — **no Pi static IP needed**.
- `NEXT_PUBLIC_*` is **baked into the browser bundle at build time** → must be the public
  hostnames when building (or the browser calls the wrong host).
- **Never gate `dutchies-api`** — Mollie's webhook (`/payments/webhook`) is server-to-server
  and the frontend calls the API directly from the browser for catalog/session. Gating it
  breaks both. Frontend gated, API open (it's protected by HMAC + CORS + read-only catalog).
- Env: `API_BASE_URL=http://backend:4000` (internal HMAC proxy), `HMAC_SECRET` identical
  both sides, `MOLLIE_API_KEY=test_…`, `CORS_ORIGINS` includes the frontend host.
- `NODE_ENV=development` → TypeORM `synchronize=true` (schema auto-builds; fine for preview,
  **not** prod). SMTP is **live** — test orders/contact forms send real email.

---

## Redeploy — copy-paste

### 1. Build on the Mac (arm64, public hostnames baked)
```bash
cd ~/Desktop/Work/Repos/dutchys/dutchies-infra
DOCKER_DEFAULT_PLATFORM=linux/arm64 \
NEXT_PUBLIC_API_BASE_URL=https://dutchies-api.camcosolutions.nl \
NEXT_PUBLIC_SITE_URL=https://dutchies.camcosolutions.nl \
docker compose -f docker-compose.dev.yml build
```

### 2. Ship the built images to the Pi (no compile on the Pi)
```bash
docker save dutchies-infra-backend:latest dutchies-infra-frontend:latest \
  | gzip -1 \
  | ssh micjcameron@192.168.1.128 'gunzip | docker load'
```

### 3. Sync compose + env to the Pi (config only; env is gitignored but rsync includes it)
```bash
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .next --exclude dist \
  --exclude .venv --exclude output --exclude tmp --exclude '*.log' \
  ~/Desktop/Work/Repos/dutchys/ micjcameron@192.168.1.128:/home/micjcameron/dutchys/
```

### 4. Run on the Pi — **NO `--build`** (uses the loaded images)
```bash
ssh micjcameron@192.168.1.128 \
  'cd ~/dutchys/dutchies-infra && docker compose -f docker-compose.dev.yml up -d'
```

### 5. Seed the DB (first deploy, or after a DB reset)
```bash
ssh micjcameron@192.168.1.128 \
  'cd ~/dutchys/dutchies-infra && docker compose -f docker-compose.dev.yml exec -T backend npm run db:seed'
```

### 6. Verify
```bash
# local on the Pi
ssh micjcameron@192.168.1.128 'curl -s localhost:4008/health; echo; \
  curl -s -o /dev/null -w "frontend %{http_code}\n" localhost:4007/'

# public through Cloudflare (run from anywhere)
curl -s https://dutchies-api.camcosolutions.nl/health            # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://dutchies.camcosolutions.nl/   # 302 = gated, good
```

### 7. Gate the frontend (one-time; persists across redeploys)
```bash
cd ~/Desktop/Personal/homelab/home-automation/stacks/cloudflared
./cf-access.sh gate dutchies micjcameron@gmail.com,ferdy.burghout@optimauitzendburo.nl
./cf-access.sh show dutchies      # confirm TWO separate emails
# NEVER: ./cf-access.sh gate dutchies-api  ← would break Mollie + the site
```

---

## One-time setup (already done — here for reference / disaster recovery)

- **Cloudflare → Networks → Tunnels → [tunnel] → Public Hostname** ("Published application
  routes"): `dutchies → http://localhost:4007`, `dutchies-api → http://localhost:4008`.
  (Cloudflare auto-creates the DNS.)
- `home-automation/stacks/cloudflared/proxies.json`: `dutchies` + `dutchies-api` entries.

---

## Day-to-day ops

```bash
# from the Pi: cd ~/dutchys/dutchies-infra
docker compose -f docker-compose.dev.yml logs -f backend     # tail logs
docker compose -f docker-compose.dev.yml restart backend     # restart one service
docker compose -f docker-compose.dev.yml ps                  # status
docker compose -f docker-compose.dev.yml down                # stop (KEEPS the DB volume)
docker compose -f docker-compose.dev.yml down -v             # stop + WIPE the DB
```

**Pushing an app change** = repeat steps **1 → 2 → 4** (rebuild on Mac, reship, `up -d`).
The DB persists in the `dutchys_pg_dev` volume, so only re-seed (step 5) if you wiped it or
changed the seed data.

---

## Gotchas (learned the hard way)

- **Pi can't build** — brownout reboot. Always build on the Mac.
- **`NEXT_PUBLIC_*` is build-time** — pass the public hostnames as build args (step 1) or the
  browser bundle calls the wrong API.
- **Don't gate `dutchies-api`** — kills Mollie webhooks + browser catalog calls.
- **`cf-access.sh` multi-email** — needs the fixed version (splits on comma correctly; the
  old one mashed multiple emails into one invalid entry and locked everyone out).
- **SMTP is live** — test orders fire real emails to `info@hottubensauna.nl` / your gmail.
- **Mac must be Apple Silicon** (arm64) for native builds; `DOCKER_DEFAULT_PLATFORM=linux/arm64`
  guarantees the right arch either way.
