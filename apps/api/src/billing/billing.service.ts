import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Payment, Prisma } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config';
import { financialYear, formatInvoiceNumber } from '../domain/gst';
import { PREMIUM_PRICE } from '../domain/plans';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';

function addOneMonth(d: Date): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCMonth(r.getUTCMonth() + 1);
  // 31 Jan + 1 month → 28/29 Feb, not 3 Mar.
  if (r.getUTCDate() < day) r.setUTCDate(0);
  return r;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Injectable()
export class BillingService {
  private readonly log = new Logger('Billing');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async createOrder(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const { basePaise, gstPaise, totalPaise } = PREMIUM_PRICE;
    const receipt = `sms_${randomUUID().slice(0, 18)}`;

    let providerOrderId: string;
    if (this.config.payments.mode === 'razorpay') {
      const { razorpayKeyId, razorpayKeySecret } = this.config.payments;
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ amount: totalPaise, currency: 'INR', receipt, notes: { userId, plan: 'PREMIUM_MONTHLY' } }),
      });
      if (!res.ok) {
        this.log.error(`Razorpay order failed: ${res.status} ${await res.text()}`);
        throw new BadRequestException('Could not start payment. Please try again.');
      }
      providerOrderId = ((await res.json()) as { id: string }).id;
    } else {
      providerOrderId = `mock_order_${randomUUID()}`;
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: this.config.payments.mode,
        providerOrderId,
        basePaise,
        gstPaise,
        totalPaise,
        billingState: profile?.state ?? null,
      },
    });
    return {
      paymentId: payment.id,
      mode: this.config.payments.mode,
      orderId: providerOrderId,
      keyId: this.config.payments.mode === 'razorpay' ? this.config.payments.razorpayKeyId : null,
      amountPaise: totalPaise,
      basePaise,
      gstPaise,
      currency: 'INR',
    };
  }

  /** Checkout success callback from the browser. The signature proves Razorpay sent it. */
  async verifyCheckout(userId: string, orderId: string, paymentId: string, signature: string) {
    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId: orderId } });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');
    const expected = createHmac('sha256', this.config.payments.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (!/^[0-9a-f]+$/i.test(signature) || !safeEqualHex(expected, signature)) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Payment verification failed');
    }
    return this.markPaid(orderId, paymentId);
  }

  /** Development only: pretend the payment succeeded. */
  async completeMock(userId: string, orderId: string) {
    if (this.config.payments.mode !== 'mock') throw new NotFoundException();
    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId: orderId } });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');
    return this.markPaid(orderId, `mock_pay_${randomUUID()}`);
  }

  /** Razorpay server-to-server webhook. Backs up the browser callback (e.g. if the tab was closed). */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.payments.razorpayWebhookSecret;
    if (!rawBody || !signature || !secret) throw new BadRequestException();
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!/^[0-9a-f]+$/i.test(signature) || !safeEqualHex(expected, signature)) throw new BadRequestException('Bad signature');

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string } } };
    };
    const entity = event.payload?.payment?.entity;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity?.order_id) {
      await this.markPaid(entity.order_id, entity.id);
    } else if (event.event === 'payment.failed' && entity?.order_id) {
      await this.prisma.payment.updateMany({ where: { providerOrderId: entity.order_id, status: 'CREATED' }, data: { status: 'FAILED' } });
    }
    return { ok: true };
  }

  /** Idempotent: marks the order paid, issues an invoice number and starts/extends Premium. */
  async markPaid(orderId: string, providerPaymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`);
      const payment = await tx.payment.findUnique({ where: { providerOrderId: orderId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === 'PAID') return { payment, subscription: await tx.subscription.findUnique({ where: { paymentId: payment.id } }), fresh: false };

      const now = new Date();
      const fy = financialYear(now);
      const counter = await tx.invoiceCounter.upsert({
        where: { financialYear: fy },
        create: { financialYear: fy, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const paid = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', providerPaymentId, paidAt: now, invoiceNumber: formatInvoiceNumber(fy, counter.lastNumber) },
      });

      // Renewing early queues the new month after the current one.
      const latest = await tx.subscription.findFirst({
        where: { userId: payment.userId, status: 'ACTIVE', endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
      });
      const startsAt = latest ? latest.endsAt : now;
      const subscription = await tx.subscription.create({
        data: { userId: payment.userId, startsAt, endsAt: addOneMonth(startsAt), paymentId: payment.id },
      });
      return { payment: paid, subscription, fresh: true };
    });

    if (result.fresh) {
      await this.notifications.notify({
        userId: result.payment.userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Welcome to Universal Premium',
        body: `Payment received. Premium is active until ${result.subscription!.endsAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
        link: '/payments',
      });
    }
    return { status: 'PAID', paymentId: result.payment.id, subscription: result.subscription };
  }

  async history(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId, status: { in: ['PAID', 'REFUNDED'] } },
      include: { subscription: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invoiceFor(userId: string | null, paymentId: string): Promise<Payment & { user: { phone: string; email: string | null; profile: { firstName: string | null; lastName: string | null; city: string | null; state: string | null } | null } }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: { select: { phone: true, email: true, profile: { select: { firstName: true, lastName: true, city: true, state: true } } } } },
    });
    if (!payment || (userId && payment.userId !== userId) || !payment.invoiceNumber) throw new NotFoundException('Invoice not found');
    return payment;
  }

  /** Daily: expire finished subscriptions and remind members 3 days before Premium ends. */
  @Cron('0 30 3 * * *') // 09:00 IST
  async dailyMaintenance() {
    const now = new Date();
    await this.prisma.subscription.updateMany({ where: { status: 'ACTIVE', endsAt: { lte: now } }, data: { status: 'EXPIRED' } });

    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const ending = await this.prisma.subscription.findMany({ where: { status: 'ACTIVE', endsAt: { gt: now, lte: soon } } });
    for (const sub of ending) {
      const renewed = await this.prisma.subscription.findFirst({ where: { userId: sub.userId, startsAt: { gte: sub.endsAt } } });
      const reminded = await this.prisma.notification.findFirst({
        where: { userId: sub.userId, type: 'PLAN_EXPIRING', createdAt: { gte: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } },
      });
      if (renewed || reminded) continue;
      await this.notifications.notify({
        userId: sub.userId,
        type: 'PLAN_EXPIRING',
        title: 'Your Premium ends soon',
        body: `Premium ends on ${sub.endsAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}. Renew to keep 4 contact unlocks every week.`,
        link: '/plans',
      });
    }
  }
}
