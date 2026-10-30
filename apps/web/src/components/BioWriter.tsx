'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { Alert } from './ui';

const QUESTIONS = [
  { key: 'personality', label: 'Describe the personality in a few words', placeholder: 'e.g. calm, cheerful, a good listener' },
  { key: 'interests', label: 'Hobbies and interests', placeholder: 'e.g. trekking, cooking, Marathi theatre' },
  { key: 'family', label: 'Family and values', placeholder: 'e.g. close-knit joint family, traditional but open-minded' },
  { key: 'career', label: 'Work and ambitions', placeholder: 'e.g. software engineer, wants to start a company one day' },
  { key: 'partner', label: 'What you hope for in a life partner', placeholder: 'e.g. kind, family-oriented, likes to travel' },
] as const;

type Answers = Record<(typeof QUESTIONS)[number]['key'], string>;

/** "Help me write": five short answers → a drafted About me the member can edit. */
export function BioWriter({ onDraft }: { onDraft: (text: string) => void }) {
  const { data: status } = useSWR<{ enabled: boolean }>('/ai/status', fetcher, { revalidateOnFocus: false });
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');
  const [answers, setAnswers] = useState<Answers>({ personality: '', interests: '', family: '', career: '', partner: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status?.enabled) return null;

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ aboutMe: string; partnerExpectations: string }>('/ai/bio', { method: 'POST', json: { language, answers } });
      const heading = { en: 'Looking for:', hi: 'जीवनसाथी से अपेक्षाएँ:', mr: 'जोडीदाराकडून अपेक्षा:' }[language];
      onDraft(`${r.aboutMe}\n\n${heading} ${r.partnerExpectations}`);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-outline self-start text-sm" onClick={() => setOpen(true)}>
        Help me write this
      </button>
    );
  }

  return (
    // A div, not a form: this sits inside the wizard's own form.
    <div
      className="flex flex-col gap-3 border border-gold bg-[#FBF1DC] p-4"
      role="group"
      aria-label="Writing assistant"
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && e.preventDefault()}
    >
      <p className="text-sm text-ink-soft">Answer in a few words — our writing assistant drafts a description you can then edit. Only general details are used, never contact details or surname.</p>
      {QUESTIONS.map((q) => (
        <label key={q.key} className="label">
          {q.label}
          <input className="input" maxLength={400} placeholder={q.placeholder} value={answers[q.key]} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
        </label>
      ))}
      <label className="label max-w-xs">
        Write it in
        <select className="input" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'hi' | 'mr')}>
          <option value="en">English</option>
          <option value="hi">हिन्दी (Hindi)</option>
          <option value="mr">मराठी (Marathi)</option>
        </select>
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={busy || Object.values(answers).every((v) => !v.trim())} onClick={write}>
          {busy ? 'Writing…' : 'Write my description'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
