import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser, Public } from '../common/auth';
import { APP_CONFIG, AppConfig } from '../config';
import { PLANS, PREMIUM_PRICE } from '../domain/plans';
import { BillingService } from './billing.service';
import { renderInvoiceHtml } from './invoice';

class VerifyDto {
  @IsString() @MaxLength(100) orderId: string;
  @IsString() @MaxLength(100) paymentId: string;
  @IsString() @MaxLength(200) signature: string;
}

class MockDto {
  @IsString() @MaxLength(100) orderId: string;
}

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('plans')
  plans() {
    return {
      free: PLANS.FREE,
      premium: {
        ...PLANS.PREMIUM,
        basePaise: PREMIUM_PRICE.basePaise,
        gstPaise: PREMIUM_PRICE.gstPaise,
        totalPaise: PREMIUM_PRICE.totalPaise,
        gstRatePercent: PREMIUM_PRICE.gstRatePercent,
        monthlyContactUnlocks: PLANS.PREMIUM.weeklyContactUnlocks * 4,
      },
    };
  }

  @Post('payments/order')
  @HttpCode(200)
  order(@CurrentUser() user: User) {
    return this.billing.createOrder(user.id);
  }

  @Post('payments/verify')
  @HttpCode(200)
  verify(@CurrentUser() user: User, @Body() dto: VerifyDto) {
    return this.billing.verifyCheckout(user.id, dto.orderId, dto.paymentId, dto.signature);
  }

  @Post('payments/mock/complete')
  @HttpCode(200)
  mock(@CurrentUser() user: User, @Body() dto: MockDto) {
    return this.billing.completeMock(user.id, dto.orderId);
  }

  @Public()
  @SkipThrottle()
  @Post('payments/webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    return this.billing.handleWebhook(req.rawBody, signature);
  }

  @Get('payments')
  history(@CurrentUser() user: User) {
    return this.billing.history(user.id);
  }

  @Get('payments/:id/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(@CurrentUser() user: User, @Param('id') id: string) {
    const payment = await this.billing.invoiceFor(user.role === 'ADMIN' ? null : user.id, id);
    return renderInvoiceHtml(payment, this.config.business);
  }
}
