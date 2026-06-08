import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveredDevice } from './network.types';

const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
const BLOCKED_GROUP = 'ui-admin-blocked';

/**
 * Pi-hole v6 REST client. Authenticates with the app password to get a session
 * SID (cached, re-auth on expiry), lists discovered devices, and best-effort
 * DNS-blocks a device by assigning it to a deny-all group.
 */
@Injectable()
export class PiholeClient {
  private readonly logger = new Logger(PiholeClient.name);
  private readonly base: string;
  private readonly password: string;
  private sid: string | null = null;

  constructor(config: ConfigService) {
    this.base = config.get<string>('app.piholeUrl', '').replace(/\/$/, '');
    this.password = config.get<string>('app.piholePassword', '');
  }

  private async authenticate(): Promise<string> {
    const res = await fetch(`${this.base}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: this.password }),
    });
    const data = (await res.json()) as any;
    const sid = data?.session?.sid;
    if (!sid) throw new Error('Pi-hole auth failed (no SID)');
    this.sid = sid;
    return sid;
  }

  /** Authenticated fetch; re-auths once on 401. */
  private async api(path: string, init: RequestInit = {}, retry = true): Promise<any> {
    if (!this.sid) await this.authenticate();
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', sid: this.sid!, ...(init.headers || {}) },
    });
    if (res.status === 401 && retry) {
      this.sid = null;
      return this.api(path, init, false);
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async getDevices(): Promise<DiscoveredDevice[]> {
    const data = await this.api('/api/network/devices');
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    return devices
      .filter((d: any) => MAC_RE.test(d.hwaddr))
      .map((d: any): DiscoveredDevice => {
        const ip = Array.isArray(d.ips) && d.ips.length ? d.ips[0] : null;
        return {
          mac: String(d.hwaddr).toLowerCase(),
          vendor: d.macVendor || null,
          ip: ip?.ip ?? null,
          hostname: ip?.name ?? null,
          lastSeen: d.lastQuery ?? ip?.lastSeen ?? null,
        };
      });
  }

  /** Raw Pi-hole record for one device (interface, counts, all IPs, …). */
  async getRawDevice(mac: string): Promise<any | null> {
    const data = await this.api('/api/network/devices');
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    return (
      devices.find(
        (d: any) => String(d.hwaddr).toLowerCase() === mac.toLowerCase(),
      ) ?? null
    );
  }

  /** Top domains a client (by IP) has recently queried — the "what is it" clue. */
  async getTopDomains(
    ip: string,
    length = 300,
  ): Promise<{ domain: string; count: number }[]> {
    if (!ip) return [];
    const data = await this.api(
      `/api/queries?client_ip=${encodeURIComponent(ip)}&length=${length}`,
    );
    const queries = Array.isArray(data?.queries) ? data.queries : [];
    const counts = new Map<string, number>();
    for (const q of queries) {
      const dom = q?.domain;
      if (!dom) continue;
      counts.set(dom, (counts.get(dom) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  // ── best-effort DNS block (soft block) ─────────────────────────────────────
  async blockClient(mac: string): Promise<boolean> {
    try {
      const groupId = await this.ensureBlockedGroup();
      // upsert the client into the blocked group (and ONLY that group)
      await this.api('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ client: mac, comment: 'blocked by ui-admin', groups: [groupId] }),
      }).catch(() => this.api(`/api/clients/${encodeURIComponent(mac)}`, {
        method: 'PUT',
        body: JSON.stringify({ comment: 'blocked by ui-admin', groups: [groupId] }),
      }));
      return true;
    } catch (e) {
      this.logger.warn(`Pi-hole block failed for ${mac}: ${String(e)}`);
      return false;
    }
  }

  async unblockClient(mac: string): Promise<boolean> {
    try {
      await this.api(`/api/clients/${encodeURIComponent(mac)}`, {
        method: 'PUT',
        body: JSON.stringify({ comment: 'unblocked by ui-admin', groups: [0] }),
      });
      return true;
    } catch (e) {
      this.logger.warn(`Pi-hole unblock failed for ${mac}: ${String(e)}`);
      return false;
    }
  }

  private async ensureBlockedGroup(): Promise<number> {
    const groups = await this.api('/api/groups');
    const existing = (groups?.groups || []).find((g: any) => g.name === BLOCKED_GROUP);
    let id = existing?.id;
    if (id == null) {
      const created = await this.api('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: BLOCKED_GROUP, comment: 'deny-all (ui-admin)', enabled: true }),
      });
      id = created?.groups?.[0]?.id ?? created?.id;
    }
    // ensure a deny-all regex belongs to that group
    await this.api('/api/domains/deny/regex', {
      method: 'POST',
      body: JSON.stringify({ domain: '(.|^).*$', comment: 'deny-all (ui-admin)', groups: [id], enabled: true }),
    }).catch(() => undefined);
    return id;
  }
}
