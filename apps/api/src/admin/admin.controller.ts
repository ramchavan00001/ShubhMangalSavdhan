import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { MasterType, Prisma, ReportStatus, User, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser, Roles } from '../common/auth';
import { ageOn } from '../domain/age';
import { profileCode } from '../domain/matching';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

const PAGE = 25;

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
class UsersQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsIn(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']) profileStatus?: string;
}
class RejectDto {
  @IsString() @MaxLength(300) reason: string;
}
class StatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'BANNED']) status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
}
class ReportsQuery extends PageQuery {
  @IsOptional() @IsEnum(ReportStatus) status?: ReportStatus;
}
class ResolveReportDto {
  @IsEnum(ReportStatus) status: ReportStatus;
  @IsOptional() @IsString() @MaxLength(1000) adminNote?: string;
}
class ExtendDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(366) days: number;
  @IsString() @MaxLength(200) note: string;
}
class MasterDto {
  @IsEnum(MasterType) type: MasterType;
  @IsString() @MaxLength(80) value: string;
  @IsOptional() @IsString() @MaxLength(80) parent?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}
class MasterPatchDto {
  @IsOptional() @IsString() @MaxLength(80) value?: string;
  @IsOptional() @IsString() @MaxLength(80) parent?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

const fullName = (p: { firstName: string | null; lastName: string | null } | null) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(' ') || '—';

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [users, today, thisWeek, active7d, premium, pending, pendingPhotos, openReports, revenueMonth, revenueTotal] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'USER' } }),
        this.prisma.user.count({ where: { role: 'USER', createdAt: { gte: day } } }),
        this.prisma.user.count({ where: { role: 'USER', createdAt: { gte: week } } }),
        this.prisma.user.count({ where: { role: 'USER', lastActiveAt: { gte: week } } }),
        this.prisma.subscription.findMany({
          where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.profile.count({ where: { status: 'PENDING' } }),
        this.prisma.photo.count({ where: { status: 'PENDING', profile: { status: 'APPROVED' } } }),
        this.prisma.report.count({ where: { status: 'OPEN' } }),
        this.prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: monthStart } }, _sum: { totalPaise: true, basePaise: true } }),
        this.prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { totalPaise: true, basePaise: true } }),
      ]);
    return {
      users,
      signupsToday: today,
      signupsThisWeek: thisWeek,
      activeLast7Days: active7d,
      premiumMembers: premium.length,
      pendingProfiles: pending,
      pendingPhotos,
      openReports,
      revenueThisMonthPaise: revenueMonth._sum.totalPaise ?? 0,
      netRevenueThisMonthPaise: revenueMonth._sum.basePaise ?? 0,
      revenueTotalPaise: revenueTotal._sum.totalPaise ?? 0,
    };
  }

  // ── Approval queue ──

  @Get('approvals')
  async approvals() {
    const [profiles, photos] = await Promise.all([
      this.prisma.profile.findMany({
        where: { status: 'PENDING' },
        include: { photos: { orderBy: { sortOrder: 'asc' } }, user: { select: { phone: true, createdAt: true } } },
        orderBy: { updatedAt: 'asc' },
        take: 50,
      }),
      this.prisma.photo.findMany({
        where: { status: 'PENDING', profile: { status: 'APPROVED' } },
        include: { profile: { select: { id: true, seq: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    ]);
    return {
      profiles: profiles.map((p) => ({
        ...p,
        code: profileCode(p.seq),
        age: p.dateOfBirth ? ageOn(p.dateOfBirth) : null,
        photos: p.photos.map((ph) => ({ id: ph.id, url: `/photos/${ph.id}`, status: ph.status, isMain: ph.isMain })),
      })),
      photos: photos.map((ph) => ({
        id: ph.id,
        url: `/photos/${ph.id}`,
        profile: { id: ph.profile.id, code: profileCode(ph.profile.seq), name: fullName(ph.profile) },
      })),
    };
  }

  @Post('profiles/:id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string) {
    const p = await this.prisma.profile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.profile.update({ where: { id }, data: { status: 'APPROVED', approvedAt: p.approvedAt ?? new Date(), rejectionReason: null } }),
      // Approving a profile approves its photos still waiting; rejected photos stay rejected.
      this.prisma.photo.updateMany({ where: { profileId: id, status: 'PENDING' }, data: { status: 'APPROVED' } }),
    ]);
    await this.notifications.notify({
      userId: p.userId,
      type: 'PROFILE_APPROVED',
      title: 'Your profile is live',
      body: 'Your profile has been approved. Start exploring your matches.',
      link: '/matches',
    });
    // First approval only: queue the new member for opted-in matches' WhatsApp digests.
    if (!p.approvedAt) await this.whatsapp.enqueueNewProfile(id);
    return { ok: true };
  }

  @Post('profiles/:id/reject')
  @HttpCode(200)
  async reject(@Param('id') id: string, @Body() dto: RejectDto) {
    const p = await this.prisma.profile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    await this.prisma.profile.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: dto.reason } });
    await this.notifications.notify({
      userId: p.userId,
      type: 'PROFILE_REJECTED',
      title: 'Your profile needs changes',
      body: dto.reason,
      link: '/me',
    });
    return { ok: true };
  }

  @Post('photos/:id/:decision')
  @HttpCode(200)
  async photoDecision(@Param('id') id: string, @Param('decision') decision: string) {
    if (decision !== 'approve' && decision !== 'reject') throw new BadRequestException();
    const photo = await this.prisma.photo.findUnique({ where: { id } });
    if (!photo) throw new NotFoundException();
    await this.prisma.photo.update({ where: { id }, data: { status: decision === 'approve' ? 'APPROVED' : 'REJECTED' } });
    return { ok: true };
  }

  // ── Users ──

  @Get('users')
  async users(@Query() q: UsersQuery) {
    const page = q.page ?? 1;
    const and: Prisma.UserWhereInput[] = [];
    if (q.status) and.push({ status: q.status });
    if (q.profileStatus) and.push({ profile: { status: q.profileStatus as Prisma.EnumProfileStatusFilter['equals'] } });
    if (q.q) {
      const term = q.q.trim();
      const digits = term.replace(/\D/g, '');
      const seq = /^sms\d+$/i.test(term) ? Number(term.slice(3)) - 1000000 : null;
      and.push({
        OR: [
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          { email: { contains: term, mode: 'insensitive' } },
          { profile: { firstName: { contains: term, mode: 'insensitive' } } },
          { profile: { lastName: { contains: term, mode: 'insensitive' } } },
          ...(seq && seq > 0 ? [{ profile: { seq } }] : []),
        ],
      });
    }
    const where: Prisma.UserWhereInput = { AND: and };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { profile: true, subscriptions: { where: { status: 'ACTIVE', endsAt: { gt: new Date() } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
      }),
    ]);
    return {
      total,
      page,
      pageSize: PAGE,
      items: rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        premium: u.subscriptions.some((s) => s.startsAt <= new Date()),
        profile: u.profile && {
          id: u.profile.id,
          code: profileCode(u.profile.seq),
          name: fullName(u.profile),
          gender: u.profile.gender,
          city: u.profile.city,
          status: u.profile.status,
        },
      })),
    };
  }

  @Get('users/:id')
  async user(@Param('id') id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            photos: true,
            preference: true,
            reportsReceived: { orderBy: { createdAt: 'desc' }, take: 20 },
            _count: { select: { sentInterests: true, receivedInterests: true, unlocksMade: true } },
          },
        },
        subscriptions: { orderBy: { startsAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!u) throw new NotFoundException();
    return {
      ...u,
      profile: u.profile && {
        ...u.profile,
        code: profileCode(u.profile.seq),
        photos: u.profile.photos.map((ph) => ({ id: ph.id, url: `/photos/${ph.id}`, status: ph.status, isMain: ph.isMain })),
      },
    };
  }

  @Post('users/:id/status')
  @HttpCode(200)
  async setStatus(@CurrentUser() admin: User, @Param('id') id: string, @Body() dto: StatusDto) {
    if (id === admin.id) throw new BadRequestException('You cannot change your own status');
    // Bumping tokenVersion logs a suspended/banned user out everywhere.
    await this.prisma.user.update({
      where: { id },
      data: { status: dto.status, ...(dto.status !== 'ACTIVE' ? { tokenVersion: { increment: 1 } } : {}) },
    });
    return { ok: true };
  }

  @Post('users/:id/extend-premium')
  @HttpCode(200)
  async extend(@Param('id') id: string, @Body() dto: ExtendDto) {
    const now = new Date();
    const latest = await this.prisma.subscription.findFirst({
      where: { userId: id, status: 'ACTIVE', endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
    const startsAt = latest ? latest.endsAt : now;
    const sub = await this.prisma.subscription.create({
      data: { userId: id, startsAt, endsAt: new Date(startsAt.getTime() + dto.days * 24 * 60 * 60 * 1000), note: dto.note },
    });
    return sub;
  }

  // ── Reports ──

  @Get('reports')
  async reports(@Query() q: ReportsQuery) {
    const page = q.page ?? 1;
    const where: Prisma.ReportWhereInput = q.status ? { status: q.status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, seq: true, firstName: true, lastName: true, userId: true } },
          target: { select: { id: true, seq: true, firstName: true, lastName: true, userId: true, _count: { select: { reportsReceived: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
      }),
    ]);
    return {
      total,
      page,
      pageSize: PAGE,
      items: rows.map((r) => ({
        ...r,
        reporter: { ...r.reporter, code: profileCode(r.reporter.seq), name: fullName(r.reporter) },
        target: { ...r.target, code: profileCode(r.target.seq), name: fullName(r.target), totalReports: r.target._count.reportsReceived },
      })),
    };
  }

  @Post('reports/:id')
  @HttpCode(200)
  async resolve(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    await this.prisma.report.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote, resolvedAt: dto.status === 'OPEN' ? null : new Date() },
    });
    return { ok: true };
  }

  // ── Payments ──

  @Get('payments')
  async payments(@Query() q: PageQuery) {
    const page = q.page ?? 1;
    const where: Prisma.PaymentWhereInput = { status: { in: ['PAID', 'REFUNDED', 'FAILED'] } };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: { user: { select: { phone: true, profile: { select: { seq: true, firstName: true, lastName: true } } } }, subscription: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE,
        take: PAGE,
      }),
    ]);
    return {
      total,
      page,
      pageSize: PAGE,
      items: rows.map((p) => ({
        ...p,
        member: { phone: p.user.phone, name: fullName(p.user.profile), code: p.user.profile ? profileCode(p.user.profile.seq) : null },
      })),
    };
  }

  /**
   * Records a refund and ends the Premium it bought. Issue the actual refund from the
   * Razorpay dashboard (automatic refunds via API come later).
   */
  @Post('payments/:id/refund')
  @HttpCode(200)
  async refund(@Param('id') id: string) {
    const p = await this.prisma.payment.findUnique({ where: { id }, include: { subscription: true } });
    if (!p || p.status !== 'PAID') throw new BadRequestException('Only paid payments can be refunded');
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id }, data: { status: 'REFUNDED' } }),
      ...(p.subscription
        ? [this.prisma.subscription.update({ where: { id: p.subscription.id }, data: { status: 'CANCELLED', endsAt: new Date() } })]
        : []),
    ]);
    return { ok: true };
  }

  // ── Master data ──

  @Get('masters')
  masters(@Query('type') type?: MasterType) {
    return this.prisma.masterItem.findMany({
      where: type ? { type } : {},
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { value: 'asc' }],
    });
  }

  @Post('masters')
  async createMaster(@Body() dto: MasterDto) {
    try {
      return await this.prisma.masterItem.create({ data: { ...dto, value: dto.value.trim() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException('This value already exists');
      throw e;
    }
  }

  @Patch('masters/:id')
  updateMaster(@Param('id') id: string, @Body() dto: MasterPatchDto) {
    return this.prisma.masterItem.update({ where: { id }, data: dto });
  }
}
