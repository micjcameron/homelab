import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';
import { UpdateCloudflareDto } from './settings.dto';
import { verifyCloudflareCreds } from './cloudflare-verify';

export const CF_TOKEN_KEY = 'cf_api_token';
export const CF_ACCOUNT_KEY = 'cf_account_id';

function mask(token: string | null): string | null {
  if (!token) return null;
  return token.length <= 12 ? '••••' : `${token.slice(0, 5)}••••${token.slice(-6)}`;
}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /** Effective creds: DB setting wins, env is the fallback/bootstrap. */
  private async effective() {
    const dbToken = await this.settings.getSecret(CF_TOKEN_KEY);
    const dbAccount = await this.settings.getSecret(CF_ACCOUNT_KEY);
    const envToken = this.config.get<string>('app.cfApiToken') || '';
    const envAccount = this.config.get<string>('app.cfAccountId') || '';
    return {
      token: dbToken || envToken || '',
      accountId: dbAccount || envAccount || '',
      source: dbToken ? 'db' : envToken ? 'env' : 'none',
    };
  }

  @Get('cloudflare')
  async getCloudflare() {
    const e = await this.effective();
    return {
      configured: !!(e.token && e.accountId),
      source: e.source,
      tokenPreview: mask(e.token || null),
      accountId: e.accountId || null,
    };
  }

  @Put('cloudflare')
  async updateCloudflare(@Body() dto: UpdateCloudflareDto) {
    if (!dto.token && !dto.accountId)
      throw new BadRequestException('Provide a new token and/or account ID.');

    const cur = await this.effective();
    const token = dto.token ?? cur.token;
    const accountId = dto.accountId ?? cur.accountId;
    if (!token || !accountId)
      throw new BadRequestException('Both an API token and an account ID are required.');

    const check = await verifyCloudflareCreds(token, accountId);
    if (!check.ok) throw new BadRequestException(check.message);

    if (dto.token) await this.settings.setSecret(CF_TOKEN_KEY, dto.token);
    if (dto.accountId) await this.settings.setSecret(CF_ACCOUNT_KEY, dto.accountId);
    return this.getCloudflare();
  }

  @Post('cloudflare/test')
  async testCloudflare() {
    const e = await this.effective();
    if (!e.token || !e.accountId) return { ok: false, message: 'Not configured yet.' };
    return verifyCloudflareCreds(e.token, e.accountId);
  }
}
