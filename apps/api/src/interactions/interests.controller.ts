import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/auth';
import { profileCode } from '../domain/matching';
import { PLANS } from '../domain/plans';
import { MembershipService } from '../membership/membership.service';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { containsContactDetails } from '../profiles/profiles.service';
import { acceptedConnections, approvedPhotos, toCard } from '../profiles/presenter';
import { ProfilesService } from '../profiles/profiles.service';

class SendInterestDto {
  @IsString() profileId: string;
  @IsOptional() @IsString() @MaxLength(300) message?: string;
}

class InboxQuery {
  @IsOptional() @IsIn(['received', 'sent', 'accepted', 'declined']) box?: string;
}

@Controller('interests')
export class InterestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly membership: MembershipService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post()
  async send(@CurrentUser() user: User, @Body() dto: SendInterestDto) {
    const me = await this.profiles.approvedProfile(user.id);
    const target = await this.prisma.profile.findFirst({
      where: { AND: [{ id: dto.profileId }, this.profiles.discoverableWhere(me)] },
    });
    if (!target) throw new NotFoundException('Profile not found');
    if (dto.message && containsContactDetails(dto.message)) {
      throw new BadRequestException('Please do not share phone numbers or emails in the message.');
    }

    // They already sent me one: sending back means yes.
    const theirs = await this.prisma.interest.findUnique({
      where: { senderId_receiverId: { senderId: target.id, receiverId: me.id } },
    });
    if (theirs?.status === 'PENDING') return this.respond(user, theirs.id, 'ACCEPTED');
    if (theirs?.status === 'ACCEPTED') throw new ConflictException('You are already connected');

    const existing = await this.prisma.interest.findUnique({
      where: { senderId_receiverId: { senderId: me.id, receiverId: target.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') throw new ConflictException('You have already sent an interest');

    const tier = await this.membership.tier(user.id);
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
          data: { status: 'PENDING', message: dto.message, createdAt: new Date(), respondedAt: null },
        })
      : await this.prisma.interest.create({ data: { senderId: me.id, receiverId: target.id, message: dto.message } });

    await this.notifications.notify({
      userId: target.userId,
      type: 'INTEREST_RECEIVED',
      title: 'New interest received',
      body: `${me.firstName ?? 'A member'} (${profileCode(me.seq)}) is interested in your profile.`,
      link: `/inbox?box=received`,
    });
    return { id: interest.id, status: interest.status };
  }

  private async respond(user: User, id: string, status: 'ACCEPTED' | 'DECLINED') {
    const me = await this.profiles.approvedProfile(user.id);
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

  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.respond(user, id, 'ACCEPTED');
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.respond(user, id, 'DECLINED');
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  async withdraw(@CurrentUser() user: User, @Param('id') id: string) {
    const me = await this.profiles.ownProfile(user.id);
    const interest = await this.prisma.interest.findUnique({ where: { id } });
    if (!interest || interest.senderId !== me.id) throw new NotFoundException();
    if (interest.status !== 'PENDING') throw new ForbiddenException('Only pending interests can be withdrawn');
    await this.prisma.interest.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    return { ok: true };
  }

  @Get()
  async inbox(@CurrentUser() user: User, @Query() q: InboxQuery) {
    const me = await this.profiles.browsingProfile(user.id);
    const viewer = await this.profiles.viewer(user.id, me);
    const box = q.box ?? 'received';
    const where: Prisma.InterestWhereInput =
      box === 'received'
        ? { receiverId: me.id, status: 'PENDING' }
        : box === 'sent'
          ? { senderId: me.id, status: 'PENDING' }
          : box === 'accepted'
            ? { status: 'ACCEPTED', OR: [{ senderId: me.id }, { receiverId: me.id }] }
            : { status: 'DECLINED', OR: [{ senderId: me.id }, { receiverId: me.id }] };

    const rows = await this.prisma.interest.findMany({
      where,
      include: { sender: { include: approvedPhotos }, receiver: { include: approvedPhotos } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const others = rows.map((r) => (r.senderId === me.id ? r.receiver : r.sender));
    const accepted = await acceptedConnections(this.prisma, me.id, others.map((o) => o.id));
    const counts = await this.prisma.interest.groupBy({
      by: ['status'],
      where: { receiverId: me.id, status: 'PENDING' },
      _count: true,
    });
    return {
      box,
      pendingReceived: counts[0]?._count ?? 0,
      items: rows.map((r, i) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        direction: r.senderId === me.id ? 'sent' : 'received',
        createdAt: r.createdAt,
        respondedAt: r.respondedAt,
        profile: toCard(others[i], viewer, accepted.has(others[i].id)),
      })),
    };
  }
}
