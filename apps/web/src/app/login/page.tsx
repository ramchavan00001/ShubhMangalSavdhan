'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import type { Me } from '@/lib/types';

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isSignup = params.get('signup') === '1';
  const next = safeNext(params.get('next'));
  const { me, mutate } = useMe();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (me) router.replace(me.profile?.status === 'DRAFT' && me.role !== 'ADMIN' ? '/onboarding' : next ?? '/matches');
  }, [me, next, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ devMode: boolean }>('/auth/otp/request', { method: 'POST', json: { phone } });
      setDevMode(r.devMode);
      setStep('code');
      setResendIn(30);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ isNew: boolean; me: Me }>('/auth/otp/verify', { method: 'POST', json: { phone, code } });
      await mutate(r.me, { revalidate: false });
      const unfinished = r.me.role !== 'ADMIN' && r.me.profile?.status === 'DRAFT';
      router.replace(unfinished ? '/onboarding' : r.me.role === 'ADMIN' && !next ? '/admin' : next ?? '/matches');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="frame-double flex flex-col gap-5 bg-ivory-card p-7 sm:p-9">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{isSignup ? 'Register free' : 'Welcome back'}</p>
          <h1 className="heading text-4xl">{step === 'phone' ? (isSignup ? 'Create your account' : 'Log in') : 'Enter the OTP'}</h1>
          <p className="text-[15px] text-ink-muted">
            {step === 'phone'
              ? 'We’ll send a one-time password to your mobile number. No password to remember.'
              : `We sent a 6-digit code to +91 ${phone.replace(/\D/g, '').slice(-10)}.`}
          </p>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {step === 'code' && devMode && (
          <Alert tone="info">Development mode: the OTP is printed in the API server log instead of being sent by SMS.</Alert>
        )}

        {step === 'phone' ? (
          <form onSubmit={requestOtp} className="flex flex-col gap-4">
            <label className="label">
              Mobile number
              <div className="flex">
                <span className="flex min-h-[46px] items-center border border-r-0 border-sand-input bg-sand px-3 text-[15px] text-ink">+91</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </label>
            {isSignup && (
              <label className="flex items-start gap-3 text-sm leading-snug text-ink-soft">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-maroon" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                <span>
                  I am creating this profile for marriage, and I agree to the <Link href="/terms">Terms</Link> and{' '}
                  <Link href="/privacy">Privacy Policy</Link>.
                </span>
              </label>
            )}
            <button type="submit" className="btn-primary py-3.5" disabled={busy || (isSignup && !consent)}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-4">
            <label className="label">
              6-digit OTP
              <input
                className="input text-center text-2xl tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button type="submit" className="btn-primary py-3.5" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-gold-dark underline" onClick={() => { setStep('phone'); setCode(''); setError(null); }}>
                Change number
              </button>
              <button type="button" className="text-gold-dark underline disabled:no-underline disabled:opacity-60" disabled={resendIn > 0 || busy} onClick={() => requestOtp()}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
      <p className="text-center text-sm text-ink-muted">
        {isSignup ? (
          <>
            Already registered? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href={`/login?signup=1${next ? `&next=${encodeURIComponent(next)}` : ''}`}>Register free</Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
