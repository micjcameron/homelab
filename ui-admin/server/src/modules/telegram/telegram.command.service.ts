import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboard, TelegramApi, TgUpdate } from './telegram.api';
import { ServicesService } from '../services/services.service';
import { SystemService } from '../system/system.service';
import { ServiceStatus } from '../services/services.types';
import { NetworkService } from '../network/network.service';

type SvcAction = 'restart' | 'up' | 'down' | 'logs';
const SVC_ACTIONS: SvcAction[] = ['restart', 'up', 'down', 'logs'];
const DEV_ACTIONS = ['approve', 'block', 'ignore'];

/**
 * Parses Telegram commands/taps and dispatches to the SAME service-layer methods
 * the web API uses. Authorized solely by chat_id. A service-requiring command
 * with no argument presents inline buttons (one per service); tapping a button
 * runs it and edits the message in place with the result.
 */
@Injectable()
export class TelegramCommandService {
  private readonly logger = new Logger(TelegramCommandService.name);
  private readonly chatId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly api: TelegramApi,
    private readonly services: ServicesService,
    private readonly system: SystemService,
    @Inject(forwardRef(() => NetworkService))
    private readonly network: NetworkService,
  ) {
    this.chatId = this.config.get<string>('app.telegramChatId', '');
  }

  async handle(update: TgUpdate): Promise<void> {
    if (update.callback_query) return this.handleCallback(update);
    return this.handleMessage(update);
  }

  // ── text commands ────────────────────────────────────────────────────────
  private async handleMessage(update: TgUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text) return;
    if (String(msg.chat.id) !== this.chatId) {
      this.logger.warn(`Ignoring message from unauthorized chat ${msg.chat.id}`);
      return;
    }

    const parts = msg.text.trim().split(/\s+/);
    const command = parts[0].replace(/@.*$/, '').toLowerCase().replace(/^\//, '');
    const arg = parts[1];

    try {
      if (command === 'status') return this.reply(await this.statusReport());
      if (command === 'help' || command === 'start')
        return this.reply(this.helpText());

      if (SVC_ACTIONS.includes(command as SvcAction)) {
        const action = command as SvcAction;
        if (arg) {
          // explicit service name -> run immediately
          const result =
            action === 'logs'
              ? await this.runLogs(arg)
              : await this.runAction(action, arg);
          return this.reply(result);
        }
        // no service -> present buttons
        const kb = await this.buildKeyboard(action);
        if (!kb) return this.reply(`No services available to ${action}.`);
        return this.reply(`Which service to ${action}?`, kb);
      }

      return this.reply(`Unknown command '/${command}'. Try /help`);
    } catch (e: any) {
      await this.reply(`❌ ${e?.message ?? 'command failed'}`);
    }
  }

  // ── button taps ──────────────────────────────────────────────────────────
  private async handleCallback(update: TgUpdate): Promise<void> {
    const cb = update.callback_query!;
    if (!cb.message || String(cb.message.chat.id) !== this.chatId) {
      await this.api.answerCallbackQuery(cb.id);
      return;
    }
    await this.api.answerCallbackQuery(cb.id);

    const [action, ...rest] = (cb.data ?? '').split(':');
    const name = rest.join(':');
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;

    // device approve/block/ignore taps -> NetworkService
    if (DEV_ACTIONS.includes(action) && name) {
      try {
        const result = await this.network.handleCallback(action, name);
        return this.api.editMessageText(chatId, messageId, result);
      } catch (e: any) {
        return this.api.editMessageText(chatId, messageId, `❌ ${e?.message ?? 'failed'}`);
      }
    }

    if (!SVC_ACTIONS.includes(action as SvcAction) || !name) {
      return this.api.editMessageText(chatId, messageId, 'Unknown selection.');
    }

    try {
      await this.api.editMessageText(chatId, messageId, `⏳ ${action} ${name}…`);
      const result =
        action === 'logs'
          ? await this.runLogs(name)
          : await this.runAction(action as Exclude<SvcAction, 'logs'>, name);
      await this.api.editMessageText(chatId, messageId, result);
    } catch (e: any) {
      await this.api.editMessageText(chatId, messageId, `❌ ${e?.message ?? 'failed'}`);
    }
  }

  // ── shared actions (used by both text + buttons) ─────────────────────────
  private async runAction(action: 'restart' | 'up' | 'down', name: string) {
    await this.services[action](name);
    const s = await this.services.getStatus(name);
    return `✅ ${name} ${action} done — now ${s.state}`;
  }

  private async runLogs(name: string) {
    const { logs, source } = await this.services.logs(name, 25);
    const body = logs.trim() || `(no logs — source: ${source})`;
    return `📜 ${name} (last lines, ${source}):\n${body}`;
  }

  // ── keyboard ─────────────────────────────────────────────────────────────
  private async buildKeyboard(action: SvcAction): Promise<InlineKeyboard | null> {
    let services = await this.services.getAllStatus();
    if (action === 'up') services = services.filter((s) => s.state !== 'running');
    if (action === 'down') services = services.filter((s) => s.state === 'running');
    if (!services.length) return null;
    const buttons = services.map((s) => ({
      text: s.name,
      callback_data: `${action}:${s.name}`,
    }));
    // 2 per row
    const rows: InlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    return rows;
  }

  // ── formatting ───────────────────────────────────────────────────────────
  private icon(s: ServiceStatus): string {
    if (!s.present || s.state === 'missing') return '⚪️';
    if (s.state !== 'running') return '❌';
    if (s.health === 'unhealthy' || (s.special && !s.special.ok)) return '⚠️';
    return '✅';
  }

  private async statusReport(): Promise<string> {
    const [services, sys] = await Promise.all([
      this.services.getAllStatus(),
      this.system.getHealth(),
    ]);
    const lines = services.map((s) => {
      const extra =
        s.health === 'healthy'
          ? ' (healthy)'
          : s.special
            ? ` (${s.special.ok ? s.special.detail : '⚠ ' + s.special.detail})`
            : '';
      return `${this.icon(s)} ${s.name} — ${s.state}${extra}`;
    });
    const up = sys.uptimeSeconds ? `${Math.floor(sys.uptimeSeconds / 3600)}h` : '—';
    const sysline = `🌡 ${sys.tempC ?? '—'}°C  ⚙️ ${sys.load1 ?? '—'}  🧠 ${sys.memory?.usedPct ?? '—'}%  💾 ${sys.disk?.usedPct ?? '—'}%  ⏱ ${up}`;
    return `🖥 Homelab status\n\n${lines.join('\n')}\n\n${sysline}`;
  }

  private helpText(): string {
    return [
      '🤖 Homelab admin commands:',
      '',
      '/status — services + system health',
      '/restart — restart a service',
      '/up — bring a service up',
      '/down — take a service down',
      '/logs — view a service’s logs',
      '/help — this message',
      '',
      'Tip: send a command on its own to pick from buttons,',
      'or name the service directly, e.g. /restart node-red',
    ].join('\n');
  }

  private reply(text: string, keyboard?: InlineKeyboard): Promise<void> {
    return this.api.sendMessage(this.chatId, text, keyboard);
  }
}
