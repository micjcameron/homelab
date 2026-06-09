# Future idea: Tailscale exit node (route my traffic via home)

**What it gives you:** from anywhere (e.g. Germany), all your laptop traffic exits via
your **home fibre IP** — so you appear to be at home. Plus private access to every home
device (HA, Pi-hole, the Pi) by its Tailscale IP. **No open ports** (Tailscale does NAT
traversal — same "dial out" model as the Cloudflare tunnel and the Telegram long-poll).

This is **separate** from the Cloudflare tunnel: Cloudflare = services **in**, Tailscale
exit node = your traffic **out**.

## Setup

### On the Pi (the exit node)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
# enable IP forwarding
echo 'net.ipv4.ip_forward = 1'  | sudo tee /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf
# advertise as exit node
sudo tailscale up --advertise-exit-node
```
Then in the **Tailscale admin console** → Machines → the Pi → **approve the exit node**
(edit route settings → allow "Use as exit node").

### On the client — two options

**Simple (laptop directly):** install Tailscale on the laptop, `tailscale up`, then in the
app toggle **Use exit node → [Pi]**. All traffic now exits via home.
*Downside:* a Tailscale client/adapter lives on the laptop (detectable by MDM/ZScaler).

**Stealth (transparent gateway — preferred for the work-laptop case):** use the **GL.iNet**
travel router (it supports Tailscale natively):
- GL.iNet joins the tailnet and is set to **use the home Pi as its exit node**.
- **Hardwire the laptop into the GL.iNet, keep laptop Wi-Fi OFF** → the laptop sees a plain
  LAN, has no VPN client, and everything transparently exits via home. Nothing local to
  fingerprint.

## Caveats (be honest)
- **Throughput** is capped by your home *upload* speed — fine on your gig fibre.
- **Not invisible to ZScaler.** Routing via home fixes the **IP/geo** signal (the main
  control), but a client running *on* the managed laptop can still see device posture /
  latency fingerprints. Risk-reduction, not magic. The stealth-gateway option (no client on
  the laptop) is the strongest.
- Whether to use it for a work-location policy is a you-and-your-contract call.

## Bonus
Once Tailscale is on the Pi, you also get **private** access to HA/Pi-hole/etc. by their
Tailscale IPs from any of your devices — no Cloudflare Access needed for personal use.
