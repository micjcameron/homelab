import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessGate } from './proxies.types';

const API = 'https://api.cloudflare.com/client/v4';
// Same policy name cf-access.sh uses, so the CLI and UI manage the same gate.
const POLICY_NAME = 'homelab-allowlist';
const CACHE_TTL_MS = 60_000;

interface CfApp {
  id: string;
  name: string;
  domain: string;
}

interface CfPolicy {
  id: string;
  name: string;
  include?: { email?: { email?: string } }[];
}

/**
 * Thin Cloudflare Access client — create/read/delete the email-allowlist gates
 * that sit in front of tunnel hostnames. Mirrors cf-access.sh exactly.
 */
@Injectable()
export class CloudflareAccessService {
  private readonly logger = new Logger(CloudflareAccessService.name);
  private readonly token: string;
  private readonly accountId: string;
  private readonly sessionDuration: string;
  readonly enabled: boolean;

  private cache: { at: number; data: Record<string, AccessGate> } | null = null;

  constructor(config: ConfigService) {
    this.token = config.get<string>('app.cfApiToken') || '';
    this.accountId = config.get<string>('app.cfAccountId') || '';
    this.sessionDuration = config.get<string>('app.cfSessionDuration') || '168h';
    this.enabled = config.get<boolean>('app.cfAccessEnabled') || false;
  }

  private ensureEnabled(): void {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'Cloudflare Access is not configured (set CF_API_TOKEN and CF_ACCOUNT_ID).',
      );
  }

  private async cf<T>(method: string, path: string, body?: unknown): Promise<T> {
    let json: { success?: boolean; result?: T; errors?: { message: string }[] };
    try {
      const res = await fetch(`${API}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      json = await res.json();
    } catch (e) {
      throw new BadGatewayException(`Cloudflare API unreachable: ${String(e)}`);
    }
    if (!json?.success) {
      const msg =
        json?.errors?.map((e) => e.message).join('; ') || 'unknown error';
      this.logger.warn(`CF ${method} ${path} failed: ${msg}`);
      throw new BadGatewayException(`Cloudflare: ${msg}`);
    }
    return json.result as T;
  }

  private apps(): Promise<CfApp[]> {
    return this.cf<CfApp[]>('GET', `accounts/${this.accountId}/access/apps`);
  }

  private async emailsFor(appId: string): Promise<string[]> {
    const policies = await this.cf<CfPolicy[]>(
      'GET',
      `accounts/${this.accountId}/access/apps/${appId}/policies`,
    );
    const emails = new Set<string>();
    for (const p of policies)
      for (const inc of p.include ?? [])
        if (inc.email?.email) emails.add(inc.email.email);
    return [...emails];
  }

  private async appIdFor(hostname: string): Promise<string | null> {
    return (await this.apps()).find((a) => a.domain === hostname)?.id ?? null;
  }

  /** Gate status for many hostnames in one round-trip, cached for CACHE_TTL_MS. */
  async gateMap(hostnames: string[]): Promise<Record<string, AccessGate>> {
    const blank = (): Record<string, AccessGate> =>
      Object.fromEntries(hostnames.map((h) => [h, { enabled: false, emails: [] }]));
    if (!this.enabled) return blank();

    const now = Date.now();
    if (
      this.cache &&
      now - this.cache.at < CACHE_TTL_MS &&
      hostnames.every((h) => h in this.cache!.data)
    ) {
      return this.cache.data;
    }

    let apps: CfApp[];
    try {
      apps = await this.apps();
    } catch (e) {
      // Don't break the proxy health view if Cloudflare is unreachable.
      this.logger.warn(`gateMap fell back to blank: ${String(e)}`);
      return blank();
    }

    const out: Record<string, AccessGate> = {};
    await Promise.all(
      hostnames.map(async (h) => {
        const app = apps.find((a) => a.domain === h);
        out[h] = app
          ? { enabled: true, emails: await this.emailsFor(app.id) }
          : { enabled: false, emails: [] };
      }),
    );
    this.cache = { at: now, data: out };
    return out;
  }

  /** Create or replace the email allowlist gate for a hostname. */
  async gate(hostname: string, emails: string[]): Promise<AccessGate> {
    this.ensureEnabled();
    const clean = [
      ...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    ];
    if (clean.length === 0)
      throw new BadRequestException('At least one email is required.');

    let appId = await this.appIdFor(hostname);
    if (!appId) {
      const app = await this.cf<CfApp>(
        'POST',
        `accounts/${this.accountId}/access/apps`,
        {
          name: `homelab: ${hostname}`,
          domain: hostname,
          type: 'self_hosted',
          session_duration: this.sessionDuration,
          app_launcher_visible: false,
        },
      );
      appId = app.id;
    }

    const policy = {
      name: POLICY_NAME,
      decision: 'allow',
      include: clean.map((email) => ({ email: { email } })),
    };
    const existing = await this.cf<CfPolicy[]>(
      'GET',
      `accounts/${this.accountId}/access/apps/${appId}/policies`,
    );
    const polId = existing.find((p) => p.name === POLICY_NAME)?.id;
    if (polId) {
      await this.cf(
        'PUT',
        `accounts/${this.accountId}/access/apps/${appId}/policies/${polId}`,
        policy,
      );
    } else {
      await this.cf(
        'POST',
        `accounts/${this.accountId}/access/apps/${appId}/policies`,
        policy,
      );
    }

    this.cache = null;
    return { enabled: true, emails: clean };
  }

  /** Remove the gate (hostname becomes public again). */
  async ungate(hostname: string): Promise<AccessGate> {
    this.ensureEnabled();
    const appId = await this.appIdFor(hostname);
    if (appId)
      await this.cf('DELETE', `accounts/${this.accountId}/access/apps/${appId}`);
    this.cache = null;
    return { enabled: false, emails: [] };
  }
}
