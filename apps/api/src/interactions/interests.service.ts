import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { profileCode } from '../domain/matching';
import { PLANS } from '../domain/plans';
import { MembershipService } from '../membership/membership.service';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { containsContactDetails, ProfilesService } from '../profiles/profiles.service';

/** Interest rules, shared by the website and the WhatsApp assistant. */
@Injectable()
export class InterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly membership: MembershipService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Send an interest. If they already sent one to me, this accepts theirs instead. */
  async send(userId: string, profileId: string, message?: string) {
    const me = await this.profiles.approvedProfile(userId);
    const target = await this.prisma.profile.findFirst({
      where: { AND: [{ id: profileId }, this.profiles.discoverableWhere(me)] },
    });
    if (!target) throw new NotFoundException('Profile not found');
    if (message && containsContactDetails(message)) {
      throw new BadRequestException('Please do not share phone numbers or emails in the message.');
    }

    // They already sent me one: sending back means yes.
    const theirs = await this.prisma.interest.findUnique({
      where: { senderId_receiverId: { senderId: target.id, receiverId: me.id } },
    });
    if (theirs?.status === 'PENDING') return this.respond(userId, theirs.id, 'ACCEPTED');
    if (theirs?.status === 'ACCEPTED') throw new ConflictException('You are already connected');

    const existing = await this.prisma.interest.findUnique({
      where: { senderId_receiverId: { senderId: me.id, receiverId: target.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') throw new ConflictException('You have already sent an interest');

    const tier = await this.membership.tier(userId);
    const limit = PLANS[tier].dailyInterestLimit;
    if (limit != null && (await this.membership.interestsSentToday(me.id)) >= limit) {
      throw new HttpException(
        `Free members can send ${limit} interests a day. Upgrade to Premium for unlimited interests.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const interest = existing
      ? await this.prisma.interest.update({
          where: { id: existing.id },
          data: { status: 'PENDING', message, createdAt: new Date(), respondedAt: null },
        })
      : await this.prisma.interest.create({ data: { senderId: me.id, receiverId: target.id, message } });

    await this.notifications.notify({
      userId: target.userId,
      type: 'INTEREST_RECEIVED',
      title: 'New interest received',
      body: `${me.firstName ?? 'A member'} (${profileCode(me.seq)}) is interested in your profile.`,
      link: `/inbox?box=received`,
      interestId: interest.id,
    });
    return { id: interest.id, status: interest.status };
  }

  async respond(userId: string, id: string, status: 'ACCEPTED' | 'DECLINED') {
    const me = await this.profiles.approvedProfile(userId);
    const interest = await this.prisma.interest.findUnique({ where: { id }, include: { sender: true } });
    if (!interest || interest.receiverId !== me.id) throw new NotFoundException();
    if (interest.status !== 'PENDING' && !(interest.status === 'DECLINED' && status === 'ACCEPTED')) {
      throw new ConflictException('This interest has already been answered');
    }
    const updated = await this.prisma.interest.update({ where: { id }, data: { status, respondedAt: new Date() } });
    if (status === 'ACCEPTED') {
      await this.notifications.notify({
        userId: interest.sender.userId,
        type: 'INTEREST_ACCEPTED',
        title: 'Interest accepted',
        body: `${me.firstName ?? 'A member'} (${profileCode(me.seq)}) accepted your interest.`,
        link: `/profile/${profileCode(me.seq)}`,
      });
    }
    return { id: updated.id, status: updated.status };
  }
}
