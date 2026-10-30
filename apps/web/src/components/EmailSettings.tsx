'use client';

import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { Alert } from './ui';

interface Settings {
  email: string | null;
  pendingEmail: string | null;
  notifyByEmail: boolean;
  testMode: boolean;
}

/** Add/confirm an email address and turn email notifications on or off. */
export function EmailSettings() {
  const { data, mutate } = useSWR<Settings>('/account/notification-settings', fetcher);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  if (!data) return null;

  async function call(path: string, method: 'POST' | 'PUT', json: unknown, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const next = await api<Settings>(path, { method, json });
      await mutate(next, { revalidate: false });
      if (ok) setMsg({ tone: 'success', text: ok });
      return true;
    } catch (e) {
      setMsg({ tone: 'danger', text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function start(e: FormEvent) {
    e.preventDefault();
    if (await call('/account/email', 'POST', { email })) {
      setMsg({ tone: 'info', text: `We sent a 6-digit code to ${email}.${data!.testMode ? ' (Test mode: it is printed in the API log.)' : ''}` });
      setEditing(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (await call('/account/email/verify', 'POST', { code }, 'Email confirmed.')) setCode('');
  }

  return (
    <div className="flex flex-col gap-4">
      {data.email && !editing ? (
        <p className="text-[15px]">
          Email: <strong>{data.email}</strong>{' '}
          <button type="button" className="text-sm text-gold-dark underline" onClick={() => setEditing(true)}>
            Change
          </button>
        </p>
      ) : (
        !data.pendingEmail || editing ? (
          <form onSubmit={start} className="flex flex-wrap items-end gap-3">
            <label className="label min-w-[220px] flex-1">
              {data.email ? 'New email address' : 'Add your email address'}
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <button type="submit" className="btn-outline" disabled={busy}>
              Send code
            </button>
          </form>
        ) : null
      )}
      {data.pendingEmail && !editing && (
        <form onSubmit={confirm} className="flex flex-wrap items-end gap-3">
          <label className="label">
            Code sent to {data.pendingEmail}
            <input className="input w-40 tracking-[0.3em]" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || code.length !== 6}>
            Confirm
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(true)}>
            Use a different email
          </button>
        </form>
      )}
      <label className="flex min-h-[44px] items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 flex-none accent-maroon"
          checked={data.notifyByEmail}
          disabled={busy}
          onChange={(e) => call('/account/notification-settings', 'PUT', { notifyByEmail: e.target.checked })}
        />
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Email me about interests, messages and my plan</span>
          <span className="text-sm text-ink-muted">{data.email ? 'Sent to your confirmed email.' : 'Starts once you confirm an email address.'}</span>
        </span>
      </label>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
