import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Profile, User } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../config';
import { ageOn } from '../domain/age';
import { profileCode } from '../domain/matching';
import { parseWhatsAppReply, WhatsAppIntent } from '../domain/whatsapp-intent';
import { InterestsService } from '../interactions/interests.service';
import { fitsPreferenceWhere, iFitTheirPreferenceWhere } from '../matches/match-filters';
import { MembershipService } from '../membership/membership.service';
import { NotificationsService, NotifyInput } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { WhatsAppSender } from './sender';

export const DIGEST_SIZE = 5;
const FREE_DIGEST_GAP_MS = 7 * 24 * 60 * 60 * 1000;
const ALERT_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ConsentKind = 'WHATSAPP_DIGEST' | 'WHATSAPP_SHARE_PROFILE' | 'WHATSAPP_ALERTS';
const CONSENT_FIELD: Record<ConsentKind, 'whatsappDigest' | 'whatsappShareProfile' | 'whatsappAlerts'> = {
  WHATSAPP_DIGEST: 'whatsappDigest',
  WHATSAPP_SHARE_PROFILE: 'whatsappShareProfile',
  WHATSAPP_ALERTS: 'whatsappAlerts',
};

/** Optional AI fallback for replies the rules don't understand (set by the AI module). */
export type IntentFallback = (text: string) => Promise<WhatsAppIntent | null>;

function feetInches(cm: number | null) {
  if (!cm) return null;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/** One digest line. Only what members agreed to share: no photo, surname, phone or email. */
export function digestLine(p: Profile) {
  const verified = p.idVerifiedAt && p.selfieVerifiedAt ? ' ✓Verified' : '';
  const head = [`${p.firstName}, ${p.dateOfBirth ? ageOn(p.dateOfBirth) : ''}`, feetInches(p.heightCm), p.city].filter(Boolean).join(' · ');
  const tail = [p.profession, p.motherTongue, p.community ?? p.religion].filter(Boolean).join(' · ');
  return { head, tail: `${tail}${verified}` };
}

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly log = new Logger('WhatsApp');
  private fallback: IntentFallback | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: WhatsAppSender,
    private readonly profiles: ProfilesService,
    private readonly membership: MembershipService,
    private readonly interests: InterestsService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    this.notifications.registerChannel('whatsapp', (n) => this.onNotification(n));
  }

  setIntentFallback(fn: IntentFallback) {
    this.fallback = fn;
  }

  private link(path: string) {
    return `${this.config.webUrl}${path}`;
  }

  // ───────────── Consent ─────────────

  async preferences(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { digest: u.whatsappDigest, shareProfile: u.whatsappShareProfile, alerts: u.whatsappAlerts, phone: u.phone, testMode: this.sender.testMode };
  }

  /** Changes consent flags and records each change in the consent log. */
  async setConsent(userId: string, changes: Partial<Record<ConsentKind, boolean>>, source: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const data: Prisma.UserUpdateInput = {};
    const logs: Prisma.ConsentLogCreateManyInput[] = [];
    for (const [kind, granted] of Object.entries(changes) as [ConsentKind, boolean | undefined][]) {
      if (granted === undefined || u[CONSENT_FIELD[kind]] === granted) continue;
      data[CONSENT_FIELD[kind]] = granted;
      logs.push({ userId, kind, granted, source });
    }
    if (logs.length) {
      await this.prisma.$transaction([this.prisma.user.update({ where: { id: userId }, data }), this.prisma.consentLog.createMany({ data: logs })]);
    }
    // Agreeing to appear in digests later still introduces you to current matches (each pair only once).
    if (changes.WHATSAPP_SHARE_PROFILE && !u.whatsappShareProfile) {
      const p = await this.prisma.profile.findUnique({ where: { userId } });
      if (p?.status === 'APPROVED') await this.enqueueNewProfile(p.id);
    }
    return this.preferences(userId);
  }

  // ───────────── Digest queue ─────────────

  /**
   * Called when a profile goes live: queue it for every opted-in member it matches both ways.
   * Nothing is queued unless the new member agreed to appear in digests.
   */
  async enqueueNewProfile(candidateId: string) {
    const candidate = await this.prisma.profile.findUnique({ where: { id: candidateId }, include: { user: true, preference: true } });
    if (!candidate || !candidate.user.whatsappShareProfile || candidate.status !== 'APPROVED' || candidate.hidden) return 0;
    const recipients = await this.prisma.profile.findMany({
      where: {
        AND: [
          this.profiles.discoverableWhere(candidate),
          fitsPreferenceWhere(candidate.preference),
          iFitTheirPreferenceWhere(candidate),
          { user: { whatsappDigest: true } },
          // Don't suggest someone the recipient already ignored.
          { marksMade: { none: { targetId: candidate.id, type: 'IGNORE' } } },
        ],
      },
      select: { id: true },
    });
    if (!recipients.length) return 0;
    const res = await this.prisma.digestItem.createMany({
      data: recipients.map((r) => ({ recipientId: r.id, candidateId: candidate.id })),
      skipDuplicates: true,
    });
    return res.count;
  }

  /** Pending items whose candidate can still be shown; stale ones are dropped. */
  private async pendingItems(recipient: Profile) {
    const items = await this.prisma.digestItem.findMany({
      where: { recipientId: recipient.id, digestId: null },
      include: { candidate: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const stillShown = await this.prisma.profile.findMany({
      where: { AND: [{ id: { in: items.map((i) => i.candidateId) } }, this.profiles.discoverableWhere(recipient), { user: { whatsappShareProfile: true } }] },
      select: { id: true },
    });
    const ok = new Set(stillShown.map((p) => p.id));
    const stale = items.filter((i) => !ok.has(i.candidateId)).map((i) => i.id);
    if (stale.length) await this.prisma.digestItem.deleteMany({ where: { id: { in: stale } } });
    return items.filter((i) => ok.has(i.candidateId));
  }

  /** Builds and sends one digest of up to 5 new matches. Returns false when there was nothing to send. */
  private async sendDigest(user: User, recipient: Profile, kind: 'DIGEST' | 'REPLY') {
    const pending = await this.pendingItems(recipient);
    if (!pending.length) return false;
    const batch = pending.slice(0, DIGEST_SIZE);
    const digest = await this.prisma.$transaction(async (tx) => {
      const d = await tx.digest.create({ data: { recipientId: recipient.id } });
      for (const [i, item] of batch.entries()) {
        await tx.digestItem.update({ where: { id: item.id }, data: { digestId: d.id, position: i + 1 } });
      }
      return d;
    });

    const lines = batch.map((item, i) => {
      const { head, tail } = digestLine(item.candidate);
      return `${i + 1}. ${head}\n   ${tail}`;
    });
    const n = batch.length;
    const more = pending.length > n ? `\nReply "More" to see ${pending.length - n} more.` : '';
    const text =
      `Shubh Mangal Savdhan\nNamaste ${recipient.firstName ?? ''} ji, ${n} new match${n === 1 ? '' : 'es'} for you:\n\n` +
      `${lines.join('\n')}\n\n` +
      `Reply "Interested 1" to send interest, or "Skip 2" to hide someone.${more}\n` +
      `View profiles: ${this.link('/matches?tab=new')}\n` +
      `Reply STOP to stop these messages.`;

    await this.sender.send({
      phone: user.phone,
      userId: user.id,
      kind,
      text,
      template: {
        name: this.config.whatsapp.digestTemplate,
        params: [recipient.firstName ?? 'ji', String(n), batch.map((it, i) => `${i + 1}. ${digestLine(it.candidate).head}`).join(' | '), this.link('/matches?tab=new')],
      },
    });
    this.log.log(`Digest ${digest.id} with ${n} matches for ${profileCode(recipient.seq)}`);
    return true;
  }

  /** Daily at 9:00 IST: Premium members get a digest every day, Free members once a week. */
  @Cron('0 30 3 * * *')
  async runDailyDigests(now = new Date()) {
    const recipients = await this.prisma.profile.findMany({
      where: { status: 'APPROVED', user: { status: 'ACTIVE', whatsappDigest: true }, digestItems: { some: { digestId: null } } },
      include: { user: true, digests: { orderBy: { sentAt: 'desc' }, take: 1 } },
    });
    let sent = 0;
    for (const r of recipients) {
      const tier = await this.membership.tier(r.userId);
      const last = r.digests[0]?.sentAt;
      if (tier === 'FREE' && last && now.getTime() - last.getTime() < FREE_DIGEST_GAP_MS) continue;
      try {
        if (await this.sendDigest(r.user, r, 'DIGEST')) sent++;
      } catch (e) {
        this.log.error(`Digest for ${r.id} failed: ${(e as Error).message}`);
      }
    }
    return { recipients: recipients.length, sent };
  }

  // ───────────── Interest alerts ─────────────

  private async onNotification(n: NotifyInput) {
    if (n.type !== 'INTEREST_RECEIVED' || !n.interestId) return;
    const user = await this.prisma.user.findUnique({ where: { id: n.userId } });
    if (!user?.whatsappAlerts || user.status !== 'ACTIVE') return;
    const interest = await this.prisma.interest.findUnique({ where: { id: n.interestId }, include: { sender: true } });
    if (!interest) return;
    const s = interest.sender;
    const who = [s.dateOfBirth && `${ageOn(s.dateOfBirth)}`, s.city, s.profession].filter(Boolean).join(', ');
    const link = this.link(`/profile/${profileCode(s.seq)}`);
    await this.sender.send({
      phone: user.phone,
      userId: user.id,
      kind: 'INTEREST_ALERT',
      interestId: interest.id,
      text: `Shubh Mangal Savdhan\n${s.firstName} (${who}) is interested in you.\nReply "Accept" or "Decline", or view the profile: ${link}`,
      template: { name: this.config.whatsapp.alertTemplate, params: [s.firstName ?? 'A member', who, link] },
    });
  }

  // ───────────── Replies ─────────────

  private reply(user: User | null, phone: string, text: string) {
    return this.sender.send({ phone, userId: user?.id, kind: 'REPLY', text });
  }

  private helpText() {
    return (
      'You can reply:\n' +
      '• "Interested 1" (or "1 aur 3 pasand hai") to send interest\n' +
      '• "Skip 2" to hide someone\n' +
      '• "More" for more matches\n' +
      '• "Accept" / "Decline" for an interest you received\n' +
      '• "STOP" to stop messages\n' +
      `Or open ${this.link('/matches')}`
    );
  }

  /** Handles one incoming message (from Meta's webhook, or the admin test chat). */
  async handleInbound(phone: string, text: string, providerMessageId?: string) {
    if (providerMessageId && (await this.prisma.whatsAppMessage.findUnique({ where: { providerMessageId } }))) return; // duplicate delivery
    const user = await this.prisma.user.findUnique({ where: { phone }, include: { profile: true } });
    await this.prisma.whatsAppMessage.create({
      data: { phone, userId: user?.id, direction: 'IN', kind: 'INBOUND', body: text.slice(0, 2000), status: 'RECEIVED', providerMessageId },
    });

    if (!user || user.status !== 'ACTIVE' || !user.profile) {
      return this.reply(user, phone, `This number isn't registered with Shubh Mangal Savdhan. Create your free profile at ${this.link('/')}`);
    }

    let intent = parseWhatsAppReply(text);
    if (intent.kind === 'UNKNOWN' && this.fallback) intent = (await this.fallback(text).catch(() => null)) ?? intent;

    switch (intent.kind) {
      case 'STOP':
        await this.setConsent(user.id, { WHATSAPP_DIGEST: false, WHATSAPP_ALERTS: false }, 'WHATSAPP_STOP');
        return this.reply(user, phone, 'Done. You won’t get WhatsApp messages from us any more. Reply START to turn them back on.');
      case 'START':
        await this.setConsent(user.id, { WHATSAPP_DIGEST: true, WHATSAPP_ALERTS: true }, 'WHATSAPP_START');
        return this.reply(user, phone, 'Welcome back! You’ll get new matches and interest alerts here.');
      case 'HELP':
      case 'UNKNOWN':
        return this.reply(user, phone, `${intent.kind === 'UNKNOWN' ? 'Sorry, I didn’t understand that. ' : ''}${this.helpText()}`);
      case 'MORE':
        if (!(await this.sendDigest(user, user.profile, 'REPLY'))) {
          return this.reply(user, phone, `No more new matches right now. See all your matches at ${this.link('/matches')}`);
        }
        return;
      case 'YES':
      case 'NO':
        return intent.numbers.length
          ? this.actOnDigest(user, user.profile, intent.kind, intent.numbers)
          : this.actOnAlert(user, intent.kind);
    }
  }

  private async actOnDigest(user: User, me: Profile, kind: 'YES' | 'NO', numbers: number[]) {
    const digest = await this.prisma.digest.findFirst({
      where: { recipientId: me.id },
      orderBy: { sentAt: 'desc' },
      include: { items: { include: { candidate: true } } },
    });
    if (!digest) return this.reply(user, user.phone, `You don’t have any matches on WhatsApp yet. See your matches at ${this.link('/matches')}`);

    const lines: string[] = [];
    for (const n of numbers) {
      const item = digest.items.find((i) => i.position === n);
      if (!item) {
        lines.push(`${n}: there is no match with that number in your last message.`);
        continue;
      }
      const c = item.candidate;
      if (kind === 'NO') {
        await this.prisma.profileMark.upsert({
          where: { ownerId_targetId_type: { ownerId: me.id, targetId: c.id, type: 'IGNORE' } },
          create: { ownerId: me.id, targetId: c.id, type: 'IGNORE' },
          update: {},
        });
        lines.push(`${c.firstName}: hidden from your matches.`);
        continue;
      }
      try {
        const r = await this.interests.send(user.id, c.id);
        lines.push(r.status === 'ACCEPTED' ? `${c.firstName}: you’re now connected! 🎉` : `${c.firstName}: interest sent ✓`);
      } catch (e) {
        lines.push(`${c.firstName}: ${(e as Error).message}`);
      }
    }
    const footer = kind === 'YES' ? `\nWe’ll let you know when they reply. ${this.link('/inbox?box=sent')}` : '';
    return this.reply(user, user.phone, lines.join('\n') + footer);
  }

  private async actOnAlert(user: User, kind: 'YES' | 'NO') {
    const alert = await this.prisma.whatsAppMessage.findFirst({
      where: { userId: user.id, kind: 'INTEREST_ALERT', interestId: { not: null }, createdAt: { gte: new Date(Date.now() - ALERT_REPLY_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!alert) {
      return this.reply(user, user.phone, `Please tell me which match, e.g. "Interested 1". ${this.helpText()}`);
    }
    const interest = await this.prisma.interest.findUnique({ where: { id: alert.interestId! }, include: { sender: true } });
    if (!interest || interest.status !== 'PENDING') {
      return this.reply(user, user.phone, `That interest has already been answered. See your inbox: ${this.link('/inbox')}`);
    }
    try {
      await this.interests.respond(user.id, interest.id, kind === 'YES' ? 'ACCEPTED' : 'DECLINED');
    } catch (e) {
      return this.reply(user, user.phone, (e as Error).message);
    }
    const name = interest.sender.firstName ?? 'the member';
    return this.reply(
      user,
      user.phone,
      kind === 'YES'
        ? `You’re now connected with ${name}! 🎉 Say namaste: ${this.link(`/chat/${profileCode(interest.sender.seq)}`)}`
        : `Okay, you declined ${name}’s interest.`,
    );
  }
}
