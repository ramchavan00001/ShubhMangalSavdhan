import Link from 'next/link';
import { Chat, Mandala, People, ShieldCheck, Star } from '@/components/icons';
import { PlanCards } from '@/components/PlanCards';
import { QuickSearch } from '@/components/QuickSearch';

const TRUST = [
  { icon: ShieldCheck, title: 'Every profile reviewed', body: 'Our team checks each profile and photo before it goes live.' },
  { icon: Chat, title: 'Matches on WhatsApp', body: 'Daily matches on WhatsApp, coming soon. Reply to send interest.' },
  { icon: Star, title: 'Kundli details', body: 'Add manglik status today; full Guna Milan matching is on its way.' },
  { icon: People, title: 'Every community', body: 'One platform, one plan, no community add-ons.' },
];

const STEPS = [
  { title: 'Create a profile', body: 'For yourself or a family member, in about ten minutes.' },
  { title: 'Get approved', body: 'Our team reviews your profile and photos to keep the site genuine.' },
  { title: 'Receive matches', body: 'See people who fit you, and whose preferences you fit too.' },
  { title: 'Connect families', body: 'Send interest, and unlock contact details every week.' },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-maroon">
        <Mandala className="pointer-events-none absolute -right-40 -top-32 h-[640px] w-[640px]" />
        <div className="container-page relative flex flex-wrap items-center gap-14 py-16 sm:py-24">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            <p className="eyebrow text-gold">Matrimony for every community</p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.02] text-ivory sm:text-[72px]">
              Where families meet, and forever begins.
            </h1>
            <p className="max-w-[520px] text-lg leading-relaxed text-blush">
              Reviewed profiles, matches that work both ways, and one honest plan for everyone: ₹150 a month.
            </p>
            <div className="flex flex-wrap gap-3.5 pt-2">
              <Link href="/login?signup=1" className="btn-gold px-8 py-4 text-base">
                Create your profile
              </Link>
              <Link href="/how-it-works" className="btn-outline-gold px-8 py-4 text-base">
                How it works
              </Link>
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_380px] justify-center">
            <QuickSearch />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-sand-line">
        <div className="container-page grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-7 py-10">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3.5">
              <Icon size={32} className="shrink-0 text-gold-dark" />
              <div>
                <p className="text-base font-bold">{title}</p>
                <p className="mt-1 text-sm leading-normal text-ink-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="container-page flex flex-col gap-12 py-20 sm:py-24">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="eyebrow">How it works</p>
            <h2 className="heading text-4xl sm:text-[52px]">Four steps to the right family</h2>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2.5 border-t border-gold pt-6">
                <span className="font-serif text-[44px] leading-none text-gold-dark">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-[19px] font-bold">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* WhatsApp (Phase 2) */}
      <section className="bg-maroon-deep">
        <div className="container-page flex flex-wrap items-center gap-14 py-20 sm:py-24">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
            <p className="eyebrow text-gold">Coming soon</p>
            <h2 className="font-serif text-4xl font-semibold leading-tight text-ivory sm:text-[52px]">
              Your matches will arrive with your morning chai.
            </h2>
            <p className="text-[17px] leading-relaxed text-blush">
              Opt in and get a short WhatsApp message with new profiles that fit you, and who you fit. Reply in English, Hindi or
              Marathi. Photos and phone numbers are never shared there.
            </p>
          </div>
          <div aria-hidden="true" className="flex min-w-0 max-w-[420px] flex-[1_1_360px] flex-col gap-3 rounded-3xl bg-[#EFE6D6] p-6">
            <div className="max-w-[92%] self-start rounded-[4px_14px_14px_14px] bg-white px-4 py-3.5 text-sm leading-relaxed text-[#1E1E1E]">
              <strong>Shubh Mangal Savdhan</strong>
              <br />
              Namaste ji, 3 new matches joined for you today:
              <br />
              <br />
              1. [Name], 27 · Pune · Engineer
              <br />
              2. [Name], 26 · Mumbai · Doctor
              <br />
              3. [Name], 28 · Nashik · CA
              <br />
              <br />
              Reply &quot;Interested 1&quot; to send interest.
            </div>
            <div className="self-end rounded-[14px_4px_14px_14px] bg-[#D6F5C8] px-4 py-3 text-sm text-[#1E1E1E]">1 aur 3 pasand hai</div>
            <div className="max-w-[92%] self-start rounded-[4px_14px_14px_14px] bg-white px-4 py-3 text-sm text-[#1E1E1E]">
              Done. Interest sent to both. We&apos;ll tell you when they reply.
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section>
        <div className="mx-auto flex max-w-[1000px] flex-col gap-12 px-4 py-20 sm:px-6 sm:py-24">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="eyebrow">Plans</p>
            <h2 className="heading text-4xl sm:text-[52px]">Simple, for every community</h2>
          </div>
          <PlanCards />
        </div>
      </section>

      {/* Stories */}
      <section className="bg-sand">
        <div className="container-page flex flex-col items-center gap-5 py-20 text-center">
          <h2 className="heading text-4xl sm:text-[52px]">Rishtey that begin here</h2>
          <p className="max-w-xl text-[17px] leading-relaxed text-ink-muted">
            We&apos;re just getting started. When you find your match on Shubh Mangal Savdhan, we&apos;d be honoured to share your story here.
          </p>
          <Link href="/login?signup=1" className="btn-primary px-8 py-4 text-base">
            Begin your story
          </Link>
        </div>
      </section>
    </>
  );
}
