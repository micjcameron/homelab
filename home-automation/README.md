# Home Automation — tooling & workflow

Everything for running and editing the Home Assistant + Docker-stack setup on the
Raspberry Pi. **You edit on the Mac and deploy straight to the Pi — GitHub is optional.**

---

## TL;DR — the commands you'll actually use

```bash
# From the repo root, on your Mac:

# Deploy HA config changes straight to the Pi (NO GitHub needed) — the main one:
./home-automation/scripts/ha-deploy.sh push

# Refresh the JSON inventory of your live HA (entities, rooms, devices, services):
./home-automation/scripts/ha-snapshot.py

# Pull live config back into the repo (capture edits you made in the HA UI):
./home-automation/scripts/ha-deploy.sh pull

# Full reference copy of the entire live HA config dir into the repo:
./home-automation/scripts/ha-deploy.sh mirror
```

That's 90% of it. Details below.

---

## The setup (this environment)

| Thing | Value |
|---|---|
| Pi host | `micjcameron@192.168.1.128` (hostname `raspberrypi`) |
| Repo on the Pi | `~/homelab` |
| Live HA config dir | `/home/micjcameron/homeassistant` → bind-mounted into the container at `/config` |
| HA container | `homeassistant` (`network_mode: host`, so HA is on `:8123`) |
| SSH | `ssh micjcameron@192.168.1.128` (uses your Mac's SSH key/agent) |

These are set in the `CONFIG` block at the top of `scripts/ha-deploy.sh` and in
`scripts/ha-snapshot.py`. Change them there if anything moves.

---

## Deploying to the Pi without GitHub — how it works

`ha-deploy.sh push` is the git-free path. You never have to commit or push to GitHub.
Here's exactly what happens when you run it on the Mac:

1. **rsync** your repo's `homeassistant-config/` to a staging area on the Pi
   (`~/ha-incoming/`) — secrets, `.storage`, the database, HACS, etc. are excluded,
   so only your *editable* config is sent.
2. It copies `ha-deploy.sh` over too and runs it **on the Pi** in `--local` mode,
   where Docker lives. On the Pi it then:
   1. **Backs up** the current live config to `~/ha-backups/<timestamp>/` (last 10 kept).
   2. **Stages** a merged copy: live `secrets.yaml` + `.storage` overlaid with your
      pushed config — so the validator can resolve `!secret` and integrations.
   3. **Validates** it with HA's own `check_config`, run against the *exact image
      version* your container uses. **If this fails, your live HA is never touched.**
   4. **Promotes** the validated config to the live dir (your `secrets.yaml` and
      `.storage` are preserved — the deploy can't overwrite or delete them).
   5. **Restarts** the container and **polls `:8123`** until HA answers.
   6. **Rolls back** automatically (restores the backup + restarts) if HA doesn't
      come back up.

So a broken edit can't take HA down — validation happens before anything is promoted.
You generally watch one command and get a ✓ or a clear error.

> **Why git-free?** The Pi already has the repo at `~/homelab`, but committing every
> tiny dashboard tweak is friction. `push` rsyncs straight from your working copy.
> Use the git-based `deploy` (below) when you *do* want the Pi to match a committed
> state.

---

## The scripts

All live in `home-automation/scripts/` unless noted.

### `ha-deploy.sh` — safe Home Assistant config deploy ⭐

The workhorse. One script, several modes:

| Command | What it does | Needs GitHub? |
|---|---|---|
| `ha-deploy.sh push` | rsync repo config → Pi, then safe deploy (backup→validate→promote→restart→rollback). **Default.** | No |
| `ha-deploy.sh deploy` | SSH to Pi → `git pull` → safe deploy. Use when the Pi should match a committed state. | Yes |
| `ha-deploy.sh pull` | rsync the *tracked* config from live → repo (capture UI-made automation edits). Excludes secrets/`.storage`/HACS. | No |
| `ha-deploy.sh mirror` | rsync the **entire** live config dir → repo for reference (incl. `.storage`, secrets, integration source). Skips only the DB, logs, caches and HACS's own bulk. | No |
| `ha-deploy.sh --local` | The Pi-side worker the others invoke. You won't normally run this directly. | — |

**Why it exists:** the old `sync.sh` just rsynced files with no validation, no backup,
no rollback — a typo could take HA offline. `ha-deploy.sh` adds the whole safety net.

**Safety rules baked in (learned the hard way):**
- It never writes to `secrets.yaml`, `.storage`, `custom_components/`, `www/`, the
  database, or HA's built-in blueprints — only your authored config.
- It uses `--no-owner --no-group` (you're not root; HA writes some files as root) and
  **never uses `--delete`** on the live dir, so it can't remove anything HA owns.

### `ha-snapshot.py` — live HA inventory → JSON

Pulls a structured, version-controllable picture of your **live** HA instance over the
REST + template API. Token only — no SSH, stdlib Python, no installs.

```bash
./home-automation/scripts/ha-snapshot.py                 # everything
./home-automation/scripts/ha-snapshot.py entities areas  # only selected targets
HA_URL=http://x:8123 HA_TOKEN=xxx ./.../ha-snapshot.py   # override target/token
```

Targets: `entities`, `registry`, `areas`, `devices`, `services`, `config`, `automations`.
Writes to `home-automation/snapshots/`:

| File | Contents |
|---|---|
| `entities.json` | Every entity with full state + attributes |
| `entities-index.json` | Slim index: id / name / domain / state / area / device |
| `entity-registry.json` | entity → area + device mapping |
| `areas.json` | area → its entities + devices |
| `devices.json` | device id / name / manufacturer / model / area |
| `services.json` | All callable services (for writing automations) |
| `config.json` | HA version / location / settings |
| `automations.json`, `scripts.json`, `scenes.json` | Live state of each |
| `_summary.json` | Generated-at, HA version, counts |

**Why it exists:** so editing automations/dashboards is "look it up in the repo," not
"go poke the live system." When you say *"turn off the kitchen lights,"* the entity IDs,
areas and services are already here.

### Existing stack scripts (pre-existing, documented for completeness)

| Script | Role |
|---|---|
| `scripts/manage.sh <name\|all>` | (Re)create one service (or all, ordered) from its compose file. |
| `scripts/lifeline.sh` | Cron watchdog (every 5 min): temp/load/disk, restarts Docker, recreates dead/unhealthy services, Telegram alerts. |
| `scripts/lifeline_daily.sh` | Daily status report to Telegram. |
| `scripts/restart-all.sh` | Restart all HA services in order. |
| `homeassistant-config/sync.sh` | **Legacy** rsync push/pull. Superseded by `ha-deploy.sh` (no validation/backup) — kept only for reference. |

---

## Directory layout

```
home-automation/
├── README.md                     # ← this file
├── homeassistant-config/         # the HA config (mirrored in full for reference)
│   ├── configuration.yaml        #   includes the YAML "wall-panel" dashboard
│   ├── automations.yaml          #   automations (incl. doorbell popup)
│   ├── scripts.yaml  scenes.yaml
│   ├── dashboards/
│   │   └── wall.yaml             #   repo-controlled "Home" dashboard (YAML mode)
│   ├── blueprints/
│   │   └── automation/micjcameron/   # your own blueprints (tracked + deployed)
│   ├── .storage/                 #   HA UI state — reference only, NEVER deployed
│   ├── custom_components/        #   HACS integrations — reference only, NEVER deployed
│   └── secrets.yaml              #   reference only, NEVER deployed/overwritten
├── snapshots/                    # generated JSON inventory (ha-snapshot.py)
├── dashboard-backups/            # exported UI dashboards (central/map/overview), reference only
├── scripts/                      # ha-deploy.sh, ha-snapshot.py, manage.sh, lifeline*, restart-all.sh
├── stacks/                       # one docker-compose.yml per service
├── services.json                 # service registry for manage.sh / lifeline
└── notes/                        # docker inspect / compose reference dumps
```

**Key idea:** the repo holds a *full mirror* of the HA config so you can reference
anything here — but the deploy only ever pushes the handful of files **you author**
(`configuration.yaml`, `automations.yaml`, `scripts.yaml`, `scenes.yaml`, `dashboards/`,
your `blueprints/`). The rest (`.storage`, `custom_components`, `secrets.yaml`, `www`,
the DB) is reference-only and stays on the Pi.

---

## Recipes

**Change a dashboard**
```bash
# edit homeassistant-config/dashboards/wall.yaml
./home-automation/scripts/ha-deploy.sh push     # ~30s later it's live at /wall-panel
```

**Add / edit an automation**
```bash
./home-automation/scripts/ha-snapshot.py        # refresh entity/service reference first
# edit homeassistant-config/automations.yaml
./home-automation/scripts/ha-deploy.sh push
```

**Capture changes you made in the HA UI back into the repo**
```bash
./home-automation/scripts/ha-deploy.sh pull
# review with: git status / git diff, then commit if you want
```

**Author a reusable blueprint**
```bash
# put it in homeassistant-config/blueprints/automation/micjcameron/<name>.yaml
./home-automation/scripts/ha-deploy.sh push
# reference from automations.yaml: use_blueprint: { path: micjcameron/<name>.yaml, ... }
```

**Back up the UI dashboards to readable YAML**  (manual for now)
```bash
# re-export the storage-mode dashboards into dashboard-backups/*.yaml
# (ask Claude to re-run the export, or fold it into a script later)
```

---

## Secrets & tokens

This is a **private** repo, so secrets are kept in it for convenience (Telegram bot
tokens, the HA long-lived token in `ha-snapshot.py` / `bin-reminder.sh`). The deploy
never pushes `secrets.yaml` to the Pi (it already lives there).

- The HA long-lived token lives in `scripts/ha-snapshot.py` and
  `personal-scripts/bin-reminder/bin-reminder.sh`. Override at runtime with `HA_TOKEN=`.
- If a token ever stops working, make a new one in HA: **Profile → Security →
  Long-lived access tokens**, then replace it in those two files.
- `bin-reminder.sh` runs from the repo **on the Pi**, so a new token there only takes
  effect after the Pi has the updated file (`cd ~/homelab && git pull`, or copy it over).

---

## Gotchas / hard-won lessons

- **HA writes some files as root** (`.storage/auth`, cloud/Google tokens). Don't rsync
  the whole config dir with `--delete` as your normal user — it can't read those files
  and `--delete` will then *remove* them, wiping HA's token store and logging everyone
  out. `ha-deploy.sh` is built to never do this; if you hand-roll rsync, exclude
  `.storage/` and never use `--delete` against the live dir.
- **`check_config` uses the image's Python**, so validation matches your running HA
  version exactly and pulls nothing extra.
- **Dashboards are not YAML by default** — the ones you build in the HA UI live as JSON
  in `.storage`. The repo-controlled `wall.yaml` is a separate **YAML-mode** dashboard
  added via `configuration.yaml`; it sits alongside the UI ones without touching them.
- **`browser_mod` is required** for the tablet popups/screen/TTS — it's not the failed
  "kiosk-mode" experiment; don't uninstall it.
- If HA logs `invalid authentication`, your long-lived token is dead — make a new one
  (above). Repeated failed calls can get your IP temporarily banned by HA.
