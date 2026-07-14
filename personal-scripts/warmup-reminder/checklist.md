# Email warmup — michael@camcosolutions.net

Getting the **cold-send** mailbox trusted by Gmail/Outlook before any outreach. ~14 days of
light, genuine activity. Only `michael@camcosolutions.net` needs this — `info@` is
transactional and doesn't. A Telegram nudge fires each morning (`warmup-reminder.sh`); just
do what it says.

## Why it's manual (don't try to automate the sending)
Gmail scores you on **real human signals**: people opening your mail, **replying**, and
pulling it out of spam. A cron job blasting emails = robotic pattern, zero engagement =
looks like a spambot and *hurts* the domain. The only thing automated here is the daily
*reminder*. The sending is you, by hand.

## One-time setup (Day 0)
- [ ] Set your start date in `warmup-reminder.sh` → `WARMUP_START` (default `2026-07-15`).
- [ ] Line up **3–5 real people** (friends/family) who'll trade a few emails with you over
      the next 2 weeks and actually reply. Ask them up front. Mixed providers help
      (a Gmail, an Outlook/Hotmail, a work domain).
- [ ] From `michael@camcosolutions.net`, **subscribe to 6–8 reputable newsletters** (news,
      a retailer or two, a SaaS). Confirm each opt-in — creates normal inbound. Do it once.
- [ ] (Optional) Add both domains to **Google Postmaster Tools** (postmaster.google.com) to
      watch domain reputation over the fortnight.

## Daily routine (~5 min, every day — no gaps)
1. **Send** the day's target number of short, plain-text emails to a mix of your real
   contacts, your personal Gmail, and `info@camcosolutions.nl`. Casual, real content.
2. **Reply** to every warmup thread in the inbox — back-and-forth is the strongest signal;
   keep threads 2–3 replies deep.
3. **Rescue from spam**: check Spam + the Promotions tab → "Report not spam" / drag to
   Primary. Star a few.
4. **Open and read** inbound (newsletters, replies) — don't leave them unread.

## Volume ramp (climb, don't blast)
| Days | Emails/day from michael@ | Links? |
|---|---|---|
| 1–3 | 3 | none |
| 4–7 | 4 | none |
| 8–11 | 6 | one link OK |
| 12–14 | 8 | one link OK |

## Rules
- Plain text. Vary subject + wording every time; never send identical copies.
- **No links/attachments** the first week. One link max from day 8. No attachments at all.
- Spread sends across normal working hours — never all at once, never 3am.
- Consistency beats volume: every day, even a light one. No multi-day gaps.

## When warmup's done (after ~14 clean days)
- [ ] Tighten **DMARC** on BOTH domains `p=none` → `p=quarantine` (Cloudflare → DNS → `_dmarc`).
- [ ] Start real cold sends at **3–4/day**, ramping slowly toward ~15/week.
- [ ] Remove the warmup line from `cron/crontab` (or leave it — goes silent after the window).

## Daily log
| Day | Date | Sent | Replied | Spam-rescued | ✓ |
|---|---|---|---|---|---|
| 1 |  |  |  |  | ☐ |
| 2 |  |  |  |  | ☐ |
| 3 |  |  |  |  | ☐ |
| 4 |  |  |  |  | ☐ |
| 5 |  |  |  |  | ☐ |
| 6 |  |  |  |  | ☐ |
| 7 |  |  |  |  | ☐ |
| 8 |  |  |  |  | ☐ |
| 9 |  |  |  |  | ☐ |
| 10 |  |  |  |  | ☐ |
| 11 |  |  |  |  | ☐ |
| 12 |  |  |  |  | ☐ |
| 13 |  |  |  |  | ☐ |
| 14 |  |  |  |  | ☐ |
