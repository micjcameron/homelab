# TODO — Doorbell popup + tablet kiosk (paused mid-task)

Context dump so we can pick this up later without losing anything.

## Where we are

- **Doorbell automation is DEPLOYED and live** on HA: `automation.doorbell_ring_popup`
  (in `homeassistant-config/automations.yaml`).
  - Trigger: `event.front_door_ding` (the real doorbell PRESS, not motion).
  - Action: `browser_mod.popup` showing `camera.front_door_live_view` (live), 30s timeout.
  - Targets both registered browsers:
    - `browser_mod_ab0fd561_71b7fcdf`  ← active (seen recently)
    - `browser_mod_0b6a24d9_ba0dcfa6`  ← dormant (last seen May 4)
- **Blocked on:** both tablets were `unavailable` (offline). User is charging a tablet.
  Can't see a popup until a tablet is connected.
- HA long-lived token was reset during an earlier deploy bug; **new token is already in
  `scripts/ha-snapshot.py`** (HA_TOKEN default) and `personal-scripts/bin-reminder/bin-reminder.sh`.
- Nothing is committed to git yet (all changes in working tree).

## Next steps when the tablet is connected

1. **Confirm the tablet is online.** Look for its browser_mod media_player to NOT be `unavailable`:
   ```bash
   TOKEN=$(grep -o 'eyJ[A-Za-z0-9._-]*' home-automation/scripts/ha-snapshot.py | head -1)
   curl -s -H "Authorization: Bearer $TOKEN" http://192.168.1.128:8123/api/states \
     | python3 -c "import sys,json;[print(s['entity_id'],s['state']) for s in json.load(sys.stdin) if 'media_player.browser_mod' in s['entity_id']]"
   ```
2. **If it's a NEW Fully install, it registers a NEW browser_mod device.** Re-run
   `./home-automation/scripts/ha-snapshot.py` and check `snapshots/entities-index.json`
   for a new `browser_mod_*` id. Add that id to the `browser_id:` list in
   `automations.yaml` → doorbell automation, then `./home-automation/scripts/ha-deploy.sh push`.
3. **Fire a TEST popup** (don't need to physically ring the bell):
   ```bash
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     http://192.168.1.128:8123/api/services/browser_mod/popup \
     -d '{"browser_id":["browser_mod_ab0fd561_71b7fcdf"],"title":"🔔 Test","timeout":15000,
          "content":{"type":"picture-entity","entity":"camera.front_door_live_view","camera_view":"live"}}'
   ```
   → Watch the tablet: the camera should pop up. Adjust which `browser_id` to the connected one.
4. **Test the real trigger** — ring the doorbell (or fire the event), confirm the popup appears.
5. **Confirm auto-close** after 30s.

## Known gaps to finish (the "make it actually good" list)

- [ ] **Wake the screen on ring.** Current automation does NOT turn the screen on, so if
      the tablet is asleep the popup won't be seen. Add a first action to turn on
      `light.browser_mod_<id>_screen` (and maybe set brightness) BEFORE the popup.
- [ ] **TTS announcement** (user wants this): play "Someone's at the front door" on the
      tablet via `tts.speak` → `media_player.browser_mod_<id>` (engine: `tts.home_assistant_cloud`).
      Optional doorbell chime sound too.
- [ ] **Kiosk setup on the tablet** (user's part, on the device — Fully Kiosk PLUS):
      - Start URL → the dashboard (`http://192.168.1.128:8123/wall-panel`)
      - Advanced Web Settings → enable "Fully Kiosk JavaScript Interface" (so browser_mod connects)
      - Device Management → grant device admin (screen on/off)
      - Remote Administration → set password (for the optional Fully Kiosk HA integration)
      - Motion Detection + Screensaver → screen-off timer + wake-on-motion (motion-wake goal)
- [ ] **Decide on the old `Ring Motion Popup` automation** (`id: '1757506664118'`): it's
      motion-triggered and broken (`deviceID: [this]`). Either fix to target a real
      browser, repurpose, or delete to avoid confusion/double popups.
- [ ] Optionally add the **Fully Kiosk Browser integration** in HA for a real motion
      `binary_sensor` + battery + brightness (nicer motion-wake than browser_mod alone).

## Loose ends (not doorbell, but noted)

- [ ] User's phone app / tablets may have been logged out by the auth-store incident —
      re-login with HA password if so.
- [ ] `bin-reminder.sh` new token only takes effect on the Pi after `cd ~/homelab && git pull`
      (needs a commit first), or copy the file over.
- [ ] Nothing committed yet — when happy, commit the whole session's work.
