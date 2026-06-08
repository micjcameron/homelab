# homelab

Home automation stack + personal scripts running on a Raspberry Pi.

## Pi

- Host: `raspberrypi` (`192.168.1.128`)
- User: `micjcameron`
- Repo path: `~/homelab`
- SSH: `ssh micjcameron@192.168.1.128`
- Timezone: Europe/Amsterdam

## Layout

- `home-automation/`
  - `homeassistant-config/` — the tracked part of HA's `/config` (`configuration.yaml`, `automations.yaml`, `scripts.yaml`, `scenes.yaml`)
  - `snapshots/` — generated JSON inventory of the **live** HA instance (entities, areas, devices, services, …) — see [Home Assistant](#home-assistant)
  - `stacks/` — per-service `docker-compose.yml` files (homeassistant, mosquitto, zigbee2mqtt, matter-server, pihole, node-red)
  - `scripts/` — `ha-deploy.sh` (safe HA config deploy), `ha-snapshot.py` (fetch HA inventory → `snapshots/`), `lifeline.sh` (5-min health check), `lifeline_daily.sh` (daily report), `manage.sh` (recreate one service), `restart-all.sh`
  - `services.json` — services lifeline manages, ordered by startup
  - `notes/` — reference dumps (docker inspect, original compose, etc.)
- `personal-scripts/`
  - `parent-reminder/` — sends 3–5 random parenting reminders via Telegram at 07:00 / 13:00 / 17:00
- `cron/` — canonical `crontab` + `install.sh`

Active container volume mounts on the Pi (do not delete): `~/homeassistant`, `~/mosquitto`, `~/zigbee2mqtt`, `~/matter`, `~/etc-pihole`, `~/etc-dnsmasq.d`, `~/node-red`.

## Day-to-day

Deploy a change:
```bash
git push   # locally
ssh micjcameron@192.168.1.128
cd ~/homelab && git pull
```

Update the crontab from the repo:
```bash
~/homelab/cron/install.sh
```

Recreate a single service:
```bash
~/homelab/home-automation/scripts/manage.sh <service-name>
```

Restart all home automation services:
```bash
~/homelab/home-automation/scripts/restart-all.sh
```

Logs:
```bash
tail -f ~/lifeline.log         # lifeline + daily report
tail -f ~/parent-reminder.log  # parent-reminder cron
```

## Home Assistant

HA runs as the `homeassistant` Docker container (`network_mode: host`, so it's on `:8123`).
Its config dir on the Pi is `~/homeassistant`, bind-mounted to `/config`. We track only the
hand-edited files under `home-automation/homeassistant-config/` — `secrets.yaml` and `.storage`
live on the Pi only (see [.gitignore](.gitignore)) and are never overwritten by a deploy.

### Snapshot the live instance

`scripts/ha-snapshot.py` pulls a structured, diffable picture of the live HA instance over
the REST + template API (token only, stdlib Python, no SSH, no installs) into
`home-automation/snapshots/`. This is the reference for editing automations — entity IDs,
friendly names, areas, devices, and callable services are all there, so there's no guessing.

```bash
./home-automation/scripts/ha-snapshot.py                 # everything
./home-automation/scripts/ha-snapshot.py entities areas  # only selected targets
```

Outputs: `entities.json`, `entities-index.json` (slim id/name/domain/area/device),
`entity-registry.json`, `areas.json`, `devices.json`, `services.json`, `config.json`,
`automations.json` / `scripts.json` / `scenes.json`, and `_summary.json`. Commit them to
track how the instance changes over time. Handy queries (need `jq`):

```bash
cd home-automation/snapshots
jq -r '.[] | "\(.name): \(.entities|length) entities"' areas.json
jq -r '.[] | select(.domain=="light") | "\(.entity_id)\t\(.area)"' entities-index.json
jq -r '.[] | "\(.name) — \(.manufacturer) \(.model)"' devices.json
```

The token and URL default to this setup in `ha-snapshot.py`; override with `HA_URL=` / `HA_TOKEN=`.

### Deploy config changes safely

`scripts/ha-deploy.sh` deploys with a safety net. Run it from the Mac; the work runs on the
Pi (where Docker is): it **backs up** the live config, builds a **staging** copy (live
`secrets`/`.storage` + repo config), **validates** it with HA's own `check_config` against
the exact running image, **promotes** only if valid, **restarts**, polls `:8123`, and
**auto-rolls-back** if HA doesn't come up. A broken commit can't take HA down.

```bash
git add . && git commit -m "tweak automation" && git push   # on the Mac
./home-automation/scripts/ha-deploy.sh                        # Mac → ssh Pi → git pull → safe deploy
./home-automation/scripts/ha-deploy.sh pull                   # round-trip: tracked config from live → repo
./home-automation/scripts/ha-deploy.sh mirror                 # FULL reference copy of the live config → repo
```

`pull` vs `mirror`:
- **`pull`** brings back just the deployable config (excludes `secrets`/`.storage`/
  `custom_components`) — use it to capture UI-made automation edits before you redeploy.
- **`mirror`** copies the **entire** live config dir for reference — `.storage` registries,
  `secrets.yaml`, the `browser_mod`/`afvalbeheer` integration source, built-in blueprints,
  `www/`. It skips only what has no reference value or would bloat git: the recorder DB,
  logs, caches, HACS's own 51M source, and `.storage.bak*`. The deploy step never pushes the
  reference-only files back to the Pi, so it's safe to keep them in the repo.

## Lifeline monitoring

- `lifeline.sh` runs every 5 minutes — checks temp, load, disk, docker daemon, and each enabled service.
- On failure: Telegram alert, then attempts recreation via `manage.sh`.
- `lifeline_daily.sh` runs at 10:00 with a full status summary.

## Telegram bots

- **Lifeline alerts** — token hardcoded in `home-automation/scripts/lifeline.sh` and `lifeline_daily.sh`.
- **Parent reminder** — token hardcoded in `personal-scripts/parent-reminder/parent-reminder.sh`.

To rotate a token: revoke via @BotFather, create new bot, replace token in the relevant script.

## Adding a new service

1. Create `home-automation/stacks/<name>/docker-compose.yml`.
2. Add entry to `home-automation/services.json` with `enabled: true` and a unique `order`.
3. (Optional) add `special_check` if it needs custom health validation — see `lifeline.sh`'s `case` block.
4. Commit, push, pull on Pi.
5. Run `~/homelab/home-automation/scripts/manage.sh <name>` to start it.

## Adding a new personal script

1. Create `personal-scripts/<name>/` and the script inside it (`chmod +x`).
2. Add cron entry to `cron/crontab`.
3. Run `~/homelab/cron/install.sh` on Pi.
