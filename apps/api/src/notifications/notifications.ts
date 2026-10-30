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
  /** For INTEREST_RECEIVED: lets channels (WhatsApp) answer "Accept"/"Decline" for this interest. */
  interestId?: string;
}

/** Extra delivery channel (email, WhatsApp…). It decides itself whether the member wants it. */
export type NotificationChannel = (input: NotifyInput) => Promise<void>;

/**
 * Every notification goes through `notify`: it is stored in-app, then handed to each
 * registered channel. A failing channel never breaks the action that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');
  private readonly channels = new Map<string, NotificationChannel>();

  constructor(private readonly prisma: PrismaService) {}

  registerChannel(name: string, channel: NotificationChannel) {
    this.channels.set(name, channel);
  }

  async notify(input: NotifyInput) {
    const { interestId: _ignored, ...stored } = input;
    try {
      await this.prisma.notification.create({ data: stored });
    } catch (e) {
      this.log.error(`Failed to store notification ${input.type}: ${(e as Error).message}`);
    }
    for (const [name, channel] of this.channels) {
      try {
        await channel(input);
      } catch (e) {
        this.log.error(`Channel ${name} failed for ${input.type}: ${(e as Error).message}`);
      }
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
