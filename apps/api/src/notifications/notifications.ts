import { Controller, Get, Global, HttpCode, Injectable, Logger, Module, Param, Post, Query } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

/**
 * In-app notifications. Email/WhatsApp delivery plugs in here later (Phase 2) —
 * every notification already goes through `notify`.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput) {
    try {
      await this.prisma.notification.create({ data: input });
    } catch (e) {
      // A failed notification must never break the action that triggered it.
      this.log.error(`Failed to store notification ${input.type}: ${(e as Error).message}`);
    }
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: User, @Query('cursor') cursor?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return { items, nextCursor: items.length === 30 ? items[items.length - 1].id : null };
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentUser() user: User) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @Post(':id/read')
  @HttpCode(200)
  async read(@CurrentUser() user: User, @Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
    return { ok: true };
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
