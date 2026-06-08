import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthenticationError } from '../../shared/exceptions/errors';
import { UserEntity } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validate(username: string, password: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new AuthenticationError();
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new AuthenticationError();
    return { user, accessToken: this.signAccessToken(user) };
  }

  private signAccessToken(user: UserEntity): string {
    return this.jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      {
        secret: this.config.get<string>('app.jwtSecret'),
        expiresIn: this.config.get<string>('app.jwtAccessExpiry', '12h'),
      } as any,
    );
  }
}
