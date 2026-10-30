import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config';
import { SessionPayload } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { OtpSender } from './otp-sender';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 5;
const OTP_RESEND_GAP_MS = 30 * 1000;

/** Accepts "9876543210", "+91 98765 43210", "09876543210" → "919876543210". */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local = digits;
  if (digits.length === 12 && digits.startsWith('91')) local = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return `91${local}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sender: OtpSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private hash(phone: string, code: string) {
    return createHmac('sha256', this.config.jwtSecret).update(`${phone}:${code}`).digest('hex');
  }

  async requestOtp(rawPhone: string) {
    const phone = normalizeIndianPhone(rawPhone);
    if (!phone) throw new BadRequestException('Please enter a valid 10-digit Indian mobile number');

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, createdAt: { gte: hourAgo } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent.length >= OTP_MAX_PER_HOUR) {
      throw new HttpException('Too many OTP requests. Please try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < OTP_RESEND_GAP_MS) {
      throw new HttpException('Please wait 30 seconds before requesting another OTP.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.create({
      data: { phone, codeHash: this.hash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    await this.sender.send(phone, code);
    return { phone, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  async verifyOtp(rawPhone: string, code: string): Promise<{ user: User; token: string; isNew: boolean }> {
    const phone = normalizeIndianPhone(rawPhone);
    if (!phone || !/^\d{6}$/.test(code)) throw new BadRequestException('Invalid OTP');

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }
    const expected = Buffer.from(otp.codeHash, 'hex');
    const given = Buffer.from(this.hash(phone, code), 'hex');
    if (!timingSafeEqual(expected, given)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Incorrect OTP. Please check and try again.');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const isAdmin = this.config.adminPhones.includes(phone);
    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNew = !user;
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, role: isAdmin ? 'ADMIN' : 'USER', profile: { create: {} } },
      });
    } else {
      if (user.status === 'BANNED') throw new BadRequestException('This account has been banned.');
      if (user.status === 'DELETED') {
        // A deleted account's phone can sign up again from scratch.
        await this.prisma.user.delete({ where: { id: user.id } });
        user = await this.prisma.user.create({
          data: { phone, role: isAdmin ? 'ADMIN' : 'USER', profile: { create: {} } },
        });
      } else if (isAdmin && user.role !== 'ADMIN') {
        user = await this.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      }
    }
    user = await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });

    const payload: SessionPayload = { sub: user.id, tv: user.tokenVersion };
    const token = await this.jwt.signAsync(payload);
    return { user, token, isNew };
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }
}
