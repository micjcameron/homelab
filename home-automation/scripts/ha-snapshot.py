#!/usr/bin/env python3
"""
ha-snapshot.py — Reusable Home Assistant inventory snapshotter.

Pulls a structured, version-controllable picture of your live HA instance and
writes it to JSON files under home-automation/snapshots/. Run it whenever you
want a fresh reference for editing automations/scripts/scenes, or to diff what
changed in HA over time.

Uses ONLY the Python standard library (urllib) and the HA REST + template APIs,
so it needs nothing but a long-lived token — no SSH, no pip installs.

Usage:
    ./ha-snapshot.py                  # snapshot everything
    ./ha-snapshot.py entities areas   # snapshot only selected targets
    HA_URL=http://x:8123 HA_TOKEN=... ./ha-snapshot.py

Targets: entities, registry, areas, devices, services, config, automations
         (automations also covers scripts + scenes)

Config resolution (each value): env var -> default below.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Config (env overrides defaults) ──────────────────────────────────────────
HA_URL = os.environ.get("HA_URL", "http://192.168.1.128:8123").rstrip("/")
HA_TOKEN = os.environ.get(
    "HA_TOKEN",
    # Personal repo: default token baked in for convenience. Override via env.
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI4YWQwNDcyZDJhMWE0YWRmOTBhNzc5ZjE3MjNiZjEzMCIsImlhdCI6MTc4MDkxNDU3OCwiZXhwIjoyMDk2Mjc0NTc4fQ.o9Qev4tBhNM5qovTWU4jFCpHb9LNzBnMUgkysEoD3Xo",
)

# Output dir: <repo>/home-automation/snapshots/  (this file is in .../scripts/)
_env_dir = os.environ.get("HA_SNAPSHOT_DIR", "").strip()
OUT_DIR = Path(_env_dir) if _env_dir else (Path(__file__).resolve().parent.parent / "snapshots")

ALL_TARGETS = ["entities", "registry", "areas", "devices", "services", "config", "automations"]


# ── HTTP helpers ─────────────────────────────────────────────────────────────
def _request(path, *, method="GET", payload=None):
    url = f"{HA_URL}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {HA_TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode()
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR {e.code} on {method} {path}: {e.read().decode()[:300]}")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR connecting to {url}: {e.reason}")


def api_get(path):
    return json.loads(_request(path))


def api_template(template):
    """Render a Jinja template via /api/template and parse it as JSON."""
    return json.loads(_request("/api/template", method="POST", payload={"template": template}))


def write_json(name, data):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.json"
    # Stable, pretty output so git diffs are meaningful.
    path.write_text(json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"  wrote {path.relative_to(Path.cwd())}" if _under_cwd(path) else f"  wrote {path}")
    return data


def _under_cwd(path):
    try:
        path.relative_to(Path.cwd())
        return True
    except ValueError:
        return False


# ── Jinja templates (rendered server-side, returned as JSON) ─────────────────
TPL_AREAS = """
{%- set ns = namespace(out=[]) -%}
{%- for aid in areas() -%}
  {%- set ns.out = ns.out + [{
        "area_id": aid,
        "name": area_name(aid),
        "entities": area_entities(aid),
        "devices": area_devices(aid)
      }] -%}
{%- endfor -%}
{{ ns.out | sort(attribute='name') | list | tojson }}
"""

TPL_DEVICES = """
{%- set ns = namespace(ids=[]) -%}
{%- for s in states -%}
  {%- set d = device_id(s.entity_id) -%}
  {%- if d and d not in ns.ids -%}{%- set ns.ids = ns.ids + [d] -%}{%- endif -%}
{%- endfor -%}
{%- set ns2 = namespace(out=[]) -%}
{%- for d in ns.ids -%}
  {%- set ns2.out = ns2.out + [{
        "id": d,
        "name": device_attr(d, 'name_by_user') or device_attr(d, 'name'),
        "manufacturer": device_attr(d, 'manufacturer'),
        "model": device_attr(d, 'model'),
        "area": area_name(d)
      }] -%}
{%- endfor -%}
{{ ns2.out | sort(attribute='name') | list | tojson }}
"""

TPL_ENTITY_REGISTRY = """
{%- set ns = namespace(out=[]) -%}
{%- for s in states -%}
  {%- set e = s.entity_id -%}
  {%- set ns.out = ns.out + [{
        "entity_id": e,
        "name": state_attr(e, 'friendly_name'),
        "domain": e.split('.')[0],
        "area": area_name(e),
        "device_id": device_id(e)
      }] -%}
{%- endfor -%}
{{ ns.out | sort(attribute='entity_id') | list | tojson }}
"""


# ── Snapshot builders ────────────────────────────────────────────────────────
def snap_entities(cache):
    states = cache["states"]
    write_json("entities", sorted(states, key=lambda s: s["entity_id"]))
    # Slim index merged with area/device from the registry render.
    reg = {r["entity_id"]: r for r in cache.setdefault("registry", api_template(TPL_ENTITY_REGISTRY))}
    index = [
        {
            "entity_id": s["entity_id"],
            "name": s["attributes"].get("friendly_name"),
            "domain": s["entity_id"].split(".")[0],
            "state": s["state"],
            "area": reg.get(s["entity_id"], {}).get("area"),
            "device_id": reg.get(s["entity_id"], {}).get("device_id"),
        }
        for s in sorted(states, key=lambda s: s["entity_id"])
    ]
    write_json("entities-index", index)


def snap_registry(cache):
    write_json("entity-registry", cache.setdefault("registry", api_template(TPL_ENTITY_REGISTRY)))


def snap_areas(cache):
    write_json("areas", api_template(TPL_AREAS))


def snap_devices(cache):
    write_json("devices", api_template(TPL_DEVICES))


def snap_services(cache):
    write_json("services", api_get("/api/services"))


def snap_config(cache):
    cfg = api_get("/api/config")
    # Drop noisy/volatile fields that churn diffs.
    for k in ("components",):
        cfg.pop(k, None)
    write_json("config", cfg)


def snap_automations(cache):
    states = cache["states"]
    for domain in ("automation", "script", "scene"):
        items = [
            {"entity_id": s["entity_id"], "state": s["state"], "attributes": s["attributes"]}
            for s in states
            if s["entity_id"].startswith(f"{domain}.")
        ]
        write_json(f"{domain}s" if domain != "scene" else "scenes", sorted(items, key=lambda x: x["entity_id"]))


BUILDERS = {
    "entities": snap_entities,
    "registry": snap_registry,
    "areas": snap_areas,
    "devices": snap_devices,
    "services": snap_services,
    "config": snap_config,
    "automations": snap_automations,
}


def main():
    targets = [a for a in sys.argv[1:] if not a.startswith("-")] or ALL_TARGETS
    unknown = [t for t in targets if t not in BUILDERS]
    if unknown:
        sys.exit(f"Unknown target(s): {', '.join(unknown)}\nValid: {', '.join(ALL_TARGETS)}")

    print(f"Snapshotting HA at {HA_URL} -> {OUT_DIR}")
    cache = {"states": api_get("/api/states")}
    cfg = api_get("/api/config")

    for t in targets:
        print(f"- {t}")
        BUILDERS[t](cache)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ha_version": cfg.get("version"),
        "location_name": cfg.get("location_name"),
        "url": HA_URL,
        "targets": targets,
        "entity_count": len(cache["states"]),
    }
    write_json("_summary", summary)
    print(f"Done. {summary['entity_count']} entities, HA {summary['ha_version']}.")


if __name__ == "__main__":
    main()
