import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Global,
  Headers,
  HttpCode,
  Inject,
  Module,
  NotFoundException,
  Post,
  Put,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeIndianPhone } from '../auth/auth.service';
import { CurrentUser, Public, Roles } from '../common/auth';
import { APP_CONFIG, AppConfig } from '../config';
import { InteractionsModule } from '../interactions/interactions.module';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSender } from './sender';
import { WhatsAppService } from './whatsapp.service';

class PreferencesDto {
  @IsOptional() @IsBoolean() digest?: boolean;
  @IsOptional() @IsBoolean() shareProfile?: boolean;
  @IsOptional() @IsBoolean() alerts?: boolean;
  @IsOptional() @IsIn(['WEB_SETTINGS', 'ONBOARDING']) source?: string;
}

class SimulateDto {
  @IsString() @Length(10, 16) phone: string;
  @IsString() @Length(1, 1000) text: string;
}

class LogQuery {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

interface MetaWebhook {
  entry?: { changes?: { value?: { messages?: { from: string; id: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string } } }[] } }[] }[];
}

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('preferences')
  preferences(@CurrentUser() user: User) {
    return this.whatsapp.preferences(user.id);
  }

  /** Each switch starts OFF; only the member turns them on. Every change is logged as consent. */
  @Put('preferences')
  update(@CurrentUser() user: User, @Body() dto: PreferencesDto) {
    return this.whatsapp.setConsent(
      user.id,
      { WHATSAPP_DIGEST: dto.digest, WHATSAPP_SHARE_PROFILE: dto.shareProfile, WHATSAPP_ALERTS: dto.alerts },
      dto.source ?? 'WEB_SETTINGS',
    );
  }

  /** Meta's one-time webhook verification handshake. */
  @Public()
  @SkipThrottle()
  @Get('webhook')
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode === 'subscribe' && this.config.whatsapp.verifyToken && token === this.config.whatsapp.verifyToken) return challenge;
    throw new ForbiddenException();
  }

  /** Incoming WhatsApp messages from Meta. The signature proves the call came from Meta. */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string) {
    const secret = this.config.whatsapp.appSecret;
    if (!secret || !req.rawBody || !signature?.startsWith('sha256=')) throw new BadRequestException();
    const expected = Buffer.from(createHmac('sha256', secret).update(req.rawBody).digest('hex'), 'hex');
    const given = Buffer.from(signature.slice(7), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new BadRequestException('Bad signature');

    const body = JSON.parse(req.rawBody.toString('utf8')) as MetaWebhook;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title;
          if (text) await this.whatsapp.handleInbound(m.from, text, m.id);
        }
      }
    }
    return { ok: true };
  }
}

@Roles('ADMIN')
@Controller('admin/whatsapp')
export class WhatsAppAdminController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly sender: WhatsAppSender,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  async stats() {
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [digest, share, alerts, pending, sentToday, receivedToday, failedToday] = await Promise.all([
      this.prisma.user.count({ where: { whatsappDigest: true } }),
      this.prisma.user.count({ where: { whatsappShareProfile: true } }),
      this.prisma.user.count({ where: { whatsappAlerts: true } }),
      this.prisma.digestItem.count({ where: { digestId: null } }),
      this.prisma.whatsAppMessage.count({ where: { direction: 'OUT', status: { in: ['SENT', 'LOGGED'] }, createdAt: { gte: day } } }),
      this.prisma.whatsAppMessage.count({ where: { direction: 'IN', createdAt: { gte: day } } }),
      this.prisma.whatsAppMessage.count({ where: { status: 'FAILED', createdAt: { gte: day } } }),
    ]);
    return { testMode: this.sender.testMode, optedIn: { digest, shareProfile: share, alerts }, pendingMatches: pending, last24h: { sent: sentToday, received: receivedToday, failed: failedToday } };
  }

  @Get('messages')
  async messages(@Query() q: LogQuery) {
    const page = q.page ?? 1;
    const phone = q.phone ? normalizeIndianPhone(q.phone) : null;
    const where = phone ? { phone } : {};
    const [total, items] = await Promise.all([
      this.prisma.whatsAppMessage.count({ where }),
      this.prisma.whatsAppMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
    ]);
    return { total, page, pageSize: 50, items };
  }

  /** Sends today's digests now instead of waiting for 9:00 IST. */
  @Post('run-digest')
  @HttpCode(200)
  runDigest() {
    return this.whatsapp.runDailyDigests();
  }

  /** Test mode only: pretend a member sent this WhatsApp message, and return our replies. */
  @Post('simulate')
  @HttpCode(200)
  async simulate(@Body() dto: SimulateDto) {
    if (!this.sender.testMode) throw new NotFoundException('The test chat is only available in test mode');
    const phone = normalizeIndianPhone(dto.phone);
    if (!phone) throw new BadRequestException('Enter a valid mobile number');
    const since = new Date();
    await this.whatsapp.handleInbound(phone, dto.text);
    return this.prisma.whatsAppMessage.findMany({ where: { phone, direction: 'OUT', createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } });
  }
}

@Global()
@Module({
  imports: [InteractionsModule],
  controllers: [WhatsAppController, WhatsAppAdminController],
  providers: [WhatsAppService, WhatsAppSender],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
