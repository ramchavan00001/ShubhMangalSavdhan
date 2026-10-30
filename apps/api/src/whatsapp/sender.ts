import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

export interface OutgoingMessage {
  phone: string; // 91XXXXXXXXXX
  userId?: string | null;
  kind: 'DIGEST' | 'INTEREST_ALERT' | 'REPLY';
  /** Full text, shown in test mode and the admin log, and sent as-is inside the 24-hour reply window. */
  text: string;
  /** Approved template to use outside the 24-hour window (Meta rule for business-started chats). */
  template?: { name: string; params: string[] };
  interestId?: string;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Meta forbids newlines, tabs and long space runs inside template parameters. */
export function templateParam(text: string) {
  return text.replace(/[\n\t]+/g, ' · ').replace(/ {4,}/g, '   ').slice(0, 1000);
}

/**
 * Sends WhatsApp messages. In test mode (WHATSAPP_PROVIDER=console) messages are only
 * saved and printed, so the whole flow can be tried without a Meta account.
 */
@Injectable()
export class WhatsAppSender {
  private readonly log = new Logger('WhatsApp');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get testMode() {
    return this.config.whatsapp.provider === 'console';
  }

  async send(msg: OutgoingMessage) {
    const base = {
      userId: msg.userId ?? null,
      phone: msg.phone,
      direction: 'OUT' as const,
      kind: msg.kind,
      body: msg.text,
      interestId: msg.interestId,
    };

    if (this.testMode) {
      this.log.log(`[TEST] → +${msg.phone} (${msg.kind})\n${msg.text}`);
      return this.prisma.whatsAppMessage.create({ data: { ...base, status: 'LOGGED' } });
    }

    const lastInbound = await this.prisma.whatsAppMessage.findFirst({
      where: { phone: msg.phone, direction: 'IN' },
      orderBy: { createdAt: 'desc' },
    });
    const inWindow = !!lastInbound && Date.now() - lastInbound.createdAt.getTime() < WINDOW_MS;
    const { token, phoneNumberId, templateLanguage } = this.config.whatsapp;

    const payload =
      inWindow || !msg.template
        ? { messaging_product: 'whatsapp', to: msg.phone, type: 'text', text: { body: msg.text, preview_url: false } }
        : {
            messaging_product: 'whatsapp',
            to: msg.phone,
            type: 'template',
            template: {
              name: msg.template.name,
              language: { code: templateLanguage },
              components: [{ type: 'body', parameters: msg.template.params.map((t) => ({ type: 'text', text: templateParam(t) })) }],
            },
          };
    if (!inWindow && !msg.template) {
      // Outside the window only templates are delivered; don't pretend otherwise.
      return this.prisma.whatsAppMessage.create({ data: { ...base, status: 'FAILED', error: 'Outside 24-hour window and no template' } });
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
      return this.prisma.whatsAppMessage.create({ data: { ...base, status: 'SENT', providerMessageId: json.messages?.[0]?.id } });
    } catch (e) {
      this.log.error(`Send to +${msg.phone} failed: ${(e as Error).message}`);
      return this.prisma.whatsAppMessage.create({ data: { ...base, status: 'FAILED', error: (e as Error).message.slice(0, 500) } });
    }
  }
}
