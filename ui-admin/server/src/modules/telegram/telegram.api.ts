import { Injectable, Logger } from '@nestjs/common';

export interface TgChat {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: TgChat;
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number };
    message?: { message_id: number; chat: TgChat };
  };
}

export interface InlineButton {
  text: string;
  callback_data: string;
}
export type InlineKeyboard = InlineButton[][];

/**
 * Thin Telegram Bot API client (send/edit messages, inline keyboards,
 * callback answers, long-poll getUpdates). Uses Node 20's global fetch.
 */
@Injectable()
export class TelegramApi {
  private readonly logger = new Logger(TelegramApi.name);

  constructor(private readonly token: string) {}

  private base() {
    return `https://api.telegram.org/bot${this.token}`;
  }

  private async call(method: string, payload: Record<string, unknown>) {
    try {
      await fetch(`${this.base()}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      this.logger.warn(`${method} failed: ${String(e)}`);
    }
  }

  private clamp(text: string): string {
    return text.length > 4096 ? text.slice(0, 4090) + '\n…' : text;
  }

  sendMessage(
    chatId: string | number,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    return this.call('sendMessage', {
      chat_id: chatId,
      text: this.clamp(text),
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: this.clamp(text),
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    });
  }

  answerCallbackQuery(callbackId: string, text?: string): Promise<void> {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackId,
      ...(text ? { text } : {}),
    });
  }

  async getUpdates(offset: number, timeout = 30, signal?: AbortSignal): Promise<TgUpdate[]> {
    const url = `${this.base()}/getUpdates?timeout=${timeout}&offset=${offset}&allowed_updates=["message","callback_query"]`;
    const res = await fetch(url, { signal });
    const data = (await res.json()) as { ok: boolean; result: TgUpdate[] };
    return data.ok ? data.result : [];
  }
}
