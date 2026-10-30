import { Controller, ForbiddenException, Get, HttpException, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { Prisma, Profile, User } from '@prisma/client';
import { CurrentUser } from '../common/auth';
import { profileCode } from '../domain/matching';
import { MembershipService } from '../membership/membership.service';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { acceptedConnections, approvedPhotos, toCard } from '../profiles/presenter';
import { ProfilesService } from '../profiles/profiles.service';

type WithUser = Profile & { user: User };

/** 919876543210 → "+91 98765 43210" */
function formatPhone(phone: string) {
  const local = phone.slice(-10);
  return `+${phone.slice(0, -10)} ${local.slice(0, 5)} ${local.slice(5)}`;
}

function contactOf(p: WithUser) {
  return {
    name: [p.firstName, p.lastName].filter(Boolean).join(' '),
    phone: formatPhone(p.user.phone),
    email: p.user.email,
    createdFor: p.createdFor,
  };
}

/**
 * Weekly contact unlocks.
 * Free: 1 per week (4/month). Premium: 4 per week (16/month).
 * Weeks start on the signup date (free) or payment date (premium). Unused unlocks expire.
 */
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly membership: MembershipService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('quota')
  quota(@CurrentUser() user: User) {
    return this.membership.contactQuota(user.id);
  }

  @Get()
  async list(@CurrentUser() user: User) {
    const me = await this.profiles.ownProfile(user.id);
    const viewer = await this.profiles.viewer(user.id, me);
    const rows = await this.prisma.contactUnlock.findMany({
      where: { ownerId: me.id },
      include: { target: { include: { ...approvedPhotos, user: true } } },
      orderBy: { unlockedAt: 'desc' },
    });
    const accepted = await acceptedConnections(this.prisma, me.id, rows.map((r) => r.targetId));
    return {
      quota: await this.membership.contactQuota(user.id),
      items: rows.map((r) => ({
        unlockedAt: r.unlockedAt,
        profile: toCard(r.target, viewer, accepted.has(r.targetId)),
        contact: r.target.user.status === 'ACTIVE' ? contactOf(r.target) : null,
      })),
    };
  }

  /** Returns contact details if already unlocked (free), otherwise null. Never spends a credit. */
  @Get(':profileId')
  async get(@CurrentUser() user: User, @Param('profileId') profileId: string) {
    const me = await this.profiles.ownProfile(user.id);
    const unlock = await this.prisma.contactUnlock.findUnique({
      where: { ownerId_targetId: { ownerId: me.id, targetId: profileId } },
      include: { target: { include: { user: true } } },
    });
    return { unlocked: !!unlock, contact: unlock ? contactOf(unlock.target) : null };
  }

  @Post(':profileId/unlock')
  async unlock(@CurrentUser() user: User, @Param('profileId') profileId: string) {
    const me = await this.profiles.approvedProfile(user.id);
    const target = await this.prisma.profile.findFirst({
      where: { AND: [{ id: profileId }, this.profiles.discoverableWhere(me)] },
      include: { user: true },
    });
    if (!target) throw new NotFoundException('Profile not found');

    const already = await this.prisma.contactUnlock.findUnique({
      where: { ownerId_targetId: { ownerId: me.id, targetId: target.id } },
    });
    if (already) return { unlocked: true, contact: contactOf(target), quota: await this.membership.contactQuota(user.id) };

    if (target.contactVisibility === 'AFTER_ACCEPT') {
      const accepted = (await acceptedConnections(this.prisma, me.id, [target.id])).has(target.id);
      if (!accepted) {
        throw new ForbiddenException('This member shares contact details only after an interest is accepted. Send an interest first.');
      }
    }

    // Serialise unlocks per member so two quick clicks can't exceed the weekly limit.
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${me.id}))`);
        const quota = await this.membership.contactQuota(user.id);
        const used = await tx.contactUnlock.count({
          where: { ownerId: me.id, unlockedAt: { gte: quota.periodStart, lt: quota.resetsAt } },
        });
        if (used >= quota.limit) {
          const msg =
            quota.tier === 'FREE'
              ? 'You have used this week’s free contact unlock. Upgrade to Premium for 4 unlocks every week.'
              : 'You have used all 4 contact unlocks for this week.';
          throw new HttpException({ message: msg, resetsAt: quota.resetsAt, tier: quota.tier }, HttpStatus.TOO_MANY_REQUESTS);
        }
        await tx.contactUnlock.create({ data: { ownerId: me.id, targetId: target.id } });
      },
      { timeout: 10_000 },
    );

    await this.notifications.notify({
      userId: target.userId,
      type: 'CONTACT_VIEWED',
      title: 'Someone viewed your contact details',
      body: `${me.firstName ?? 'A member'} (${profileCode(me.seq)}) viewed your contact details.`,
      link: `/profile/${profileCode(me.seq)}`,
    });
    return { unlocked: true, contact: contactOf(target), quota: await this.membership.contactQuota(user.id) };
  }
}
