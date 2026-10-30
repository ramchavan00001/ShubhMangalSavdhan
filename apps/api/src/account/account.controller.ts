import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Injectable, Logger, Module, OnModuleInit, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { IsBoolean, IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { createTransport, Transporter } from 'nodemailer';
import { CurrentUser } from '../common/auth';
import { APP_CONFIG, AppConfig } from '../config';
import { NotificationsService, NotifyInput } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';

const CODE_TTL_MS = 15 * 60 * 1000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Sends email. In test mode (EMAIL_PROVIDER=console) emails are printed to the API log. */
@Injectable()
export class EmailService {
  private readonly log = new Logger('Email');
  private transport: Transporter | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async send(to: string, subject: string, text: string, html?: string) {
    const e = this.config.email;
    if (e.provider === 'console') {
      this.log.log(`[TEST] → ${to} | ${subject}\n${text}`);
      return;
    }
    this.transport ??= createTransport({ host: e.host, port: e.port, secure: e.port === 465, auth: { user: e.user, pass: e.pass } });
    await this.transport.sendMail({ from: e.from, to, subject, text, html });
  }

  /** Simple branded HTML around a message. */
  layout(title: string, body: string, link: string | null, webUrl: string) {
    const button = link
      ? `<p style="margin:24px 0"><a href="${esc(link)}" style="background:#5B0F1E;color:#FBF6EC;padding:12px 22px;text-decoration:none;font-weight:bold">Open</a></p>`
      : '';
    return `<div style="font-family:Arial,sans-serif;color:#2B1A14;max-width:560px;margin:auto">
<div style="background:#3E0913;color:#F3E3BC;padding:16px 20px;font-size:20px;font-family:Georgia,serif">Shubh Mangal Savdhan</div>
<div style="padding:20px;background:#FBF6EC"><h2 style="color:#5B0F1E;font-family:Georgia,serif;margin-top:0">${esc(title)}</h2><p>${esc(body)}</p>${button}
<p style="font-size:12px;color:#6B5A50">You get these emails because you turned them on. <a href="${esc(webUrl)}/settings" style="color:#7A5C17">Change email settings</a></p></div></div>`;
  }
}

class EmailDto {
  @IsEmail() @MaxLength(120) email: string;
}
class CodeDto {
  @IsString() @Length(6, 6) code: string;
}
class SettingsDto {
  @IsBoolean() notifyByEmail: boolean;
}

/** Email address (verified by code) and email-notification preference. */
@Controller('account')
export class AccountController implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    this.notifications.registerChannel('email', (n) => this.onNotification(n));
  }

  private hash(userId: string, code: string) {
    return createHmac('sha256', this.config.jwtSecret).update(`email:${userId}:${code}`).digest('hex');
  }

  private async onNotification(n: NotifyInput) {
    const u = await this.prisma.user.findUnique({ where: { id: n.userId } });
    if (!u?.email || !u.emailVerifiedAt || !u.notifyByEmail || u.status !== 'ACTIVE') return;
    const link = n.link ? `${this.config.webUrl}${n.link}` : null;
    await this.email.send(u.email, n.title, `${n.body}${link ? `\n\n${link}` : ''}\n\nChange email settings: ${this.config.webUrl}/settings`, this.email.layout(n.title, n.body, link, this.config.webUrl));
  }

  @Get('notification-settings')
  async settings(@CurrentUser() user: User) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return {
      email: u.emailVerifiedAt ? u.email : null,
      pendingEmail: u.pendingEmail && u.emailCodeExpiresAt && u.emailCodeExpiresAt > new Date() ? u.pendingEmail : null,
      notifyByEmail: u.notifyByEmail,
      testMode: this.config.email.provider === 'console',
    };
  }

  @Put('notification-settings')
  async update(@CurrentUser() user: User, @Body() dto: SettingsDto) {
    await this.prisma.user.update({ where: { id: user.id }, data: { notifyByEmail: dto.notifyByEmail } });
    await this.prisma.consentLog.create({ data: { userId: user.id, kind: 'EMAIL', granted: dto.notifyByEmail, source: 'WEB_SETTINGS' } });
    return this.settings(user);
  }

  /** Step 1: send a code to the new address. Nothing is emailed there until it's confirmed. */
  @Post('email')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async startEmail(@CurrentUser() user: User, @Body() dto: EmailDto) {
    const email = dto.email.trim().toLowerCase();
    const taken = await this.prisma.user.findFirst({ where: { email, id: { not: user.id } } });
    if (taken) throw new BadRequestException('This email is already used by another account.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: email, emailCodeHash: this.hash(user.id, code), emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.email.send(email, 'Your verification code', `Your Shubh Mangal Savdhan verification code is ${code}. It expires in 15 minutes.`);
    return this.settings(user);
  }

  /** Step 2: confirm the code. */
  @Post('email/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async verifyEmail(@CurrentUser() user: User, @Body() dto: CodeDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!u.pendingEmail || !u.emailCodeHash || !u.emailCodeExpiresAt || u.emailCodeExpiresAt < new Date()) {
      throw new BadRequestException('The code has expired. Please request a new one.');
    }
    const a = Buffer.from(u.emailCodeHash, 'hex');
    const b = Buffer.from(this.hash(user.id, dto.code), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Incorrect code. Please check and try again.');
    const taken = await this.prisma.user.findFirst({ where: { email: u.pendingEmail, id: { not: user.id } } });
    if (taken) throw new BadRequestException('This email is already used by another account.');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { email: u.pendingEmail, emailVerifiedAt: new Date(), pendingEmail: null, emailCodeHash: null, emailCodeExpiresAt: null },
    });
    return this.settings(user);
  }
}

@Module({ controllers: [AccountController], providers: [EmailService] })
export class AccountModule {}
