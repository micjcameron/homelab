import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramApi } from './telegram.api';
import { TelegramCommandService } from './telegram.command.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Long-poll loop (polling mode). Outbound only — no public URL. Reacts to a
 * message the instant Telegram returns it. Webhook mode (Phase 4) bypasses this
 * and feeds updates via an HTTP controller instead.
 */
@Injectable()
export class TelegramPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollerService.name);
  private offset = 0;
  private stopped = false;
  private controller?: AbortController;

  constructor(
    private readonly config: ConfigService,
    private readonly api: TelegramApi,
    private readonly commands: TelegramCommandService,
  ) {}

  async onModuleInit() {
    const enabled = this.config.get<boolean>('app.telegramEnabled');
    const mode = this.config.get<string>('app.telegramMode');
    if (!enabled) {
      this.logger.warn('Telegram disabled (no bot token / chat id).');
      return;
    }
    if (mode !== 'polling') {
      this.logger.log(`Telegram mode=${mode} — poller not started.`);
      return;
    }

    // Skip any backlog so we don't replay old commands after a restart.
    try {
      const pending = await this.api.getUpdates(-1, 0);
      if (pending.length) this.offset = pending[pending.length - 1].update_id + 1;
    } catch {
      /* ignore — first loop iteration will retry */
    }

    const chatId = this.config.get<string>('app.telegramChatId', '');
    await this.api.sendMessage(chatId, '🤖 ui-admin online — /help for commands');
    this.logger.log('Telegram poller started (polling mode).');
    void this.loop();
  }

  onModuleDestroy() {
    this.stopped = true;
    this.controller?.abort();
  }

  private async loop() {
    let backoff = 1000;
    while (!this.stopped) {
      try {
        this.controller = new AbortController();
        const updates = await this.api.getUpdates(this.offset, 30, this.controller.signal);
        backoff = 1000;
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.commands.handle(u);
        }
      } catch (e: any) {
        if (this.stopped) break;
        this.logger.warn(`poll error: ${e?.message ?? e} — retrying in ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 15000);
      }
    }
  }
}
