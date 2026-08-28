# VPS egress box — your own personal VPN with a fixed EU IP

**What this is for:** a private VPN you own, so that wherever in the world you are, you can
choose to appear as if you're sitting in the EU on one unchanging IP address.

The main use is **travel**. Work from South Africa (or anywhere) and flip one switch, and
your traffic surfaces in Helsinki instead — useful when a service is EU-only, when you want
one stable address rather than whatever a hotel's wifi hands you, or when you simply don't
trust the café network you're on.

The secondary use is **IP whitelisting**: if a client or portal ever says "we'll only let
you in from one approved address", this is that address. Nothing currently needs this —
EasyFlex, which was the original reason for the box, is no longer in the picture — but the
capability is set up and costs nothing to keep.

> **This is not a commercial VPN and shouldn't be judged as one.** No server list, no
> country-hopping, and see [the honest limits](#what-this-is-not-good-for) before you try to
> watch anything with it. What it *is*: yours, private, on hardware you already pay for.

> **Plain-English glossary (read this once):**
> - **VPS** = "Virtual Private Server". A small computer you rent in a datacenter. It's
>   always on and has a permanent public IP address.
> - **SSH** = the way you log into that computer from your Mac's terminal (encrypted).
> - **Tailscale** = a tool that builds a tiny private encrypted network between *your*
>   devices (your Mac + the VPS), so they can talk safely without opening any ports.
> - **Exit node** = a Tailscale setting that means "send my internet *through* this device".
>   We make the VPS an exit node, so your Mac's traffic leaves from the VPS's IP.
> - ⚠️ **"Connected to Tailscale" and "exit node ON" are DIFFERENT things** — this trips
>   everyone up. Being *connected* is always-on, invisible, and costs you nothing: normal
>   browsing, normal speed. The *exit node* is the separate menu-bar toggle that reroutes
>   your traffic through Helsinki, and you only want that on when you actually want to
>   appear European. Anything
>   that just needs the tailnet — like SSH to the box — works with the exit node **off**.
> - **Egress** = traffic going *out* from you to the internet. (The opposite, *inbound*,
>   is traffic coming *to* you — that's what your Cloudflare tunnel handles. Different job.)

---

## ⚠️ This box is NOT a spare — read this first

Unlike the old STRATO box, which did nothing but egress, this machine is your
**production host**. It is already serving `camcosolutions.nl` (the fpl-predictor stack:
Caddy, Postgres, cloudflared). Egress is a *second* job bolted onto a working server.

That is a deliberate and sensible choice — 2 vCPU / 4 GB is far more than an exit node
needs, and the Tailscale daemon is ~50 MB and one process. But it changes two things:

- **Be careful with the firewall.** `ufw` had never been enabled here. See
  [the firewall section](#part-2--harden-the-box) for the two specific traps.
- **Traffic, not RAM, is the meter that matters.** Every byte your Mac loads while the
  exit node is on comes out of the box's monthly allowance (20 TB, ~2.8 TB used). RAM was
  never the constraint; bandwidth is the one that could actually bite. Streaming video all
  day with the exit node on is the only realistic way to notice.

Deploys to this box for the app itself go through `fpl-predictor/ship.sh`, not this folder.

---

## Your build — actual values (reference)

Verified against the live box, so future-you doesn't have to dig:

| Thing | Value |
|---|---|
| VPS provider | **Hetzner Cloud** — `AS24940`, **Helsinki, Finland** (`hel1`) |
| OS / arch | **Ubuntu 26.04 LTS**, x86_64, kernel 7.0 |
| Spec | 2 vCPU · 4 GB RAM · 40 GB disk · 20 TB/mo traffic |
| **VPS public IP — whitelist THIS** | **`37.27.38.196`** |
| System hostname | `camcosolutions` |
| Tailscale name (VPS) | `camcosolutions-vps1` · tailnet IP `100.66.213.19` · MagicDNS `camcosolutions-vps1.tailb948ce.ts.net` |
| Tailscale name (Mac) | `michaels-macbook-pro-1` · tailnet IP `100.64.80.18` |
| Tailscale account | `micjcameron@gmail.com` |
| VPS network interface | **`eth0`** (used by the speed tweak in Part 3c) |
| Login to the VPS | **`ssh root@camcosolutions-vps1`** — tailnet ONLY; public SSH is firewalled off. Key auth, `~/.ssh/id_ed25519` |
| Also runs | fpl-predictor → **`fpl.camcosolutions.nl`** (behind Cloudflare Access), via cloudflared |

> **`37.27.38.196` is the address you appear as** when the exit node is on — and what you'd
> hand over if something ever asks you to whitelist an IP. It only changes if you destroy
> the server.

### What changed from the old setup

| | Old | New |
|---|---|---|
| Provider / location | STRATO, **Germany** | Hetzner, **Helsinki, Finland** |
| Public IP | `217.160.75.214` | **`37.27.38.196`** |
| NIC | `ens6` | **`eth0`** |
| OS | Ubuntu 24.04 | Ubuntu 26.04 |
| Role | egress only | egress **+ production web host** |

> ⚠️ **Latency is worse than the old box, and that's expected.** Finland is further from the
> Netherlands than Germany was. From home, budget **~30–40 ms** instead of the old ~10–25 ms
> — invisible for normal work. From **South Africa expect ~180–250 ms**; see
> [using it abroad](#part-6--using-it-abroad-the-actual-point-now).

---

## What you'll end up with

```
   You, anywhere          Tailscale (encrypted)        The internet
 ┌───────────────┐                                   ┌───────────────┐
 │  Your Mac      │ ───────────────────────────────► │   VPS          │ ──► the site
 │ (Cape Town,    │      "use VPS as exit node"       │  Helsinki 🇫🇮   │     you're
 │  hotel, café)  │                                   │ 37.27.38.196   │     visiting
 └───────────────┘                                   └───────────────┘
                                       ▲ everything you load appears to come from here
```

Toggle the exit node **on** when you're working → you appear as the VPS IP.
Toggle it **off** when you're done → normal browsing.

---

## Current status — what's already done

The box was provisioned on **2026-08-28**. Already live:

- ✅ Tailscale **1.102.3** installed and logged in as `camcosolutions-vps1`
- ✅ IP forwarding persisted in `/etc/sysctl.d/99-tailscale.conf` (v4 **and** v6)
- ✅ Exit node **advertised** (`tailscale up --advertise-exit-node --hostname=egress`)
- ✅ UDP GRO speed tweak on `eth0`, via `tailscale-gro.service` (survives reboot)
- ✅ **Auto-update enabled** (`tailscale set --auto-update`) — `Check: true, Apply: true`
- ✅ **Exit node APPROVED** in the admin console — box reports `offers exit node`
- ✅ Old `egress` (STRATO) and the stale `michaels-macbook-pro` removed from the tailnet
- ✅ Tailscale installed on the Mac (`michaels-macbook-pro-1`, `100.64.80.18`) — connection is **direct**, not DERP-relayed
- ✅ VPS renamed to **`camcosolutions-vps1`**; `ssh root@camcosolutions-vps1` works via MagicDNS
- ✅ **Exit node verified end-to-end** — with it on, `curl -4 ifconfig.me` returns `37.27.38.196`
- ✅ Cloudflare tunnel token rotated onto a new tunnel (`417c0a47…`); old tunnel deleted

- ✅ **Key expiry disabled** on `camcosolutions-vps1`
- ✅ **`harden.sh` run** with `ALLOW_ROUTED=true` — ufw active (`allow (routed)`), fail2ban active, unattended-upgrades on
- ✅ **Root password set** (`passwd -S root` → `P`), so the Hetzner console is a real fallback
- ✅ **2FA enabled** on the Hetzner account

**Nothing outstanding.** The box is done.

- ✅ **Rebooted onto kernel `7.0.0-30`** — durability test passed: Tailscale, exit node, forwarding, GRO service, ufw, fail2ban and all six containers came back unaided.
- ✅ **Public SSH CLOSED** — port 22 now only accepts connections on `tailscale0`. The box
  has **zero public inbound TCP ports**. Verified: `37.27.38.196:22` times out,
  `100.66.213.19:22` works.
- ✅ `fpl-predictor/ship.sh` updated to deploy over the tailnet (no public-IP fallback,
  because there is no longer a public route)

---

## Part 2 — Harden the box

There's a reusable **[`harden.sh`](./harden.sh)** in this folder: firewall, automatic
security updates, fail2ban, and an SSH lockdown. Run it **on the VPS**:

```bash
scp harden.sh root@37.27.38.196:/root/harden.sh
ssh root@37.27.38.196
chmod +x /root/harden.sh
ALLOW_ROUTED=true /root/harden.sh
```

> **`ALLOW_ROUTED=true` is not optional on this box.** Read the next section for why.

### The two firewall traps on this machine

`ufw` had **never been enabled** here, which makes both of these live risks rather than
theory:

**1. `ufw` and exit-node forwarding fight over the FORWARD chain.**
An exit node forwards packets that are neither *to* nor *from* the box, so they're governed
by the `FORWARD` chain, whose policy ufw sets to `DROP`.

To be precise about this, because the old doc was vague: Tailscale installs its own
`ts-forward` chain that ACCEPTs its traffic *before* the policy applies, so forwarding does
work under a `DROP` policy. On this box right now, `iptables -S FORWARD` shows exactly that
— policy `DROP`, with `-j ts-forward` first. So this is **not** a guaranteed instant break.

The problem is ordering. Enabling or reloading ufw rewrites the FORWARD chain, and can land
its own rules ahead of `ts-forward`; Tailscale re-adds its rules on its own schedule, so you
get a race that shows up as an exit node that works, then doesn't, with no error anywhere.
Setting the policy explicitly removes the race, which is why Tailscale's own docs tell ufw
users to do it. `harden.sh` now does it when `ALLOW_ROUTED=true`.

> **Tighter alternative, if you'd rather not blanket-ACCEPT all forwarding:**
> `ufw route allow in on tailscale0 out on eth0` permits only exit-node traffic instead of
> everything. More surgical, slightly more to remember. Either is defensible; the blanket
> one is what Tailscale documents.

**2. `ufw` does not protect Docker-published ports.** Docker writes its own iptables rules
(`DOCKER-USER`) that bypass ufw entirely, so a container published to `0.0.0.0` is exposed
*even with ufw showing "deny incoming"*. Right now this is harmless — the only published
port is `127.0.0.1:5432` (Postgres, localhost-only), and Caddy's 80/443 are container-internal
because traffic arrives through the cloudflared tunnel, not the public interface. **Keep it
that way:** bind new container ports to `127.0.0.1`, or write explicit `DOCKER-USER` rules.

**You do not need `ALLOW_HTTP=true` on this box.** The website is served through the
cloudflared tunnel, which is an *outbound* connection — nothing listens on the host's
80/443. Verified: the only public listener is port 22.

### What harden.sh will change

It runs `apt-get upgrade`. Checked before writing this: 14 packages pending, **no kernel
and no Docker engine** — only `docker-compose-plugin`, a CLI helper whose upgrade does not
restart containers. So no expected downtime for the site. Re-check before you run it:

```bash
ssh root@37.27.38.196 'apt list --upgradable 2>/dev/null | grep -iE "docker-ce|containerd|linux-image"'
```

If that prints nothing, you're clear. If it lists the Docker **engine** or a kernel, run it
at a quiet moment — those can bounce your containers.

> ⚠️ **Before you close that SSH session**, open a SECOND terminal and confirm you can
> still `ssh root@37.27.38.196`. If the SSH lockdown went wrong, the first window is still
> open to undo it. `harden.sh` validates with `sshd -t` before reloading and keeps root key
> login, so this is belt-and-braces — but do it anyway.

---

## Is Tailscale on a production box safe?

Short version: **yes, and it lets you make the box safer than it was.** The long version,
audited against the live machine on 2026-08-28.

### What Tailscale added to the attack surface

Exactly **one** new public listener: **`UDP 41641`** (WireGuard). The tailscaled TCP
listeners are bound to the *tailnet* addresses (`100.66.213.19`, `fd7a:…`), not the public
interface.

That port is close to a non-event. WireGuard does not respond to unauthenticated packets at
all — no handshake, no banner, no error — so it is cryptographically silent to scanners.

### What is NOT exposed (the thing worth double-checking)

- **Postgres is not reachable over the tailnet.** It's bound to `127.0.0.1:5432`; the
  tailnet interface is a different address. Verify any time with `ss -tlnp | grep 5432` —
  if that ever shows `0.0.0.0`, fix it, because the tailnet *would* then reach it.
- **Exit-node traffic never touches the app.** It's kernel-level packet forwarding, entirely
  separate from the Docker networks the containers sit on.
- **The site's availability doesn't depend on this box's IP reputation** — inbound arrives
  through the Cloudflare tunnel, not the public interface.

### The genuine risks, honestly

| Risk | Severity | Why it's acceptable |
|---|---|---|
| `tailscaled` runs as **root** | Low–moderate | A daemon vuln would be serious. Mitigated: auto-update is on (see below), so it patches itself. |
| Any tailnet device can reach the box's non-loopback ports | Low | Today that's SSH only, which is key-only. A compromised Mac could reach the box — but it could already reach public port 22 anyway, so this is barely a delta. |
| **Disabling key expiry** (Part 3a) means a stolen node key stays valid indefinitely | Low | Standard practice for servers; the alternative is the exit node silently dying every 6 months. Accepted deliberately. |
| Tailscale's coordination server controls tailnet membership | Very low | They cannot decrypt your traffic (WireGuard is end-to-end), but they do control who joins. `tailnet lock` exists if you ever want to remove that trust; overkill here. |
| Your browsing and your server share one public IP | Very low | Only matters if you got the IP blocklisted. Site inbound is unaffected (Cloudflare tunnel). |

### ✅ Done: Tailscale auto-patching

Tailscale installs from **its own apt repo** (`/etc/apt/sources.list.d/tailscale.list`), and
`unattended-upgrades` only covers Ubuntu security origins — so it would **not** have patched
`tailscaled`, a root daemon. Tailscale's built-in updater is now on:

```bash
tailscale set --auto-update          # already applied 2026-08-28
tailscale debug prefs | grep -A3 AutoUpdate   # verify: Check true, Apply true
```

### The actual win: take SSH off the public internet

This is the highest-value security action available on this box, and Tailscale is what
makes it possible.

Port 22 is open to the whole internet and under constant attack — measured on 2026-08-28:

> **2,879 failed SSH attempts in 24 hours, from 91 distinct IPs.**

None can succeed (keys only, no password auth, root is `prohibit-password`), and `fail2ban`
from `harden.sh` will thin them out. But once the tailnet is proven working, you can stop
accepting SSH from the internet entirely and reach the box over the tailnet instead — taking
it to **zero public inbound TCP ports**:

**✅ This was done on 2026-08-28.** The commands used, for the record:

```bash
ufw allow in on tailscale0 to any port 22 proto tcp comment 'SSH over tailnet'
ufw delete allow 22/tcp          # twice — there is a v4 and a v6 rule
ufw delete allow 22/tcp
```

Resulting policy — note there is no `Anywhere` rule left:

```
22/tcp on tailscale0       ALLOW IN    Anywhere       # SSH over tailnet
22/tcp (v6) on tailscale0  ALLOW IN    Anywhere (v6)  # SSH over tailnet
```

> **`ss -tlnp` still shows `0.0.0.0:22` — that is correct, not a leak.** `sshd` keeps
> listening on every interface; ufw drops the packets before they reach it. What matters is
> that `37.27.38.196:22` times out from outside while `100.66.213.19:22` answers.

#### "But I want to host services customers can reach — doesn't this block them?"

**No.** This is the single easiest thing to get twisted, so plainly: they are two different
doors on the same building.

| Door | Port | Who needs it | What happens to it |
|---|---|---|---|
| **Staff entrance** (SSH) | 22 | Only you, to admin the box | Moves to the tailnet |
| **Shop front** (HTTP/S) | 80/443 | Your customers | **Untouched — stays public** |

Closing the staff entrance has **zero** effect on customers. They were never using port 22.

**And customers never get *into* the box — they get handed one specific web page.** A visitor's
request hits Caddy, Caddy passes it to the app, the app returns a page. That is the entire
universe of what they can do. They cannot run a command, read a file, reach the database, or
install anything; they're stuck inside an app that only knows how to do one thing.

SSH is not a bigger version of that — it's a different category. It hands you a **root shell**:
total control of the machine. That asymmetry is the whole reason the admin door is worth
hiding while the shop front stays wide open. The shop front is *supposed* to be open.

**This includes API endpoints, including key-authenticated ones.** An API request is just a
web request — tunnel → Caddy → your app → response. Same path, no open ports, nothing to
change. And an API key is a *lock on a shelf inside the shop*, not a door into the building:
it authenticates someone to your **application**, which only does what you programmed it to.
A valid key lets you call the endpoints that were built; an SSH key makes you root.

> API key → "you may call these endpoints I wrote"
> SSH key → "you are root, do whatever you like"

So host as many public, key-authenticated APIs here as you want — none of this constrains that.

**This box already proves it.** `ss -tlnp` shows the only public listener is `0.0.0.0:22`
— no 80, no 443 — and yet `camcosolutions.nl` serves the public internet fine. That's the
Cloudflare tunnel: `cloudflared` dials *outward* to Cloudflare and holds the pipe open, so
requests arrive down a connection that was made from the inside. Nothing needs to be open
for traffic to reach you.

So the shape you're aiming at is:

- **Customers** → Cloudflare → tunnel → your services (as many as you like, no open ports)
- **You** → Tailscale → SSH
- **The internet at large** → nothing. No door at all.

**You do not need a second box for this**, and you don't need to choose between "private
admin box" and "public app host". One machine does both, and that separation — admin plane
private, service plane public — is the normal professional setup, not a compromise.

*(The Raspberry Pi is a separate matter and not a security zone: Home Assistant lives there
because it has to be physically in the house, near the radios it talks to. See
[home-automation](../home-automation/).)*

**What this actually costs you day-to-day: almost nothing.** You type
`ssh root@100.66.213.19` instead of `ssh root@37.27.38.196`. That's the whole difference.
Tailscale is a menu-bar app that starts at login and stays connected, and — see the glossary
— SSH over the tailnet works with the **exit node OFF**, at normal speed. You are not
"turning on a VPN" every time you want a shell.

**Is it worth doing?** It's a nice-to-have, not a must, and there's no urgency. Password auth
is already off, so the daily brute-force flood is hitting a wall. What this really buys is
immunity to the day a critical OpenSSH bug lands — not hypothetical (`regreSSHion`,
CVE-2024-6387, was unauthenticated remote root, mass-scanned within hours). Low probability,
catastrophic when it happens. A box with no public SSH is immune to that whole class of event,
patched or not.

The honest costs: if Tailscale is down or logged out you can't SSH (Hetzner console is the way
back), and from a machine without Tailscale you'd have to install it first. If that dependency
annoys you, skipping this is completely reasonable.

> ⚠️ **Do this last, and test first.** Order matters: install Tailscale on the Mac (Part 4),
> confirm `ssh root@100.66.213.19` works, *then* close public 22. If you strand yourself,
> Hetzner's console gets you back in — but read [the root-password
> caveat](#-the-hetzner-console-needs-a-root-password--and-there-isnt-one) FIRST and set a
> root password, or that escape hatch doesn't open. Don't discover this at 11pm.
>
> One knock-on: `fpl-predictor/ship.sh` deploys over SSH to `37.27.38.196`. After this change
> it must use the tailnet address, so set `FPL_SSH_HOST=root@100.66.213.19` (the script reads
> that env var) — and note deploys will then only work with the tailnet up.

---

## Part 3 — Tailscale on the VPS

**Already done** (recorded here so you can redo it on a future box):

```bash
curl -fsSL https://tailscale.com/install.sh | sh

printf 'net.ipv4.ip_forward = 1\nnet.ipv6.conf.all.forwarding = 1\n' \
  > /etc/sysctl.d/99-tailscale.conf
sysctl -p /etc/sysctl.d/99-tailscale.conf

tailscale up --advertise-exit-node --hostname=egress
```

That last command prints a **URL** — open it in your Mac's browser and sign in as
`micjcameron@gmail.com` to link the box.

### 3a. Approve the exit node (DON'T SKIP)

> **This is the step everyone misses.** Advertising an exit node is only half of it — your
> tailnet admin has to *approve* it. **Until you do, the exit node does not exist as far as
> your Mac is concerned** — the Mac app will say *"No available exit nodes"*.

1. Go to **login.tailscale.com/admin/machines**.
2. Find **`camcosolutions-vps1`** (tailnet IP `100.66.213.19`). It shows an **"Exit Node ⚠️"** badge,
   meaning *awaiting approval*.
3. Click the **`⋯`** menu on its row → **Edit route settings…**
4. Tick **✅ Use as exit node** → **Save**. (The ⚠️ disappears.)
5. Same **`⋯`** menu → **Disable key expiry**. ⚠️ Without this the VPS drops off the network
   after ~6 months and your fixed IP silently stops working.

### 3b. Delete the old `egress` machine — do not skip this one

The old STRATO box is **still registered in your tailnet** as `egress` (`100.68.123.9`),
and it still advertises itself as an exit node. This is why the new box came up named
`camcosolutions-vps1` — Tailscale wouldn't reuse a taken name.

That's an active foot-gun: your Mac's Exit Node menu will show **two** entries, and picking
the wrong one sends your traffic to a server you no longer pay for. It either fails outright,
or — worse — works just long enough to look fine while presenting the *old* IP, and you spend
an afternoon debugging the wrong layer.

1. **login.tailscale.com/admin/machines** → find `egress` (`100.68.123.9`).
2. `⋯` → **Remove machine** → confirm.
3. *Optional tidy-up:* with the name freed, rename `camcosolutions-vps1` → `egress` via `⋯` → **Edit
   machine name**. Cosmetic only; if you do, update the table at the top of this file.
4. Then actually **cancel the STRATO subscription** so you stop paying for a dead box.

### 3c. Speed tweak — already applied

Tailscale warns that UDP GRO forwarding is suboptimal on the VPS's NIC, which caps exit-node
throughput. Fixed permanently via a boot service. **Note the NIC is `eth0` here — the old
box used `ens6`.**

```bash
apt-get install -y ethtool
cat >/etc/systemd/system/tailscale-gro.service <<'EOF'
[Unit]
Description=Tailscale UDP GRO tuning on eth0
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/sbin/ethtool -K eth0 rx-udp-gro-forwarding on rx-gro-list off
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now tailscale-gro.service

# verify (want: rx-udp-gro-forwarding: on  /  rx-gro-list: off)
ethtool -k eth0 | grep -E 'rx-udp-gro-forwarding|rx-gro-list'
```

---

## Part 4 — Reinstall Tailscale on your Mac

**Done 2026-08-28.** The Mac reconnected as **`michaels-macbook-pro-1`** (`100.64.80.18`) —
a *new* registration, because the old `michaels-macbook-pro` (`100.65.75.69`, offline 51
days) still held the original name.

> 🧹 **Delete the stale `michaels-macbook-pro`** in the admin console, same as you did with
> the old `egress`. Two near-identical names where one is dead is the same trap twice.
> Optionally rename `-1` back afterwards.

For a future rebuild, the steps were:

1. **Install it.** Either:
   - **tailscale.com/download** (or the Mac App Store version), or
   - `brew install --cask tailscale`
2. **Open it and sign in** with **`micjcameron@gmail.com`** — the same account as the VPS,
   or the two won't see each other.
3. Click the Tailscale **menu-bar icon** → **Exit Node** → select **`camcosolutions-vps1`**.
   *(If you renamed it in 3b, pick `egress`. If you see two, you skipped 3b — go back.)*
4. (Recommended) In that same menu, tick **Allow Local Network Access** — so you can still
   reach your Pi / printer / LAN devices while routed through the VPS.

That's the "button" — the menu-bar Exit Node toggle is the whole daily interface.

---

## Part 5 — Verify it worked

On your Mac's Terminal:

```bash
curl -4 ifconfig.me ; echo
```

- **Exit node OFF** → shows your home/ISP IP (currently `31.20.166.148`).
- **Exit node ON** → shows **`37.27.38.196`**. ✅

If ON shows the VPS IP, you're done. That number is your permanent identity now.

---

## Part 6 — Using it abroad (the actual point now)

Working from South Africa and want to surface in the EU? Flip the exit node on. That's it —
there's no separate "travel mode". The same toggle you'd use at home does the job from
anywhere with internet.

### What to actually expect

**Latency: ~180–250 ms from South Africa.** This is the one thing to be realistic about.
Your traffic goes Cape Town → Helsinki → the site → Helsinki → back to you. That round trip
is physics, not a misconfiguration. Consequences:

- Typing in a terminal or a chat box over it feels laggy.
- Video calls through it will be noticeably worse — **turn the exit node off for those.**
- Page loads are slower but usable.
- Anything hosted *in* South Africa becomes absurdly slow while it's on, because you're
  crossing two continents to reach something down the road.

**So treat it as a switch, not a setting.** On when you need to be European, off the rest of
the time. From SA that matters much more than it does at home.

### What this is NOT good for

**Streaming.** Netflix, BBC iPlayer, DAZN and friends actively detect and block datacenter
IP ranges, and Hetzner's are extremely well known. Expect to be blocked, or shown a proxy
error. This isn't a fixable configuration problem — it's the entire business model of
commercial VPNs, who churn through residential-looking addresses to stay ahead of it. One
static Hetzner IP has no chance. If you want EU streaming abroad, pay for a real VPN; use
this for everything else.

**Banking, maybe.** Logging into your bank from a Finnish datacenter IP while your phone is
in South Africa is exactly the pattern fraud systems flag. It may work fine; it may trigger
a verification step or a lock. Know that before you're stuck abroad needing money.

### Worth doing before you fly

- **Put Tailscale on your phone too** (iOS/Android, same account). It can use the exit node
  as well, and — more importantly — it's your backup way into the box if the laptop dies.
  See [backup access](#if-the-laptop-dies).
- **Tick "Allow Local Network Access"** so hotel printers, casting and captive-portal logins
  still work while routed.
- **Test it from home first.** Turn the exit node on, confirm `curl -4 ifconfig.me` shows
  `37.27.38.196`, and do 10 minutes of real work through it. Discover problems here, not in
  a different hemisphere.

### Bandwidth

All of this counts against the box's 20 TB/month. Routing a full working month through it
would not come close — you're at ~2.8 TB with normal app traffic. Not a constraint,
just don't leave it on while torrenting.

### If the laptop dies

Three independent ways back into the box, in order:

1. **Laptop** — `ssh root@100.66.213.19` over the tailnet.
2. **Phone** — Tailscale + any SSH client app.
3. **Any browser, anywhere** — Hetzner Cloud console. See the caveat below; it works, but
   not in one click.

#### ⚠️ The Hetzner console needs a root PASSWORD — and there isn't one

The web console is a virtual monitor and keyboard at a **Linux login prompt**. SSH keys are
meaningless there; it wants a username and password. Checked on this box:

```
root  L        ← locked, no password set
(no other login-capable users)
```

So on its own, that console is a dead end. Hetzner's key-based images leave root passwordless
by design, and nothing warns you until you actually need it.

**Two ways through, both real:**

1. **Reset root password** (fastest) — Cloud Console → the server → `⋯` → **Reset root
   password**. Hetzner generates one, shows it once, and injects it via `qemu-guest-agent`.
   *Verified active on this box*, so this works today with no preparation.
2. **Rescue mode** (bulletproof) — Cloud Console → the server → **Rescue** → enable and power
   cycle. Boots a separate rescue OS with a Hetzner-supplied password; mount your disk and
   fix whatever's broken from there. Works regardless of the guest agent or the box's state.

**Better: set a root password now**, so the console just works when you need it:

```bash
ssh root@37.27.38.196 passwd     # long random string, store it in your password manager
passwd -S root                   # verify: want P (set), not L (locked)
```

**This does not weaken anything.** SSH still refuses passwords entirely
(`passwordauthentication no`, `permitrootlogin prohibit-password`) — the password only works
at the console. And anyone who has your Hetzner account can already reset root, boot rescue,
and read your disk, so a root password hands an attacker nothing they didn't already have.

> 🔑 **The real control is 2FA on your Hetzner account.** That account *is* full physical
> control of this machine — more powerful than any SSH key. Protect it accordingly.

With a root password set, you genuinely cannot strand yourself, which is what makes
[closing public SSH](#the-actual-win-take-ssh-off-the-public-internet) safe to do.

---

## Part 7 — Prove it's solid (do this once, ~10 min)

Two goals: **(a)** confirm it's fast enough, and **(b)** confirm it won't silently break in
a couple of months so you never have to redo this.

### 7a. Latency & speed

On your **Mac**, with the exit node **ON**:

**Step 1 — check the connection is direct (not relayed):**
```bash
tailscale ping camcosolutions-vps1
```
- ✅ You want **"direct"** — peer-to-peer, lowest latency. A public-IP VPS should get this.
- ⚠️ If it says **"via DERP"** — it's being relayed through Tailscale's servers (slower).
  Usually a firewall issue: re-check that `ALLOW_ROUTED=true` was set in Part 2.

**Step 2 — raw network latency to the box:**
```bash
ping -c 5 37.27.38.196
```
- Helsinki from the Netherlands is typically **~30–40 ms**. That is *worse than the old
  German box* and is not a fault — see the note in the values table. Under ~50 ms is fine
  for work.

**Step 3 — throughput through the exit node (built into macOS):**
```bash
networkquality
```
Run once with the exit node **ON**, then **OFF**, and compare. You'll lose a little (the
detour), not a lot.

**Step 4 — the only test that truly matters:**
> Turn the exit node **ON** and actually **do real work through it for 5 minutes.**
> If it feels normal, it is fine. The numbers are a sanity check; real work is the real test.

### 7b. Durability — will it survive without a redo?

**Step 1 — Disable Tailscale key expiry (THE most important step in the whole guide).**
Covered in Part 3a step 5. Confirm `camcosolutions-vps1` reads **"Expiry disabled"**.

> Why it matters: by default a machine's key expires after ~6 months. When it does, your
> exit node **silently stops** — and you'll discover it abroad, which is the worst possible
> time, since re-authing needs a browser login to Tailscale.

**Step 2 — Prove it survives a reboot.**

> ⚠️ **This box hosts your live website.** A reboot is ~45 s of downtime for
> `camcosolutions.nl`, not just for egress. Do it at a quiet moment, and expect the
> containers to take another few seconds to come back after the box is up.

On the **VPS**: `reboot`. Wait ~45 s, then on your **Mac** (exit node still ON):
```bash
curl -4 ifconfig.me ; echo          # want: 37.27.38.196
curl -sS -o /dev/null -w "%{http_code}\n" https://fpl.camcosolutions.nl   # want 302 (Access login) — site came back
```
- ✅ Both good? → Bulletproof. Forwarding, Tailscale, the GRO service and Docker all came
  back on their own, so auto-updates and months of uptime will survive.
- ❌ Otherwise → SSH in and check `tailscale status`, `sysctl net.ipv4.ip_forward` (should
  be `1`), `systemctl status tailscale-gro`, and `docker ps`.

**Step 3 — Write down two things:**
- ✅ The **VPS IP** (`37.27.38.196`) — the address you surface as.
- 📅 The **Hetzner renewal date + price**, and the **STRATO cancellation** date so you can
  confirm you stopped paying for the old one.

---

## Daily use

- **Need to appear European?** Menu bar → Exit Node → `camcosolutions-vps1`.
- **Done?** Menu bar → Exit Node → **None**. Back to normal browsing, full speed.
- **At home you'll rarely need it on.** Abroad it's the whole point.
- Remember: Tailscale *running* costs you nothing and is what makes `ssh root@100.66.213.19`
  work. Only the **exit node toggle** reroutes your traffic.

---

## Cost, upkeep, gotchas

- **Cost:** the box is already paid for as your app host — egress rides along for **€0
  extra**. Tailscale is free (personal). Cancel STRATO and this is a net saving.
- **Upkeep:** almost none — auto-updates are on once you've run `harden.sh`.
- **The VPS IP only changes if YOU destroy & recreate the server.** If you ever rebuild →
  re-whitelist the new IP once.
- **Key expiry** is the one silent killer — make sure you did **Part 3a step 5**.
- **Traffic, not RAM, is the shared resource.** 20 TB/mo, ~2.8 TB used. All your browsing
  detours through the box while the exit node is on.
- **You are sharing a box with production.** Before you `apt upgrade`, reboot, or change the
  firewall here, remember `camcosolutions.nl` is riding on it.

---

## Troubleshooting

- **`curl ifconfig.me` still shows my home IP with exit node ON**
  → Most likely the forward policy. On the VPS: `ufw status verbose` should say
  `Default: deny (incoming), allow (outgoing), allow (routed)`. If routed says **deny**, run
  `ufw default allow routed && ufw reload`. Also check `sysctl net.ipv4.ip_forward` is `1`.
- **VPS not showing as an exit node option on the Mac** → you didn't approve it in Part 3a.
- **I see two exit nodes / picked one and got the old IP** → you skipped Part 3b. Delete the
  old `egress` machine.
- **A site says "proxy/VPN detected" or blocks me** → expected on streaming services; they
  block datacenter IPs. Not fixable here — see [what this isn't good for](#what-this-is-not-good-for).
- **Everything is slow while abroad** → that's the two-continent round trip. Turn the exit
  node off for video calls and for anything hosted near you.
- **It worked for months then stopped** → key expiry. Re-auth the VPS (`tailscale up`) and
  disable key expiry.
- **Can't reach my Pi/LAN while routed** → tick "Allow Local Network Access" on the Mac.
- **The website went down after I ran something here** → this box is the app host. Check
  `docker ps` and see `fpl-predictor/ship.sh` / the box's own `deploy.sh`.
- **Checking whether the site is up** → test **`fpl.camcosolutions.nl`**, not the apex
  `camcosolutions.nl`. Only the subdomain is served by this box's tunnel; the apex is a
  separate Cloudflare config and is intermittent for unrelated reasons. A healthy response is
  **`302`** (redirect to the Cloudflare Access login), *not* 200 — and Caddy logging nothing
  is correct, because Access blocks unauthenticated requests at Cloudflare's edge before they
  ever reach the tunnel.

---

## How this fits the rest of the homelab

**This does NOT replace or duplicate your Cloudflare tunnel — they're opposite directions:**

| | Direction | Job |
|---|---|---|
| **cloudflared tunnel** | **Inbound** (internet → your stuff) | Lets the world reach services via `*.camcosolutions.nl` with no open ports |
| **VPS exit node** | **Outbound** (your stuff → internet) | Makes *you* appear to be in the EU on one fixed IP, from anywhere in the world |

Both now run on **the same machine** — which is the "one box, both directions" endgame the
old version of this doc pointed at. Beyond egress and the app, the box can also:

- **Host more small public apps.** It has a stable public IP and spare capacity.
- **Be an always-on jump box** into your tailnet.
- **Be your Pangolin host** later, if you want to self-host inbound and drop Cloudflare.
  (See [tailscale-exit-node](../future-ideas/tailscale-exit-node.md).)
