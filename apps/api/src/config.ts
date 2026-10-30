import { resolve } from 'node:path';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const v = (process.env[name] ?? fallback) as T;
  if (!allowed.includes(v)) throw new Error(`${name} must be one of ${allowed.join(', ')}`);
  return v;
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const jwtSecret = required('JWT_SECRET');
  if (isProd && (jwtSecret === 'change-me' || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET must be a long random value in production');
  }

  const otpProvider = oneOf('OTP_PROVIDER', ['console', 'msg91'] as const, 'console');
  const paymentsMode = oneOf('PAYMENTS_MODE', ['mock', 'razorpay'] as const, 'mock');
  const whatsappProvider = oneOf('WHATSAPP_PROVIDER', ['console', 'meta'] as const, 'console');
  const kycProvider = oneOf('KYC_PROVIDER', ['mock', 'manual'] as const, 'mock');
  const emailProvider = oneOf('EMAIL_PROVIDER', ['console', 'smtp'] as const, 'console');
  if (isProd && kycProvider === 'mock') throw new Error('KYC_PROVIDER=mock is not allowed in production (use manual)');
  if (isProd && otpProvider === 'console') throw new Error('OTP_PROVIDER=console is not allowed in production');
  if (isProd && paymentsMode === 'mock') throw new Error('PAYMENTS_MODE=mock is not allowed in production');

  return {
    nodeEnv,
    isProd,
    port: Number(process.env.PORT ?? 4000),
    webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
    jwtSecret,
    adminPhones: (process.env.ADMIN_PHONES ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    otp: {
      provider: otpProvider,
      msg91AuthKey: process.env.MSG91_AUTH_KEY ?? '',
      msg91TemplateId: process.env.MSG91_OTP_TEMPLATE_ID ?? '',
    },
    payments: {
      mode: paymentsMode,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
      razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
      razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
    },
    business: {
      name: process.env.BUSINESS_NAME ?? 'Shubh Mangal Savdhan',
      gstin: process.env.BUSINESS_GSTIN ?? '[YOUR GSTIN]',
      address: process.env.BUSINESS_ADDRESS ?? '[YOUR REGISTERED ADDRESS]',
      state: process.env.BUSINESS_STATE ?? 'Maharashtra',
      // Confirm the correct SAC code for your service with your CA.
      sac: process.env.BUSINESS_SAC ?? '[SAC CODE]',
    },
    whatsapp: {
      provider: whatsappProvider,
      token: process.env.WHATSAPP_TOKEN ?? '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
      appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
      digestTemplate: process.env.WHATSAPP_TEMPLATE_DIGEST ?? 'new_matches',
      alertTemplate: process.env.WHATSAPP_TEMPLATE_INTEREST ?? 'interest_received',
      templateLanguage: process.env.WHATSAPP_TEMPLATE_LANG ?? 'en',
    },
    email: {
      provider: emailProvider,
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.EMAIL_FROM ?? 'Shubh Mangal Savdhan <no-reply@example.com>',
    },
    /** "mock": IDs auto-approve when the name matches (development). "manual": moderators review every ID. */
    kycProvider,
    uploadDir: resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
export const APP_CONFIG = Symbol('APP_CONFIG');
