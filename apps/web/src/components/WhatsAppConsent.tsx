'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { Alert } from './ui';

interface Prefs {
  digest: boolean;
  shareProfile: boolean;
  alerts: boolean;
  phone: string;
  testMode: boolean;
}

const ITEMS: { key: 'digest' | 'alerts' | 'shareProfile'; title: string; body: string }[] = [
  {
    key: 'digest',
    title: 'Send me new matches on WhatsApp',
    body: 'A short message with new members who fit you, and whom you fit. Premium: daily · Free: weekly. Reply “Interested 1” to send interest.',
  },
  {
    key: 'alerts',
    title: 'Tell me on WhatsApp when someone is interested',
    body: 'Reply “Accept” or “Decline” right from WhatsApp.',
  },
  {
    key: 'shareProfile',
    title: 'Show my profile in other members’ WhatsApp match alerts',
    body: 'Only your first name, age, height, city, profession and community are shared — never your photo, surname or contact details. Profiles in alerts get noticed much more.',
  },
];

/** WhatsApp opt-ins. Every switch starts off; each change is recorded as consent. */
export function WhatsAppConsent({ source = 'WEB_SETTINGS' }: { source?: 'WEB_SETTINGS' | 'ONBOARDING' }) {
  const { data, mutate } = useSWR<Prefs>('/whatsapp/preferences', fetcher);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  async function toggle(key: keyof Prefs, value: boolean) {
    setError(null);
    try {
      const next = await api<Prefs>('/whatsapp/preferences', { method: 'PUT', json: { [key]: value, source } });
      await mutate(next, { revalidate: false });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Messages go to +{data.phone.slice(0, 2)} {data.phone.slice(2, 7)} {data.phone.slice(7)}. You can stop any time by replying STOP.
      </p>
      {ITEMS.map((it) => (
        <label key={it.key} className="flex min-h-[44px] items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-maroon" checked={data[it.key]} onChange={(e) => toggle(it.key, e.target.checked)} />
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{it.title}</span>
            <span className="text-sm text-ink-muted">{it.body}</span>
          </span>
        </label>
      ))}
      {data.testMode && <p className="text-xs text-ink-muted">Test mode: WhatsApp messages are saved for the admin team instead of being sent.</p>}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
