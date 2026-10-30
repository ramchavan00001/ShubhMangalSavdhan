import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Profile, User } from '@prisma/client';
import { IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser } from '../common/auth';
import { parseProfileCode, profileCode } from '../domain/matching';
import { PLANS } from '../domain/plans';
import { MembershipService } from '../membership/membership.service';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { acceptedConnections, approvedPhotos, toCard } from '../profiles/presenter';
import { containsContactDetails, ProfilesService } from '../profiles/profiles.service';

class SendDto {
  @IsString() @Length(1, 1000) body: string;
}

class ThreadQuery {
  @IsOptional() @IsString() before?: string;
}

const PAGE = 50;

/**
 * Chat between two connected members (an accepted interest in either direction).
 * Premium members can start a conversation; Free members can reply once the other person has written.
 */
@Controller('chats')
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly membership: MembershipService,
    private readonly notifications: NotificationsService,
  ) {}

  private async other(me: Profile, code: string) {
    const seq = parseProfileCode(code);
    if (!seq) throw new NotFoundException('Conversation not found');
    const other = await this.prisma.profile.findFirst({
      where: { AND: [{ seq }, this.profiles.discoverableWhere(me)] },
      include: approvedPhotos,
    });
    if (!other) throw new NotFoundException('Conversation not found');
    const connected = (await acceptedConnections(this.prisma, me.id, [other.id])).has(other.id);
    if (!connected) throw new ForbiddenException('You can chat once you have both accepted an interest.');
    return other;
  }

  /** Why the member can or can't send a message right now. */
  private async sendState(user: User, me: Profile, otherId: string) {
    const tier = await this.membership.tier(user.id);
    if (PLANS[tier].canStartChat) return { canSend: true, reason: null };
    const theyWrote = await this.prisma.message.count({ where: { senderId: otherId, receiverId: me.id } });
    return theyWrote > 0
      ? { canSend: true, reason: null }
      : { canSend: false, reason: 'Free members can reply once the other person starts the conversation. Upgrade to Premium to start chats.' };
  }

  /** All connections, with the latest message and unread count. */
  @Get()
  async list(@CurrentUser() user: User) {
    const me = await this.profiles.browsingProfile(user.id);
    const viewer = await this.profiles.viewer(user.id, me);
    const accepted = await this.prisma.interest.findMany({
      where: { status: 'ACCEPTED', OR: [{ senderId: me.id }, { receiverId: me.id }] },
      select: { senderId: true, receiverId: true, respondedAt: true },
    });
    const ids = accepted.map((i) => (i.senderId === me.id ? i.receiverId : i.senderId));
    const others = await this.prisma.profile.findMany({
      where: { AND: [{ id: { in: ids } }, this.profiles.discoverableWhere(me)] },
      include: approvedPhotos,
    });

    const rows = await Promise.all(
      others.map(async (o) => {
        const [last, unread] = await Promise.all([
          this.prisma.message.findFirst({
            where: { OR: [{ senderId: me.id, receiverId: o.id }, { senderId: o.id, receiverId: me.id }] },
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.message.count({ where: { senderId: o.id, receiverId: me.id, readAt: null } }),
        ]);
        const connectedAt = accepted.find((a) => a.senderId === o.id || a.receiverId === o.id)?.respondedAt;
        return {
          profile: toCard(o, viewer, true),
          lastMessage: last && { body: last.body, fromMe: last.senderId === me.id, createdAt: last.createdAt },
          unread,
          sortAt: (last?.createdAt ?? connectedAt ?? new Date(0)).toISOString(),
        };
      }),
    );
    rows.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    return { items: rows, totalUnread: rows.reduce((n, r) => n + r.unread, 0) };
  }

  @Get(':code')
  async thread(@CurrentUser() user: User, @Param('code') code: string, @Query() q: ThreadQuery) {
    const me = await this.profiles.browsingProfile(user.id);
    const other = await this.other(me, code);
    const viewer = await this.profiles.viewer(user.id, me);
    const between = { OR: [{ senderId: me.id, receiverId: other.id }, { senderId: other.id, receiverId: me.id }] };

    const messages = await this.prisma.message.findMany({
      where: q.before ? { AND: [between, { createdAt: { lt: new Date(q.before) } }] } : between,
      orderBy: { createdAt: 'desc' },
      take: PAGE,
    });
    await this.prisma.message.updateMany({ where: { senderId: other.id, receiverId: me.id, readAt: null }, data: { readAt: new Date() } });

    return {
      profile: toCard(other, viewer, true),
      ...(await this.sendState(user, me, other.id)),
      hasMore: messages.length === PAGE,
      messages: messages.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        fromMe: m.senderId === me.id,
        createdAt: m.createdAt,
        readAt: m.senderId === me.id ? m.readAt : undefined,
      })),
    };
  }

  @Post(':code')
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(@CurrentUser() user: User, @Param('code') code: string, @Body() dto: SendDto) {
    const me = await this.profiles.approvedProfile(user.id);
    const other = await this.other(me, code);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message is empty');
    if (containsContactDetails(body)) {
      throw new BadRequestException('For everyone’s safety, phone numbers and emails can’t be shared in chat. Use “Unlock contact details” instead.');
    }
    const state = await this.sendState(user, me, other.id);
    if (!state.canSend) throw new ForbiddenException(state.reason);

    // One notification per burst: only when the receiver had nothing unread from me.
    const hadUnread = await this.prisma.message.count({ where: { senderId: me.id, receiverId: other.id, readAt: null } });
    const msg = await this.prisma.message.create({ data: { senderId: me.id, receiverId: other.id, body } });
    if (!hadUnread) {
      await this.notifications.notify({
        userId: other.userId,
        type: 'MESSAGE_RECEIVED',
        title: 'New message',
        body: `${me.firstName ?? 'A member'} (${profileCode(me.seq)}) sent you a message.`,
        link: `/chat/${profileCode(me.seq)}`,
      });
    }
    return { id: msg.id, body: msg.body, fromMe: true, createdAt: msg.createdAt, readAt: null };
  }
}

@Module({ controllers: [ChatController] })
export class ChatModule {}
