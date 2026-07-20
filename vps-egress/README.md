# VPS static-egress box — a fixed IP you carry everywhere

**The problem this solves:** EasyFlex (and services like it) only let you in if your
requests come from an IP address they recognise. Your home internet IP **changes** when
your ISP feels like it, and you can't get a static one. So you rent a tiny always-on
computer in a datacenter that **has** a permanent IP, and you make all your work traffic
go out through it. Now — from your sofa, a café, or abroad — you always appear as that one
fixed IP. Whitelist it once at EasyFlex, never think about it again.

> **Plain-English glossary (read this once):**
> - **VPS** = "Virtual Private Server". A small computer you rent in a datacenter. It's
>   always on and has a permanent public IP address. ~€4/month.
> - **SSH** = the way you log into that computer from your Mac's terminal (encrypted).
> - **Tailscale** = a tool that builds a tiny private encrypted network between *your*
>   devices (your Mac + the VPS), so they can talk safely without opening any ports.
> - **Exit node** = a Tailscale setting that means "send my internet *through* this device".
>   We make the VPS an exit node, so your Mac's traffic leaves from the VPS's IP.
> - **Egress** = traffic going *out* from you to the internet. (The opposite, *inbound*,
>   is traffic coming *to* you — that's what your Cloudflare tunnel handles. Different job.)

---

## Your build — actual values (reference)

Filled in from the real setup, so future-you doesn't have to dig:

| Thing | Value |
|---|---|
| VPS provider / OS | STRATO (Germany), **Ubuntu 24.04 LTS**, KVM |
| **VPS public IP — whitelist THIS** | **`217.160.75.214`** |
| Tailscale name (VPS) | `egress` · tailnet IP `100.68.123.9` |
| Tailscale name (Mac) | `michaels-macbook-pro` · tailnet IP `100.65.75.69` |
| Tailscale account | `micjcameron@gmail.com` |
| VPS network interface | `ens6` (used by the speed tweak in Part 3b) |
| Login to the VPS | `ssh root@217.160.75.214` (key auth, your default `~/.ssh/id_ed25519`) |

> **`217.160.75.214` is the one number that matters** — it's what you give EasyFlex (and
> anything else that whitelists by IP). It only ever changes if you destroy the server.

---

## What you'll end up with

```
   You, anywhere          Tailscale (encrypted)        The internet
 ┌───────────────┐                                   ┌──────────────┐
 │  Your Mac      │ ───────────────────────────────► │   VPS         │ ──► EasyFlex
 │ (home/café/DE) │      "use VPS as exit node"       │ fixed IP:     │     sees the
 └───────────────┘                                   │ 203.0.113.45  │     VPS's IP
                                                      └──────────────┘
                                       ▲ this ONE IP is what you whitelist
```

Toggle the exit node **on** when you're working → you appear as the VPS IP.
Toggle it **off** when you're done → normal browsing.

---

## Part 1 — Rent the VPS (≈10 min)

Any provider works. Two good picks:

| Provider | Why | Region for you |
|---|---|---|
| **Hetzner Cloud** (cloud.hetzner.com) | Cheapest, rock-solid (~€4/mo) | Germany (Nuremberg/Falkenstein) — fine, NL latency is tiny |
| **DigitalOcean** or **Vultr** | If you specifically want a 🇳🇱 IP | **Amsterdam** datacenter |

> Geography doesn't matter to EasyFlex — they whitelist the *number*, not the location.
> Pick on price/latency. Hetzner is the value king. The steps below use Hetzner; the
> others are nearly identical.

### 1a. Make an SSH key on your Mac (so you log in without a password)

Open **Terminal** on your Mac and run:

```bash
# Only if you don't already have one. Press Enter at every prompt (no passphrase is fine).
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -C "micjcameron@gmail.com"

# Show the PUBLIC key — copy the whole line it prints (starts with "ssh-ed25519 ...")
cat ~/.ssh/id_ed25519.pub
```

Keep that copied — you'll paste it into Hetzner in a sec. (The *public* key is safe to
share; the matching private key stays secret on your Mac.)

### 1b. Create the server

1. Sign up at **cloud.hetzner.com** → create a **New Project** (call it `homelab`).
2. **Add Server**:
   - **Location:** Nuremberg or Falkenstein (or Amsterdam if you went DO/Vultr).
   - **Image:** **Ubuntu 24.04**.
   - **Type:** the smallest shared-vCPU plan — **CX22** (or the ARM **CAX11**). This box
     does almost nothing; the cheapest is plenty.
   - **SSH key:** click "Add SSH key" and paste the public key from step 1a.
   - **Name:** `egress` (or whatever).
3. Create it. After ~30 seconds you'll see its **public IP** (e.g. `203.0.113.45`).
   **Write this down — this is your future fixed IP.**

---

## Part 2 — Log in & basic hardening (≈10 min)

> **Shortcut:** there's a reusable **[`harden.sh`](./harden.sh)** in this folder that does
> everything below *plus* fail2ban and an SSH lockdown — safely (it keeps root key-login,
> won't disable password auth unless it sees a key, and leaves the exit-node forward policy
> alone). On the VPS: `./harden.sh`, or `ALLOW_HTTP=true ./harden.sh` on the box that also
> hosts a website. The manual steps below are the same thing spelled out.

From your Mac's Terminal (swap in your real IP):

```bash
ssh root@203.0.113.45
```

Type `yes` if it asks about authenticity. You're now *on the VPS*. Run:

```bash
# 1. Update everything
apt update && apt upgrade -y

# 2. Turn on automatic security updates (so you don't have to babysit it)
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# 3. Basic firewall — allow SSH, allow forwarded traffic (needed for exit node), enable
apt install -y ufw
ufw allow OpenSSH
ufw default allow routed     # lets the VPS forward your traffic out (the exit-node job)
ufw --force enable
```

> That's "enough" hardening for a personal egress box: key-only SSH (Hetzner disables
> root password login when you add an SSH key) + a firewall + auto-updates. Don't
> over-think it.

---

## Part 3 — Make the VPS a Tailscale exit node (≈10 min)

Still logged into the VPS:

```bash
# 1. Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Allow the box to forward internet traffic (the core of "exit node")
echo 'net.ipv4.ip_forward = 1'        | tee /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
sysctl -p /etc/sysctl.d/99-tailscale.conf

# 3. Bring Tailscale up AND advertise as an exit node
tailscale up --advertise-exit-node
```

That last command prints a **URL**. Copy it, open it in your Mac's browser, and **sign in
to create your Tailscale account** (use Google / `micjcameron@gmail.com` — it's free for
personal use). This links the VPS to your account.

### 3a. Approve the exit node (in the Tailscale website) — ⚠️ DON'T SKIP

> **This is the step everyone misses.** Advertising an exit node (the command above) is only
> half of it — your tailnet admin has to *approve* it. **Until you do this, the exit node
> does NOT exist as far as your Mac is concerned** — the Mac app will literally say
> *"No available exit nodes"* and `tailscale exit-node list` returns *"no exit nodes found"*.

1. Go to **login.tailscale.com/admin/machines** (or click **"Open in Admin Console"** from
   the Mac app's Exit Nodes screen).
2. Find **`egress`** (the VPS). It'll show an **"Exit Node ⚠️"** badge meaning *awaiting approval*.
3. Click the **`⋯`** menu on its row → **Edit route settings…**
4. Tick **✅ Use as exit node** → **Save**. (The ⚠️ disappears.)
5. Same **`⋯`** menu → **Disable key expiry**. ⚠️ Without this the VPS drops off the network
   after ~6 months and your fixed IP silently stops working.

Now — and only now — `egress` appears as a selectable exit node on your Mac.

### 3b. Speed tweak (recommended, one-time)

On first connect Tailscale warns that **UDP GRO forwarding** is suboptimal on the VPS's NIC
(`ens6`), which caps exit-node throughput. Fix it permanently with a tiny boot service. On
the **VPS**:

```bash
apt-get install -y ethtool
# create a service that applies the tweak on every boot
cat >/etc/systemd/system/tailscale-gro.service <<'EOF'
[Unit]
Description=Tailscale UDP GRO tuning on ens6
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/sbin/ethtool -K ens6 rx-udp-gro-forwarding on rx-gro-list off
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now tailscale-gro.service

# verify (want: rx-udp-gro-forwarding: on  /  rx-gro-list: off)
ethtool -k ens6 | grep -E 'rx-udp-gro-forwarding|rx-gro-list'
```

> Replace `ens6` with your NIC name if different — the warning message tells you which one.

---

## Part 4 — Point your Mac at it (≈5 min)

1. Install Tailscale on your Mac: **tailscale.com/download** (or Mac App Store). Open it,
   **sign in with the same account**.
2. Click the Tailscale **menu-bar icon** → **Exit Node** → select **`egress`**.
3. (Recommended) In that same menu, tick **Allow Local Network Access** — so you can still
   reach your Pi / printer / LAN devices while routed through the VPS.

That's it. Your Mac's internet now exits via the VPS.

---

## Part 5 — Verify it worked

On your Mac's Terminal:

```bash
curl -4 ifconfig.me ; echo
```

- **Exit node OFF** → shows your home/ISP IP.
- **Exit node ON** → shows the **VPS IP** (`203.0.113.45`). ✅

If ON shows the VPS IP, you're done. That number is your permanent identity now.

---

## Part 6 — Whitelist it at EasyFlex

Give EasyFlex the **VPS IP** (`203.0.113.45`) as your allowlisted address. Because it
never changes — and you always route through it — this is a **one-time** action. Working
from Germany next month? Same IP. Café wifi? Same IP. Done forever.

---

## Part 7 — Prove it's solid (do this once, ~10 min)

Two goals: **(a)** confirm it's fast enough, and **(b)** confirm it won't silently break
in a couple of months so you never have to redo this. Run these once, right after setup.

### 7a. Latency & speed — is it fast enough?

On your **Mac**, with the exit node **ON** (Part 4), in Terminal:

**Step 1 — check the connection is direct (not relayed):**
```bash
tailscale ping egress
```
- ✅ You want **"direct"** — peer-to-peer, lowest latency. A public-IP VPS should always get this.
- ⚠️ If it says **"via DERP"** — it's being relayed through Tailscale's servers (slower).
  Usually a firewall issue: re-check Part 2's `ufw`. Flag it to me if you see this.

**Step 2 — raw network latency to the box:**
```bash
ping -c 5 <VPS_PUBLIC_IP>
```
- German datacenter from the Netherlands is typically **~10–25 ms**. Anything under ~40 ms
  is totally fine for work.

**Step 3 — throughput through the exit node (built into macOS, nothing to install):**
```bash
networkquality
```
- Run it once with the exit node **ON**, then turn it **OFF** and run again. Compare the
  download/upload numbers. You'll lose a little (the detour), not a lot.

**Step 4 — the only test that truly matters:**
> Turn the exit node **ON** and actually **use EasyFlex / do real work for 5 minutes.**
> If it feels normal, it is fine. The numbers are a sanity check; real work is the real test.

### 7b. Durability — will it survive without a redo?

This is the bit that stops you having to do all this again in two months.

**Step 1 — Disable Tailscale key expiry (THE most important step in the whole guide):**
1. Go to **login.tailscale.com → Machines**.
2. Find `egress` → click the **`⋯`** menu → **Disable key expiry**.
3. Confirm it now reads **"Expiry disabled"**.

> Why it matters: by default a Tailscale machine's key expires after ~6 months. When it
> does, your exit node **silently stops** and you're locked out of EasyFlex until you
> re-auth. Disabling expiry keeps the box connected **for years**. **Do not skip this.**

**Step 2 — Prove it survives a reboot (so updates/restarts never break it):**
On the **VPS** (SSH in), reboot it:
```bash
sudo reboot
```
Wait ~45 seconds for it to come back, then on your **Mac** (exit node still ON):
```bash
curl -4 ifconfig.me ; echo
```
- ✅ Still shows the **VPS IP**? → Bulletproof. IP forwarding + Tailscale both came back on
  their own, so auto-updates, restarts, and months of uptime will all survive.
- ❌ Shows your home IP or times out? → SSH back in and check `sudo tailscale status` and
  `sysctl net.ipv4.ip_forward` (should be `1`). Ping me.

**Step 3 — Write down two things:**
- ✅ The **VPS IP** — your whitelisted address; keep a record of it.
- 📅 The **STRATO renewal date + price** — so a price jump (if any) isn't a surprise.

### What "solid" looks like

If `tailscale ping` says **direct**, work **feels normal**, the IP **survives a reboot**,
and **key expiry is disabled** → you have a genuine set-and-forget box. Nothing on your
maintenance list except paying the €2 and the occasional `apt upgrade`.

---

## Daily use

- **Working / need EasyFlex?** Menu bar → Exit Node → `egress`. (Leave it on all day.)
- **Done?** Menu bar → Exit Node → **None**. Back to normal browsing.
- Works identically from **anywhere** with internet — that's the whole point.

---

## Cost, upkeep, gotchas

- **Cost:** ~€4/month for the VPS. Tailscale is free (personal). That's the lot.
- **Upkeep:** almost none — auto-updates are on. Maybe `apt upgrade` every few months.
- **The VPS IP only changes if YOU destroy & recreate the server.** Don't delete it and
  you keep the IP for years. (If you ever do rebuild it → re-whitelist the new IP once.)
- **Key expiry** is the one silent killer — make sure you did **Part 3a step 4**
  (disable key expiry on the VPS).
- **Speed:** all your traffic detours through the VPS while the exit node is on, so it adds
  a little latency and uses the VPS's bandwidth. For work that's invisible. If you ever
  want *only* EasyFlex to route through it (and everything else direct), that's a more
  advanced "split tunnel" setup — ask future-you / me when you need it.

---

## Troubleshooting

- **`curl ifconfig.me` still shows my home IP with exit node ON**
  → On the VPS, re-check IP forwarding (`sysctl net.ipv4.ip_forward` should be `1`) and
  that you ran `ufw default allow routed`. Then `tailscale up --advertise-exit-node` again.
- **VPS not showing as an exit node option on the Mac** → you didn't approve it in
  Part 3a (Edit route settings → Use as exit node).
- **It worked for months then stopped** → key expiry kicked in. Re-auth the VPS
  (`tailscale up` on it) and disable key expiry (Part 3a step 4).
- **Can't reach my Pi/LAN while routed** → tick "Allow Local Network Access" on the Mac.

---

## How this fits the rest of the homelab (and what else the box is good for)

**This does NOT replace or duplicate your Cloudflare tunnel — they're opposite directions:**

| | Direction | Job |
|---|---|---|
| **cloudflared tunnel** | **Inbound** (internet → your stuff) | Lets the world reach services on your Mac/Pi via `*.camcosolutions.nl`, hiding your home IP |
| **VPS exit node** | **Outbound** (your stuff → internet) | Makes *you* appear as one fixed IP when you reach out (EasyFlex, etc.) |

You now own a real, always-on, publicly-reachable Linux box — so beyond egress it can also:

- **Host small public apps directly.** Unlike home, the VPS has a stable public IP, so you
  can run a small app/bot/status-page on it and point a domain straight at it — **no tunnel
  needed** (it's already public).
- **Be your Pangolin host** later, if you want to self-host inbound and drop Cloudflare —
  one box, both directions. (See [tailscale-exit-node](../future-ideas/tailscale-exit-node.md)
  for the related home-routing idea.)
- **Be a always-on jump box** into your tailnet.

So the €4 isn't just for EasyFlex — it's a general-purpose "my corner of the internet with
a fixed address" box that several future projects can ride on.
