import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChatModule } from './chat/chat.controller';
import { AuthGuard, Public } from './common/auth';
import { CoreModule } from './common/core.module';
import { InteractionsModule } from './interactions/interactions.module';
import { MastersController } from './masters/masters.controller';
import { MembershipModule } from './membership/membership.service';
import { NotificationsModule } from './notifications/notifications';
import { PrismaModule } from './prisma/prisma.service';
import { ProfilesModule } from './profiles/profiles.module';
import { VerificationModule } from './verification/verification.controller';
import { WhatsAppModule } from './whatsapp/whatsapp.controller';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    CoreModule,
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '30d' } }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    MembershipModule,
    NotificationsModule,
    ProfilesModule,
    AuthModule,
    InteractionsModule,
    BillingModule,
    ChatModule,
    WhatsAppModule,
    VerificationModule,
  ],
  controllers: [HealthController, MastersController, AdminController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
