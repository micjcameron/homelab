import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './guards/auth.decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  // Brute-force gate: 5 attempts / 15 min / IP (ttl in ms for @nestjs/throttler v6)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const { user, accessToken } = await this.auth.validate(
      dto.username,
      dto.password,
    );
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      // LAN access is plain HTTP, so default to non-secure. Set COOKIE_SECURE=true
      // once the app is only reached over HTTPS (e.g. behind Cloudflare).
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({
      accessToken,
      user: { username: user.username, role: user.role },
    });
  }

  @Get('me')
  me(@Req() req: Request) {
    return { user: req.user };
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return res.json({ ok: true });
  }
}
