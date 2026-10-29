import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { IsString, Length } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Public, SESSION_COOKIE } from '../common/auth';
import { APP_CONFIG, AppConfig } from '../config';
import { MembershipService } from '../membership/membership.service';
import { AuthService } from './auth.service';

class RequestOtpDto {
  @IsString()
  @Length(10, 16)
  phone: string;
}

class VerifyOtpDto extends RequestOtpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

const SESSION_DAYS = 30;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly membership: MembershipService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto) {
    const { expiresInSeconds } = await this.auth.requestOtp(dto.phone);
    return { sent: true, expiresInSeconds, devMode: this.config.otp.provider === 'console' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { user, token, isNew } = await this.auth.verifyOtp(dto.phone, dto.code);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProd,
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return { isNew, me: await this.membership.me(user.id) };
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.membership.me(user.id);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAllDevices(user.id);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }
}
