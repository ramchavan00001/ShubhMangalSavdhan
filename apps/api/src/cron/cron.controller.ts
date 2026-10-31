import { CanActivate, Controller, ExecutionContext, ForbiddenException, HttpCode, Inject, Injectable, Logger, Module, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BillingModule } from '../billing/billing.module';
import { BillingService } from '../billing/billing.service';
import { Public } from '../common/auth';
import { APP_CONFIG, AppConfig } from '../config';
import { WhatsAppModule } from '../whatsapp/whatsapp.controller';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { isCronRequestAuthorized } from './cron-auth';

/** Only Cloud Scheduler (OIDC token for the configured service account) may call /cron/*. */
@Injectable()
export class CronGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const s = this.config.scheduler;
    if (s.mode !== 'external') throw new ForbiddenException('Scheduled jobs run inside the API (SCHEDULER_MODE=internal)');
    if (!(await isCronRequestAuthorized(req.headers.authorization, s))) throw new ForbiddenException();
    return true;
  }
}

/**
 * Daily jobs, called by Cloud Scheduler when SCHEDULER_MODE=external.
 * Both jobs are safe to re-run: expiry only touches due subscriptions, reminders and digests skip
 * members already handled.
 */
@Controller('cron')
@Public()
@SkipThrottle()
@UseGuards(CronGuard)
export class CronController {
  private readonly log = new Logger('Cron');

  constructor(
    private readonly billing: BillingService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Post('daily-maintenance')
  @HttpCode(200)
  async dailyMaintenance() {
    const result = await this.billing.dailyMaintenance();
    this.log.log(`daily-maintenance: ${JSON.stringify(result)}`);
    return result;
  }

  @Post('whatsapp-digests')
  @HttpCode(200)
  async whatsappDigests() {
    const result = await this.whatsapp.runDailyDigests();
    this.log.log(`whatsapp-digests: ${JSON.stringify(result)}`);
    return result;
  }
}

@Module({
  imports: [BillingModule, WhatsAppModule],
  controllers: [CronController],
  providers: [CronGuard],
})
export class CronModule {}
