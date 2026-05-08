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
  - `stacks/` — per-service `docker-compose.yml` files (homeassistant, mosquitto, zigbee2mqtt, matter-server, pihole, node-red)
  - `scripts/` — `lifeline.sh` (5-min health check), `lifeline_daily.sh` (daily report), `manage.sh` (recreate one service), `restart-all.sh`
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
