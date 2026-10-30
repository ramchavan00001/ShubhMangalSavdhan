'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { ProfilePhoto } from '@/components/ProfileCard';
import { Alert, Empty, Loading } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { useRequireMe } from '@/lib/hooks';
import type { ProfileCard } from '@/lib/types';

interface Msg {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: string;
  readAt?: string | null;
}
interface Thread {
  profile: ProfileCard;
  canSend: boolean;
  reason: string | null;
  hasMore: boolean;
  messages: Msg[];
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ChatThreadPage() {
  const { code } = useParams<{ code: string }>();
  const { me, ready, mutate: refreshMe } = useRequireMe();
  // Poll for new messages every 5 seconds while the thread is open.
  const { data, error, mutate } = useSWR<Thread>(ready ? `/chats/${code}` : null, fetcher, { refreshInterval: 5_000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
    if (count) refreshMe();
  }, [count, refreshMe]);

  if (!ready) return <Loading />;
  if (error) {
    return (
      <div className="container-page max-w-3xl py-12">
        <Empty title="Chat not available" body={(error as Error).message} action={{ href: '/chat', label: 'All chats' }} />
      </div>
    );
  }
  if (!data) return <Loading />;

  const approved = me?.profile?.status === 'APPROVED';

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setSendError(null);
    try {
      const msg = await api<Msg>(`/chats/${code}`, { method: 'POST', json: { body } });
      setText('');
      await mutate((d) => d && { ...d, messages: [...d.messages, msg] }, { revalidate: false });
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const p = data.profile;
  return (
    <div className="container-page flex max-w-3xl flex-col gap-4 py-8">
      <div className="flex items-center gap-4 border-b border-sand-line pb-4">
        <Link href="/chat" className="text-sm" aria-label="All chats">
          ←
        </Link>
        <ProfilePhoto profile={{ ...p, photoLocked: null }} className="h-12 w-12 flex-none rounded-full [&_span]:text-lg" />
        <div className="flex flex-col">
          <Link href={`/profile/${p.code}`} className="font-bold text-ink no-underline hover:text-maroon">
            {p.firstName} {p.lastInitial}
          </Link>
          <span className="text-xs text-ink-muted">{[p.age && `${p.age} yrs`, p.city, p.profession].filter(Boolean).join(' · ')}</span>
        </div>
      </div>

      <div className="card flex min-h-[50vh] flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
        {data.messages.length === 0 && <p className="m-auto text-center text-sm text-ink-muted">No messages yet. A warm namaste is a good start.</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={`flex max-w-[80%] flex-col ${m.fromMe ? 'items-end self-end' : 'items-start self-start'}`}>
            <p className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${m.fromMe ? 'rounded-br-sm bg-maroon text-ivory' : 'rounded-bl-sm bg-sand text-ink'}`}>
              {m.body}
            </p>
            <span className="mt-0.5 text-[11px] text-ink-muted">
              {time(m.createdAt)}
              {m.fromMe && (m.readAt ? ' · Seen' : ' · Sent')}
            </span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {sendError && <Alert tone="danger">{sendError}</Alert>}
      {!approved ? (
        <Alert tone="info">You can send messages once your profile is approved.</Alert>
      ) : data.canSend ? (
        <form onSubmit={send} className="flex gap-2">
          <label htmlFor="msg" className="sr-only">
            Message
          </label>
          <textarea
            id="msg"
            className="input min-h-[48px] flex-1 resize-none"
            rows={1}
            maxLength={1000}
            placeholder="Write a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="btn-primary" disabled={sending || !text.trim()}>
            Send
          </button>
        </form>
      ) : (
        <Alert tone="info">
          {data.reason} <Link href="/plans">See Premium</Link>
        </Alert>
      )}
      <p className="text-xs text-ink-muted">For your safety, phone numbers and emails can’t be shared in chat. Never send money to anyone you meet here.</p>
    </div>
  );
}
