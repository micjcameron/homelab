# Browser Mod & Doorbell Popup — Full Assessment / Post-Mortem

**Date:** 2026-06-30
**Author:** debugging session (Claude + Michael)
**Status:** ✅ RESOLVED — confirmed working end-to-end on 2026-06-30: real doorbell press → `RingEvent(kind='ding')` → automation fired (7ms later) → camera popup on the registered wall tablet. Mac + tablet both registered. Debug logging removed.
**TL;DR:** The "doorbell rings → camera pops up on the wall tablet" feature was broken at **five independent layers** at once. None of them were the tablet's fault, none were the automation's logic. This doc captures every layer, the fix, and how to diagnose each one again.

---

## 1. What it was supposed to do (the pipeline)

When the Ring doorbell button is pressed, a live camera popup should appear on the wall tablet(s):

```
Ring button press
   │  (Ring cloud)
   ▼
Google FCM push  ──────────────►  HA firebase_messaging client (MCS, mtalk.google.com:5228)
   │
   ▼
ring-doorbell event listener  ──►  RingEvent(kind='ding', state='button_press')
   │
   ▼
event.front_door_ding  (HA event entity, state = ISO timestamp, event_type='ring')
   │  (state change triggers automation)
   ▼
automation: doorbell_ring_popup ("Doorbell — Camera Popup on Ring")
   │  action: browser_mod.popup  (content = camera.front_door_live_view)
   ▼
browser_mod backend  ──►  only delivers to CONNECTED + REGISTERED browsers
   │
   ▼
Fully Kiosk tablet (browser_mod frontend)  ──►  popup renders
```

**Every arrow above had to work.** Several didn't.

---

## 2. Root causes (the five layers)

### Layer 1 — Home Assistant was ~10 months stale
- HA was on **2025.8.3**; current stable was **2026.6.4** (a ~10-release gap).
- Stale HA shipped old `firebase-messaging` / `ring-doorbell` and an old frontend that later broke browser_mod.
- **Fix:** upgraded the Docker image `ghcr.io/home-assistant/home-assistant:stable` → 2026.6.4 (DB schema migrated 50→53, clean). Full backup + a tagged rollback image taken first (see §5).

### Layer 2 — Ring push (FCM) was never delivering dings
- `event.front_door_ding` sat at `unknown`; the doorbell automation had **never once fired** (no saved traces).
- HA logs were full of `firebase_messaging` "Server sent Close message, resetting" / "0 bytes read" — the push channel kept dying.
- After the HA upgrade, forcing a fresh FCM registration failed **persistently** with `PHONE_REGISTRATION_ERROR` (Google's GCM `register3` rejecting the request). **This was NOT rate-limiting** — it survived a 2-day cooldown, and the system clock/NTP and egress were all fine.
- **Root cause:** a cluttered Ring account. Pre-HA-2023.12, the Ring integration registered a **new "Authorized Client Device" on every restart**, and this instance had been restarted countless times. Stale registrations poison new ones and mis-route pushes.
- **Fix (account-side, only the user can do it):**
  1. ring.com → **Control Center → Authorized Client Devices** → delete every `ring-doorbell:HomeAssistant` / `Python` entry (NOT phones/Ring apps).
  2. HA → Settings → Devices & Services → **Ring → ⋮ → Reconfigure** (mints a fresh client ID). **Order matters** — clean first, then reconfigure.
- **Result:** registration succeeded (`Registered with FCM` / `Successfully logged in to MCS endpoint`), `listen_token` persisted into the config entry, and a real press produced `Received data message` → `RingEvent(kind='ding')` → `event.front_door_ding` fired → automation triggered. **Push pipeline confirmed working.**
- Reference: HA core issue [#157236](https://github.com/home-assistant/core/issues/157236) (closed "not planned" — upstream), HA docs [Ring integration](https://www.home-assistant.io/integrations/ring/), [ring-mqtt troubleshooting](https://github.com/tsightler/ring-mqtt/wiki/Support-&-Troubleshooting).

### Layer 3 — browser_mod was incompatible with the HA 2026.6 frontend
- Installed browser_mod was **2.7.0**. HA 2026.6 changed the frontend enough that 2.7.0's connection hook broke.
- Symptom: `browser_mod.js` loaded fine in the browser (console printed `BROWSER_MOD 2.7.0 IS INSTALLED` + a BrowserID), HA served the module (HTTP 200), but **no browser ever registered/connected** — `session_browser_map` stayed empty and popups reached nobody. True for **every** browser, not just the kiosk → ruled out Fully Kiosk.
- **Fix:** updated browser_mod. The **2.x line (incl. 2.13.5) does NOT fix 2026.6** — had to go to the **v3.0.0-beta** line, which "Requires Home Assistant 2026.6.0 or greater." Installed **3.0.0-beta.4** by dropping the GitHub release's `custom_components/browser_mod` over the existing one and restarting (see §6). Old 2.7.0 kept as `custom_components/browser_mod.bak.2.7.0`.
- Reference: HA frontend issue [#52404](https://github.com/home-assistant/frontend/issues/52404) ("No connection after updating to 2026.6.0"); [browser_mod releases](https://github.com/thomasloven/hass-browser_mod/releases).

### Layer 4 — browsers must be REGISTERED to receive popups (the real kicker)
- Even on 3.0.0-beta.4, the popup still reached nothing. Debug logging showed the browser **did** send `browser_mod/connect` to the backend — so the frontend worked.
- Reading `connection.py` `handle_connect()` revealed the rule:
  ```python
  connection.send_result(msg["id"])
  if store.get_browser(browserID).registered:   # ← ONLY registered browsers
      dev.open_connection(hass, connection, ...) # ← get a live, popup-capable connection
  ```
  **An unregistered browser connects but is ignored for popups.** Global `autoRegister` was `null` (off).
- The two historically-registered browsers (`...ba0dcfa6`, `...71b7fcdf`) were fine — but cache/storage clears during debugging gave the Mac and tablet **brand-new BrowserIDs that were never registered**.
- **Fix:** HA sidebar → **"Browser Mod"** panel → **Register** (per browser). Once registered, `last_seen` updates to now and popups land. **Confirmed working on the Mac.**

### Layer 5 — Fully Kiosk was wiping the browser ID on every reload
- The browser_mod BrowserID lives in the browser's **web storage (localStorage)**.
- During debugging, Fully Kiosk was set to **"delete cache / delete web storage / delete everything after reload."** Left on, this **regenerates the BrowserID on every reload → un-registers the device every time**.
- **Fix:** after the one-time cache bust, turn **OFF** Fully Kiosk → Advanced Web Settings → "Delete Web Storage"/"delete everything on reload". The ID must persist for registration to stick.

### Bonus — two latent bugs in the automation itself (fixed pre-emptively)
- **Stale hardcoded `browser_id`s.** The popup targeted two fixed IDs that went stale whenever kiosk storage cleared. **Fix:** omit `browser_id` entirely → browser_mod broadcasts to **all connected (registered) browsers** (verified against service.py: no `browser_id` ⇒ `browsers.keys()`).
- **Condition swallowed the first ding after every restart.** Old condition rejected `from_state in [unknown]`, which is exactly the first ding post-restart. **Fix:** a freshness check instead — accept if `event.front_door_ding`'s timestamp is within 30s of `now()`. Lets the first ding through, still ignores HA-restart state-restores.

---

## 3. Key gotchas to remember (the "don't get burned again" list)

1. **browser_mod requires registration.** A browser that loads the JS and shows a BrowserID is *not* enough — it must be **Registered** via the Browser Mod sidebar panel, or it silently receives nothing. `autoRegister` is off by default.
2. **browser_mod version must match the HA major version.** HA 2026.6 needs the browser_mod **3.0.x** line. The 2.x line silently fails to connect (no error, just dead). Update browser_mod whenever you make a big HA jump.
3. **BrowserID = localStorage.** Clearing web storage (or any kiosk "wipe on reload" setting) regenerates the ID and drops registration. Keep web storage persistent on the wall tablet.
4. **Popups only reach *connected* browsers.** A registered tablet that isn't currently showing a live dashboard (asleep, on a login/error page) won't get the popup. Configure Fully Kiosk to stay connected / auto-reload on disconnect.
5. **"Browser mod works on the Mac but not the kiosk" is usually a kiosk-state problem; "works on neither" is a browser_mod version/registration problem.** Use the Mac as the control in any future test.
6. **Ring push ≠ Ring polling.** The integration *polls* device state every ~60s (this updates sensors, and even fetches active dings) but `event.*` entities only fire from the **realtime FCM push**. Seeing dings in `/dings/.../share/play` poll logs while `event.front_door_ding` stays `unknown` means **push is broken**, not the doorbell.
7. **`PHONE_REGISTRATION_ERROR` is (here) an account-clutter problem**, not rate-limiting and not the clock. Fix it by pruning Ring Authorized Client Devices, then Reconfigure.

---

## 4. Current known-good configuration (as of 2026-06-30)

| Thing | Value |
|---|---|
| HA version | **2026.6.4** (Docker, `:stable`) |
| HA compose | `/home/micjcameron/homelab/home-automation/stacks/homeassistant/docker-compose.yml` |
| HA config (host) | `/home/micjcameron/homeassistant` → `/config` in container |
| browser_mod | **3.0.0-beta.4** (manually installed; old 2.7.0 at `custom_components/browser_mod.bak.2.7.0`) |
| ring-doorbell / firebase-messaging | 0.9.14 / 0.4.5 (bundled with HA) |
| Ring config entry | `01K3XFX3B1VB6ZY0KBS8PK549G` (account `micjcameron@gmail.com`) |
| Doorbell entity | `event.front_door_ding` (doorbot_id 561638920, "Front Door") |
| Camera | `camera.front_door_live_view` |
| Automation | `doorbell_ring_popup` — "Doorbell — Camera Popup on Ring" in `automations.yaml` |
| Wall tablet | 192.168.1.244 (Galaxy Tab A SM-X200), Fully Kiosk **Plus** |
| browser_mod panel | HA sidebar → "Browser Mod" (config panel path `browser-mod-config`) |
| browser_mod storage | `/config/.storage/browser_mod.storage` |
| Pi | `micjcameron@192.168.1.128` (Docker host: HA, zigbee2mqtt, mosquitto, pihole, cloudflared, matter-server, node-red, ui-admin) |

`browser_mod.storage` shape (3.0): `data.browsers{<id>: {registered, last_seen, settings, ...}}`, `data.session_browser_map`, `data.settings` (incl. `autoRegister`), `data.user_settings`.

---

## 5. HA upgrade & rollback runbook

```bash
PI=micjcameron@192.168.1.128
CDIR=/home/micjcameron/homelab/home-automation/stacks/homeassistant

# Backup (consistent: stop first)
ssh $PI "cd $CDIR && sudo docker compose stop"
ssh $PI "sudo tar czf /home/micjcameron/ha-backup-\$(date +%Y%m%d-%H%M).tar.gz -C /home/micjcameron homeassistant"
# Tag current image so rollback is one line
ssh $PI "sudo docker tag \$(sudo docker inspect homeassistant --format '{{.Image}}') ha-rollback:PREV"
# Upgrade
ssh $PI "cd $CDIR && sudo docker compose pull && sudo docker compose up -d"
# Watch boot (DB migration is one-way — that's why we backed up)
ssh $PI "sudo docker logs -f homeassistant"

# ROLLBACK: restore tarball over /home/micjcameron/homeassistant,
# set image: ha-rollback:PREV in the compose file, docker compose up -d.
```

---

## 6. browser_mod manual update runbook (when HACS isn't convenient)

```bash
PI=micjcameron@192.168.1.128
VER=3.0.0-beta.4   # pick the tag that matches your HA major version
ssh $PI bash -c "'
  cd /home/micjcameron/homeassistant/custom_components
  curl -fsSL https://github.com/thomasloven/hass-browser_mod/archive/refs/tags/v$VER.tar.gz | tar xz -C /tmp/bm_new --one-top-level
  NEW=\$(find /tmp/bm_new -type d -path \"*custom_components/browser_mod\" | head -1)
  sudo mv browser_mod browser_mod.bak && sudo cp -r \"\$NEW\" ./browser_mod
  grep version browser_mod/manifest.json
'"
ssh $PI "cd /home/micjcameron/homelab/home-automation/stacks/homeassistant && sudo docker compose restart"
# Then HARD-reload each browser (Cmd+Shift+R) — the module's ?…&<version> cache-buster changes,
# but a hard reload is the reliable way to drop the old module.
```
> Note: dropping correct files in place keeps HACS consistent — HACS reads the installed version from `manifest.json`.

---

## 7. Diagnostic cheatsheet (everything used this session)

All assume a long-lived token in `$TOKEN` and HA at `http://localhost:8123` on the Pi.

```bash
# --- Is the doorbell push alive? ---
# (a) entity state — 'unknown' means push has never delivered
curl -s -H "Authorization: Bearer $TOKEN" .../api/states/event.front_door_ding | jq '{state, last_changed, .attributes.event_type}'
# (b) did the automation ever fire?
sudo python3 -c "import json;print(list(json.load(open('/config/.storage/trace.saved_traces'))['data']))"
# (c) FCM push lifecycle (needs firebase debug logging)
sudo docker logs homeassistant 2>&1 | grep -iE 'firebase|fcm|RingEvent|PHONE_REGISTRATION'

# --- Is browser_mod connecting? ---
# registered browsers + live session map
sudo python3 -c "import json;d=json.load(open('/config/.storage/browser_mod.storage'))['data'];print(d['browsers'].keys());print('sessions',d['session_browser_map'])"
# browser_mod entities available? (unavailable = no live connection)
curl -s -H "Authorization: Bearer $TOKEN" .../api/states | jq -r '.[]|select(.entity_id|test("^binary_sensor.browser_mod_[0-9a-f_]+$"))|"\(.entity_id)=\(.state)"'
# is the module served?
curl -s -o /dev/null -w '%{http_code}\n' .../browser_mod.js

# --- Direct popup test (bypasses doorbell/automation) ---
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"test","content":"hi","dismissable":true,"timeout":30000}' \
  .../api/services/browser_mod/popup

# --- Temporary debug logging (configuration.yaml) ---
# logger:
#   logs:
#     custom_components.browser_mod: debug
#     homeassistant.components.ring: debug
#     ring_doorbell: debug
#     firebase_messaging: debug
```

**Browser console (the client side):** look for the `BROWSER_MOD x.y.z IS INSTALLED` banner (confirms JS loaded + version) and the BrowserID; then look for red errors right after it (connection failures).

---

## 8. Durability TODO / recommendations

- [x] **Register the wall tablet** (Browser Mod panel → Register). Done 2026-06-30 (browser `67b406e9_aff1ac16`). Without this, no popups, full stop.
- [x] **Disable Fully Kiosk "delete web storage / everything on reload"** so the BrowserID persists.
- [ ] **Fully Kiosk: auto-reload on connection loss / reconnect**, so an HA restart doesn't silently leave the tablet disconnected (popup-dead) until someone touches it. *(still recommended — this is the main remaining fragility: after any HA restart the tablet must reload to re-establish its browser_mod connection.)*
- [ ] Consider whether to leave the Mac registered — it'll also receive doorbell popups while HA is open in Chrome. Unregister it from the Browser Mod panel if that's annoying.
- [ ] `autoRegister` global setting exists but is intentionally **left off** — turning it on means *every* browser that ever opens HA (guests, phones) auto-registers and receives broadcast popups. Prefer explicit per-device registration for the doorbell use-case.
- [ ] **Remove the temporary debug logging** from `configuration.yaml` once everything's confirmed (the `logger:` block added for ring/firebase/browser_mod).
- [ ] When browser_mod 3.0.0 leaves beta, move off the beta tag (HACS, or the manual runbook in §6).
- [ ] Watch for a recurring `habluetooth` "Failed to force stop scanner" error that appeared post-upgrade (Pi onboard Bluetooth). Harmless log spam so far; disable the Bluetooth integration if HA Bluetooth isn't used.

---

## 9. One-paragraph summary for future-me

The doorbell popup was dead because **Ring's push wasn't delivering** (cluttered Ring account → `PHONE_REGISTRATION_ERROR`; fixed by pruning Authorized Client Devices + Reconfigure on a freshly-upgraded HA 2026.6.4), **AND** because **browser_mod couldn't talk to the new HA frontend** (2.7.0 vs 2026.6 → updated to 3.0.0-beta.4), **AND** because **browser_mod only delivers popups to *registered* browsers** and the kiosk/Mac had fresh unregistered IDs (register via the Browser Mod sidebar panel), **AND** because **Fully Kiosk was wiping the BrowserID on every reload** (turn off delete-on-reload). The automation logic itself was fine after two small hardening edits (broadcast to all browsers; freshness-based condition). Fix all four layers and it works.
