import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { profileCode, profileCompleteness } from '../domain/matching';
import { PLANS, PlanTier } from '../domain/plans';
import { currentQuotaWindow, startOfIstDay } from '../domain/quota';
import { PrismaService } from '../prisma/prisma.service';

/** Everything about "what plan is this user on and what can they still do". */
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async activeSubscription(userId: string, now = new Date()): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
    });
  }

  async tier(userId: string): Promise<PlanTier> {
    return (await this.activeSubscription(userId)) ? 'PREMIUM' : 'FREE';
  }

  async contactQuota(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
    const active = await this.activeSubscription(userId, now);
    const lastEnded = active
      ? null
      : await this.prisma.subscription.findFirst({
          where: { userId, endsAt: { lte: now } },
          orderBy: { endsAt: 'desc' },
        });
    const window = currentQuotaWindow({ now, signupAt: user.createdAt, subscription: active ?? lastEnded });
    const used = user.profile
      ? await this.prisma.contactUnlock.count({
          where: { ownerId: user.profile.id, unlockedAt: { gte: window.periodStart, lt: window.periodEnd } },
        })
      : 0;
    return {
      tier: window.tier,
      limit: window.limit,
      used,
      remaining: Math.max(0, window.limit - used),
      periodStart: window.periodStart,
      resetsAt: window.periodEnd,
    };
  }

  async interestsSentToday(profileId: string, now = new Date()) {
    return this.prisma.interest.count({ where: { senderId: profileId, createdAt: { gte: startOfIstDay(now) } } });
  }

  /** The session summary the website needs on every page. */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { _count: { select: { photos: true } }, preference: { select: { id: true } } } } },
    });
    if (!user) throw new NotFoundException();
    const sub = await this.activeSubscription(userId);
    const tier: PlanTier = sub ? 'PREMIUM' : 'FREE';
    const p = user.profile;
    const [unread, unreadMessages] = await Promise.all([
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      p ? this.prisma.message.count({ where: { receiverId: p.id, readAt: null } }) : 0,
    ]);
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      plan: { tier, name: PLANS[tier].name, endsAt: sub?.endsAt ?? null },
      unreadNotifications: unread,
      unreadMessages,
      profile: p && {
        id: p.id,
        code: profileCode(p.seq),
        firstName: p.firstName,
        gender: p.gender,
        status: p.status,
        rejectionReason: p.rejectionReason,
        onboardingStep: p.onboardingStep,
        hidden: p.hidden,
        completeness: profileCompleteness(p, p._count.photos, !!p.preference),
      },
    };
  }
}

@Global()
@Module({
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
