import { Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { acceptedConnections, approvedPhotos, toCard } from '../profiles/presenter';
import { ProfilesService } from '../profiles/profiles.service';
import { InterestsService } from './interests.service';

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
    private readonly interests: InterestsService,
  ) {}

  @Post()
  send(@CurrentUser() user: User, @Body() dto: SendInterestDto) {
    return this.interests.send(user.id, dto.profileId, dto.message);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.interests.respond(user.id, id, 'ACCEPTED');
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.interests.respond(user.id, id, 'DECLINED');
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
