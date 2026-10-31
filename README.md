# Shubh Mangal Savdhan

Matrimony for every community. One free plan and one Universal Premium plan at ₹150 + GST a month.

This repository holds the Phase 1 MVP:

| Folder | What it is | Tech |
|---|---|---|
| `apps/api` | Backend API | NestJS 11, Prisma 6, PostgreSQL 16 |
| `apps/web` | Website and admin panel | Next.js 15, React 19, Tailwind CSS |

The browser only ever talks to the website. The website forwards `/api/*` to the API, so the login cookie stays first-party and no CORS setup is needed.

## Run it locally

You need **Node.js 20+** and **PostgreSQL 16**. The easiest way to get PostgreSQL is Docker.

```bash
docker compose up -d          # starts PostgreSQL on localhost:5432
```

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/api/.env` and set `JWT_SECRET` to a long random value (`openssl rand -hex 32`), and put your own mobile number in `ADMIN_PHONES` (format `91XXXXXXXXXX`).

```bash
npm run db:migrate            # creates the tables
```

```bash
SEED_DEMO=true npm run db:seed   # dropdown lists, your admin account, and 8 demo profiles
```

```bash
npm run dev                   # API on :4000, website on http://localhost:3000
```

In development:

- **OTPs are not sent by SMS.** They are printed in the API terminal (`OTP_PROVIDER=console`).
- **Payments are simulated.** Checkout shows a "Complete test payment" button (`PAYMENTS_MODE=mock`).
- **WhatsApp messages are saved, not sent** (`WHATSAPP_PROVIDER=console`). See them, send today's digests, and reply as a member in **Admin → WhatsApp**.
- **Emails are printed to the API log** (`EMAIL_PROVIDER=console`).
- **IDs auto-approve when the name matches** (`KYC_PROVIDER=mock`); selfies always go to **Admin → Verifications**.
- **AI features are off** until `ANTHROPIC_API_KEY` is set (writing assistant, photo pre-screening, WhatsApp reply fallback).
- Demo members log in with phone numbers `9000000001`–`9000000004` (women) and `9000000011`–`9000000014` (men).

## Tests

```bash
npm test                      # unit tests: quota weeks, pricing/GST, age rules, matching, storage, cron auth
```

```bash
API_LOG=/path/to/api.log apps/api/scripts/smoke.sh
```

The smoke test runs 65 end-to-end checks against a running API: signup, the profile wizard, admin approval, matching, interests, weekly contact limits, payment, invoices, parallel unlock attempts, hide and block, chat, the WhatsApp digest and replies, verification and email. It needs a freshly seeded database and the API's log written to `API_LOG`, so it can read OTPs.

## How the main rules work

| Rule | Where it lives |
|---|---|
| Free: 1 contact unlock a week, 5 interests a day | `apps/api/src/domain/plans.ts` |
| Premium: 4 unlocks a week (16 a month), ₹150 + 18% GST | `apps/api/src/domain/plans.ts` |
| Weeks count from the signup date (Free) or payment date (Premium); unused unlocks expire | `apps/api/src/domain/quota.ts` |
| A premium month never gets a 5th week, even in 31-day months | `apps/api/src/domain/quota.ts` |
| Matches are mutual: they fit your preferences and you fit theirs | `apps/api/src/matches/match-filters.ts` |
| Legal minimum age: 18 for women, 21 for men | `apps/api/src/domain/age.ts` |
| CGST + SGST for the same state, IGST otherwise | `apps/api/src/domain/gst.ts` |
| Chat: Premium starts, Free replies; no phone numbers or emails | `apps/api/src/chat/chat.controller.ts` |
| WhatsApp: opt-in only, consent log, 5 matches per digest, Premium daily / Free weekly | `apps/api/src/whatsapp/whatsapp.service.ts` |
| WhatsApp replies in English, Hinglish, Hindi, Marathi | `apps/api/src/domain/whatsapp-intent.ts` |
| ID numbers checked then discarded (last 4 kept); no Aadhaar except via DigiLocker | `apps/api/src/domain/id-docs.ts` |

## Before going live

1. **Business:** register the business and get a GSTIN. Fill in `BUSINESS_*` in the API environment. Confirm the SAC code with your CA.
2. **SMS:** create an MSG91 account, register the OTP template on DLT, then set `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY` and `MSG91_OTP_TEMPLATE_ID`.
3. **Payments:** activate Razorpay and set `PAYMENTS_MODE=razorpay` plus the key ID and secret. Add a webhook pointing to `https://<your-domain>/api/payments/webhook` (events: `payment.captured`, `order.paid`, `payment.failed`) and set `RAZORPAY_WEBHOOK_SECRET`.
4. **WhatsApp:** verify a Meta Business account, register a dedicated number, then set `WHATSAPP_PROVIDER=meta`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN`. Point the webhook at `https://<your-domain>/api/whatsapp/webhook` (field: `messages`). Submit these two **Utility** templates in WhatsApp Manager:
   - `new_matches`: `Namaste {{1}} ji, {{2}} new matches joined for you today: {{3}}. Reply "Interested 1" to send interest, or view them at {{4}}. Reply STOP to stop these messages.`
   - `interest_received`: `{{1}} ({{2}}) is interested in you. Reply "Accept" or "Decline", or view the profile: {{3}}`
5. **Email:** set `EMAIL_PROVIDER=smtp` and the `SMTP_*` / `EMAIL_FROM` values from your email provider (Zoho Mail, Google Workspace, Amazon SES…).
6. **Verification:** set `KYC_PROVIDER=manual` (required in production) until a KYC provider such as DigiLocker, IDfy or HyperVerge is connected.
7. **AI:** create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY`. Photo pre-screening runs once per upload; to cut cost, set `AI_MODEL` to a smaller Claude model.
8. **Legal:** have a lawyer review the draft Privacy Policy, Terms, Refund Policy and Contact pages, and fill in every `[bracketed]` item.
9. **Hosting:** Google Cloud / Firebase, see [Hosting on Google Cloud](#hosting-on-google-cloud).

## Hosting on Google Cloud

| Part | Service | Region |
|---|---|---|
| Website (`apps/web`) | Firebase App Hosting, backend `sms-web` | asia-southeast1 (App Hosting has no Mumbai region) |
| API (`apps/api`) | Cloud Run service `sms-api` (image from `apps/api/Dockerfile`) | asia-south1 |
| Database | Cloud SQL for PostgreSQL 16, instance `sms-db` | asia-south1 |
| Photos and selfies | Firebase Storage bucket, private (`storage.rules` denies all client access) | asia-south1 |
| Daily jobs | Cloud Scheduler → `POST /cron/daily-maintenance`, `POST /cron/whatsapp-digests` (09:00 IST) | asia-south1 |
| Secrets | Secret Manager (`sms-*`) | asia-south1 |

Everything lives in `deploy/` (shared names in `deploy/config.sh`):

```bash
bash deploy/01-setup.sh          # APIs, image repository, service accounts, bucket permissions (free)
```

```bash
bash deploy/02-cloudsql.sh       # PAID: Cloud SQL instance + DATABASE_URL secret
```

```bash
bash deploy/03-secrets.sh        # JWT secret; MSG91/Razorpay/WhatsApp/SMTP/Anthropic keys when you have them
```

Edit `deploy/api.env.yaml` (admin phones, business details, providers), then build, migrate and deploy the API:

```bash
gcloud builds submit --region=asia-south1 --config=deploy/cloudbuild.api.yaml .
```

```bash
gcloud run jobs execute sms-api-seed --region=asia-south1 --wait    # first release only: dropdown lists + admin accounts
```

```bash
bash deploy/04-scheduler.sh      # daily jobs
```

Website: in the Firebase console → App Hosting, create backend `sms-web` in asia-southeast1, connect this GitHub repository, set the app root directory to `apps/web` and the live branch to `main`. Settings come from `apps/web/apphosting.yaml`; every push to `main` deploys. Then set `WEB_URL` in `deploy/api.env.yaml` to the site's URL and redeploy the API.

How the pieces fit:

- **Photos** use `STORAGE_DRIVER=gcs`; `apps/api/src/photos/storage.service.ts` has a local-disk and a Cloud Storage driver. Browsers never touch the bucket; the API streams files after its privacy checks.
- **Daily jobs** use `SCHEDULER_MODE=external`: the in-process timers switch off and Cloud Scheduler calls `/cron/*` with a Google OIDC token. The API accepts only tokens for `CRON_AUDIENCE` signed for `CRON_INVOKER_EMAIL`.
- **Migrations** run on every deploy as the Cloud Run job `sms-api-migrate` (`prisma migrate deploy`), before traffic moves to the new version.
- Production refuses to start with console OTPs, mock payments or mock KYC, so set MSG91 and Razorpay before the first deploy.

## Project layout

```
apps/api/
  prisma/schema.prisma      database tables
  prisma/seed.ts            dropdown lists, admin accounts, demo data
  src/domain/               plan rules, quota weeks, GST, age, matching (pure, unit-tested)
  src/auth/                 OTP login and sessions
  src/profiles/             profile wizard, privacy, profile pages
  src/photos/               uploads and photo privacy
  src/matches/              matches and search
  src/interactions/         interests, contact unlocks, shortlist/block, reports
  src/billing/              Razorpay, subscriptions, GST invoices, expiry reminders
  src/admin/                admin panel API
  src/chat/                 member-to-member chat
  src/whatsapp/             consent, digests, alerts, reply assistant, Meta webhook
  src/verification/         ID and selfie verification
  src/account/              verified email and email notifications
  src/ai/                   Claude: writing assistant, photo pre-screening, reply fallback
  src/cron/                 Cloud Scheduler endpoints (daily jobs)
apps/web/src/
  app/                      one folder per page (admin pages under app/admin)
  components/               header, profile cards, forms, quota meter…
  lib/                      API client, types, labels
deploy/                     Google Cloud setup scripts, Cloud Build pipeline, API environment
```

## What's next (Phase 3)

AI natural-language search, smart match ranking, chat scam detection, icebreakers, auto-translation, full kundli (Guna Milan), browser push notifications and an AI support chatbot.
