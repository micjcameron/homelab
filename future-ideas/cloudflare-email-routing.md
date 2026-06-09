# Future idea: free email on camcosolutions.nl → Gmail

**What it gives you:** `you@camcosolutions.nl` (or a catch-all) forwarding straight into
your Gmail inbox. Free, ~5 minutes, since the domain's already on Cloudflare.

**Caveat:** it's **receive/forward only**. Sending *as* `you@camcosolutions.nl` is a
separate add-on (see bottom). For "looks legit on quotes/invoices + I get the replies,"
inbound-only is usually enough.

## Setup (Cloudflare dashboard)
1. Cloudflare → select **camcosolutions.nl** → left sidebar **Email → Email Routing**.
2. **Get started / Enable Email Routing.**
3. Add a **destination address** = your Gmail → Cloudflare emails you a **verification
   link** → click it (one-time).
4. Create a route:
   - Specific: `michael@camcosolutions.nl` → your Gmail, **or**
   - **Catch-all**: `*@camcosolutions.nl` → your Gmail (anything lands in Gmail).
5. Click to let Cloudflare **auto-add the MX + SPF records**. Done — mail now drops into Gmail.

## If you later want to SEND as it too
Email Routing can't send outbound. To send *as* `michael@camcosolutions.nl` from Gmail:
1. Sign up for a free SMTP relay — **Brevo**, **Resend**, or **SMTP2GO** (free tiers cover
   a ZZP's volume). Verify the domain there (a couple of DNS records).
2. In Gmail → **Settings → Accounts → "Send mail as" → Add another email address** →
   enter `michael@camcosolutions.nl` + the relay's SMTP host/credentials.
3. Now Gmail's "From" dropdown can send as the domain address.

*(Alternative to all of the above: a real mailbox provider — **Zoho Mail free**, Migadu,
or Fastmail — gives proper send+receive at the domain, but replaces Cloudflare Routing
since you'd point MX at them instead.)*
