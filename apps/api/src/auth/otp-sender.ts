import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';

/** Sends a one-time password by SMS. */
@Injectable()
export class OtpSender {
  private readonly log = new Logger('OtpSender');

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async send(phone: string, code: string): Promise<void> {
    if (this.config.otp.provider === 'console') {
      this.log.warn(`[DEV] OTP for +${phone}: ${code}`);
      return;
    }
    await this.sendViaMsg91(phone, code);
  }

  /**
   * MSG91 Flow API. The template (registered on DLT) must contain an `##otp##` variable.
   * https://docs.msg91.com/reference/send-sms
   */
  private async sendViaMsg91(phone: string, code: string) {
    const { msg91AuthKey, msg91TemplateId } = this.config.otp;
    if (!msg91AuthKey || !msg91TemplateId) throw new Error('MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required');
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: msg91AuthKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: msg91TemplateId, short_url: '0', recipients: [{ mobiles: phone, otp: code }] }),
    });
    if (!res.ok) {
      this.log.error(`MSG91 send failed: ${res.status} ${await res.text()}`);
      throw new Error('Could not send OTP');
    }
  }
}
