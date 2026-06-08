import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceRepository } from './device.repository';
import { PiholeClient } from './pihole.client';
import { DeviceEntity } from './device.entity';
import { DeviceStatus, DiscoveredDevice } from './network.types';
import { TelegramApi, InlineKeyboard } from '../telegram/telegram.api';

@Injectable()
export class NetworkService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NetworkService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly chatId: string;
  private readonly routerIp: string;

  constructor(
    private readonly config: ConfigService,
    private readonly devices: DeviceRepository,
    private readonly pihole: PiholeClient,
    @Inject(forwardRef(() => TelegramApi))
    private readonly telegram: TelegramApi,
  ) {
    this.enabled = this.config.get<boolean>('app.networkWatchEnabled', false);
    this.intervalMs = this.config.get<number>('app.networkWatchIntervalMs', 300_000);
    this.chatId = this.config.get<string>('app.telegramChatId', '');
    this.routerIp = this.config.get<string>('app.routerIp', '192.168.1.1');
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Network watcher disabled (no PIHOLE_PASSWORD).');
      return;
    }
    // initial sync (baseline on first ever run), then poll
    await this.sync().catch((e) => this.logger.warn(`initial sync failed: ${e}`));
    this.timer = setInterval(
      () => this.sync().catch((e) => this.logger.warn(`sync failed: ${e}`)),
      this.intervalMs,
    );
    this.logger.log(`Network watcher started (every ${this.intervalMs / 1000}s).`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  list(): Promise<DeviceEntity[]> {
    return this.devices.findAll();
  }

  /** Rich detail for one device: our record + raw Pi-hole fields + top domains. */
  async detail(mac: string) {
    const device = await this.devices.findByMac(mac);
    let pihole: any = null;
    let topDomains: { domain: string; count: number }[] = [];
    try {
      const raw = await this.pihole.getRawDevice(mac);
      if (raw) {
        pihole = {
          interface: raw.interface ?? null,
          firstSeen: raw.firstSeen ?? null,
          lastQuery: raw.lastQuery ?? null,
          numQueries: raw.numQueries ?? null,
          vendor: raw.macVendor ?? null,
          ips: (raw.ips ?? []).map((x: any) => ({
            ip: x.ip,
            name: x.name,
            lastSeen: x.lastSeen,
          })),
        };
      }
      const ip = device?.ip ?? raw?.ips?.[0]?.ip ?? null;
      if (ip) topDomains = await this.pihole.getTopDomains(ip);
    } catch (e) {
      this.logger.warn(`detail(${mac}) enrichment failed: ${String(e)}`);
    }
    return { device, pihole, topDomains };
  }

  async sync(): Promise<void> {
    const discovered = await this.pihole.getDevices();
    const baseline = (await this.devices.count()) === 0;
    if (baseline)
      this.logger.log(`Baseline: seeding ${discovered.length} known devices as approved.`);

    for (const d of discovered) {
      const existing = await this.devices.findByMac(d.mac);
      if (existing) {
        existing.ip = d.ip;
        existing.hostname = d.hostname ?? existing.hostname;
        existing.vendor = d.vendor ?? existing.vendor;
        existing.lastSeen = d.lastSeen ? new Date(d.lastSeen * 1000) : new Date();
        await this.devices.save(existing);
        continue;
      }
      const status = baseline ? DeviceStatus.APPROVED : DeviceStatus.PENDING;
      const dev = await this.devices.save({
        mac: d.mac,
        vendor: d.vendor,
        ip: d.ip,
        hostname: d.hostname,
        status,
        lastSeen: d.lastSeen ? new Date(d.lastSeen * 1000) : new Date(),
        approvedAt: status === DeviceStatus.APPROVED ? new Date() : null,
      });
      if (status === DeviceStatus.PENDING) await this.alertNewDevice(dev);
    }
  }

  async approve(mac: string, preferredName?: string): Promise<DeviceEntity> {
    const dev = await this.devices.findByMac(mac);
    if (!dev) throw new Error(`device ${mac} not found`);
    dev.status = DeviceStatus.APPROVED;
    dev.approvedAt = new Date();
    if (preferredName !== undefined)
      dev.preferredName = preferredName.trim() || null;
    await this.devices.save(dev);
    await this.pihole.unblockClient(mac).catch(() => undefined);
    return dev;
  }

  async rename(mac: string, preferredName: string): Promise<DeviceEntity> {
    const dev = await this.devices.findByMac(mac);
    if (!dev) throw new Error(`device ${mac} not found`);
    dev.preferredName = preferredName.trim() || null;
    return this.devices.save(dev);
  }

  async block(mac: string): Promise<DeviceEntity> {
    const dev = await this.devices.setStatus(mac, DeviceStatus.BLOCKED);
    const ok = await this.pihole.blockClient(mac);
    await this.notify(
      `⛔ Blocked ${this.label(dev)}\n${ok ? 'Pi-hole DNS block applied.' : '⚠ Pi-hole block failed (check logs).'}\nFor a hard block, also block MAC ${mac} at your router (${this.routerIp}).`,
    );
    return dev;
  }

  /** Telegram inline-button callbacks: approve / block / ignore. */
  async handleCallback(action: string, mac: string): Promise<string> {
    const dev = await this.devices.findByMac(mac);
    const name = dev ? this.label(dev) : mac;
    if (action === 'approve') {
      await this.approve(mac);
      return `✅ Approved ${name}`;
    }
    if (action === 'block') {
      await this.block(mac);
      return `⛔ Blocked ${name}`;
    }
    if (action === 'ignore') {
      return `💤 Ignored ${name} (stays pending)`;
    }
    return `Unknown action ${action}`;
  }

  private label(d: {
    preferredName?: string | null;
    hostname: string | null;
    vendor: string | null;
    mac: string;
  }) {
    return d.preferredName || d.hostname || d.vendor || d.mac;
  }

  private async alertNewDevice(dev: DeviceEntity) {
    const text = [
      '🆕 New device on your network',
      `Vendor: ${dev.vendor ?? '—'}`,
      `Host: ${dev.hostname ?? '—'}`,
      `IP: ${dev.ip ?? '—'}`,
      `MAC: ${dev.mac}`,
    ].join('\n');
    const keyboard: InlineKeyboard = [
      [
        { text: '✅ Approve', callback_data: `approve:${dev.mac}` },
        { text: '⛔ Block', callback_data: `block:${dev.mac}` },
      ],
      [{ text: '💤 Ignore', callback_data: `ignore:${dev.mac}` }],
    ];
    await this.telegram.sendMessage(this.chatId, text, keyboard);
  }

  private notify(text: string) {
    return this.telegram.sendMessage(this.chatId, text);
  }
}
