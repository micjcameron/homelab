# Future idea: room occupancy + foot-traffic analytics

**What it gives you:** a quiet, long-running record of *how the house is actually used* —
which rooms get occupied, how often, when, and how people flow between them. Six months of
that data is a heatmap of your life at home. Genuinely cool to mine; useless to be pinged about.

> **Golden rule for this one: log, don't alert.** This is *pull* information — you go look
> when you're curious. It must **never** become a Telegram notification. (Same discipline as
> the device watcher: randomized MACs and Docker IPs don't alert, so neither should this.)

**Status:** blocked on hardware. Nothing to build until at least one real presence sensor is
reporting. Don't build the pipeline against a data shape we can't see yet.

## The hardware unlock (buy first)

PIR motion sensors are *not* enough — they only fire on movement, so a person sitting still
reads as "empty room." You want **mmWave (millimetre-wave) presence sensors**, which detect a
stationary body (breathing/micro-motion). That's what makes "is this room occupied" trustworthy.

Shortlist (cheapest → nicest):
- **HLK-LD2410** (~£5) — bare mmWave module, flashed with ESPHome onto an ESP32. Cheap, hackable,
  one room at a time. Great for a first experiment.
- **Aqara FP2** (~£55) — polished, Zigbee/Wi-Fi, **multi-zone**: one sensor reports several
  zones in a room (e.g. "desk" vs "sofa"). Best data-per-sensor; HA integration is first-class.
- **Everything Presence One / Lite** — community favourite, ESPHome-native, bundles mmWave +
  PIR + temp/lux. The "serious homelab" pick.

Start with **one** sensor in the room you're most curious about (office?). Prove the loop end-to-end
before buying for the whole house.

## The data loop (once a sensor exists)

1. Sensor → HA exposes a `binary_sensor.<room>_occupancy` (and zone sensors on the FP2).
2. HA **records** state changes to a time-series store — *no automation, no alerts*, just a recorder:
   - **InfluxDB** (HA's `influxdb:` integration) → pairs with **Grafana** for heatmaps/timelines.
     The classic homelab combo; both run as containers on the Pi, fit the existing stack pattern.
   - **Prometheus** (HA's `prometheus:` endpoint) → if you'd rather scrape than push.
   - Cheapest start: just turn on HA's built-in **long-term statistics** / recorder with a longer
     `purge_keep_days` and query later. Zero new containers — good enough to *start collecting now*.
3. Later, mine it: occupancy hours per room, time-of-day patterns, room→room flow
   (transitions between adjacent sensors firing) = foot-traffic.

## Why capture early (the one reason to not wait)

Data is **cheap to start, painful to backfill.** You can't recover the months before you turned
the recorder on. So the moment the first sensor is live, flip on logging — even crude logging —
*before* building any nice visualisation. The Grafana dashboards can come whenever; the raw
history can't be re-created.

## Possible follow-ons (only if the data earns it)

- Presence-driven lighting (room occupied → lights; truly empty → off) — but that's *automation*,
  a separate decision, and only worth it once the occupancy signal is proven reliable.
- "House asleep / everyone out" derived state from no-occupancy-anywhere.
- Anonymised flow heatmap rendered over a floor plan.

## Caveats (be honest)

- **mmWave needs tuning** — sensitivity/gate distance settings matter, and it can be fooled by
  fans, pets, or curtains moving. Budget an evening per sensor to dial in.
- **Privacy:** this is occupancy/presence only (a boolean per zone), not cameras — but it *is* a
  detailed log of your movements. It stays **local** (same rule as everything else here); never
  leaves the Pi.
- **Don't over-instrument.** One good sensor with clean data beats six noisy ones. Resist the
  dopamine. (You already said this — it's written down now so future-you can't pretend otherwise.)
