'use client';

import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import { Alert, Loading, PageTitle, Pager } from '@/components/ui';
import { api, fetcher } from '@/lib/api';
import { formatDate } from '@/lib/labels';

interface Stats {
  testMode: boolean;
  optedIn: { digest: number; shareProfile: number; alerts: number };
  pendingMatches: number;
  last24h: { sent: number; received: number; failed: number };
}
interface WaMessage {
  id: string;
  phone: string;
  direction: 'IN' | 'OUT';
  kind: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
}

function Bubble({ m }: { m: WaMessage }) {
  const out = m.direction === 'OUT';
  return (
    <div className={`flex max-w-[85%] flex-col ${out ? 'self-start' : 'self-end items-end'}`}>
      <p className={`whitespace-pre-line rounded-xl px-3 py-2 text-sm ${out ? 'bg-white text-[#1E1E1E]' : 'bg-[#D6F5C8] text-[#1E1E1E]'}`}>{m.body}</p>
      <span className="text-[11px] text-ink-muted">
        {formatDate(m.createdAt, true)} · {m.kind} · {m.status}
        {m.error && ` · ${m.error}`}
      </span>
    </div>
  );
}

export default function AdminWhatsAppPage() {
  const { data: stats, mutate: refreshStats } = useSWR<Stats>('/admin/whatsapp/stats', fetcher);
  const [phone, setPhone] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: log, mutate: refreshLog } = useSWR<{ items: WaMessage[]; total: number; pageSize: number }>(
    `/admin/whatsapp/messages?page=${page}${filter ? `&phone=${encodeURIComponent(filter)}` : ''}`,
    fetcher,
  );
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function runDigest() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ recipients: number; sent: number }>('/admin/whatsapp/run-digest', { method: 'POST' });
      setMsg({ tone: 'success', text: `Digest run finished: ${r.sent} sent (${r.recipients} members had new matches waiting; Free members get one a week).` });
      refreshStats();
      refreshLog();
    } catch (e) {
      setMsg({ tone: 'danger', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function simulate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api('/admin/whatsapp/simulate', { method: 'POST', json: { phone, text } });
      setText('');
      setFilter(phone);
      setPage(1);
      refreshLog();
      refreshStats();
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!stats) return <Loading />;
  return (
    <>
      <PageTitle title="WhatsApp">
        <button type="button" className="btn-primary" disabled={busy} onClick={runDigest}>
          Send today’s digests now
        </button>
      </PageTitle>
      {stats.testMode && (
        <Alert tone="info">
          Test mode: nothing is sent to real phones. Messages are saved below. Connect a Meta WhatsApp Business account (see README) to send for real.
        </Alert>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
        {[
          ['Get match digests', stats.optedIn.digest],
          ['Appear in digests', stats.optedIn.shareProfile],
          ['Get interest alerts', stats.optedIn.alerts],
          ['Matches waiting to send', stats.pendingMatches],
          ['Sent (24 h)', stats.last24h.sent],
          ['Replies (24 h)', stats.last24h.received],
          ['Failed (24 h)', stats.last24h.failed],
        ].map(([label, value]) => (
          <div key={label} className="card flex flex-col gap-1 p-4">
            <p className="text-sm font-bold text-ink-muted">{label}</p>
            <p className="font-serif text-3xl font-semibold text-maroon">{value}</p>
          </div>
        ))}
      </div>

      {stats.testMode && (
        <form onSubmit={simulate} className="card flex flex-col gap-3 p-5">
          <h2 className="heading text-2xl">Test chat</h2>
          <p className="text-sm text-ink-muted">Reply as a member, exactly as they would on WhatsApp — e.g. “Interested 1”, “1 aur 3 pasand hai”, “Accept”, “More”, “STOP”. This really performs the action for that member.</p>
          <div className="flex flex-wrap gap-3">
            <label className="label w-48">
              Member’s mobile
              <input className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9000000002" />
            </label>
            <label className="label min-w-[200px] flex-1">
              Their message
              <input className="input" required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
          </div>
          <div>
            <button type="submit" className="btn-gold" disabled={busy}>
              Send as member
            </button>
          </div>
        </form>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="heading text-2xl">Messages</h2>
          <label className="label">
            Filter by mobile
            <input
              className="input w-48"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              placeholder="All members"
            />
          </label>
        </div>
        {!log ? (
          <Loading />
        ) : log.items.length === 0 ? (
          <p className="text-sm text-ink-muted">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl bg-[#EFE6D6] p-4">
            {[...log.items].reverse().map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                {!filter && <span className="text-xs font-bold text-ink-muted">+{m.phone}</span>}
                <Bubble m={m} />
              </div>
            ))}
          </div>
        )}
        {log && <Pager page={page} hasMore={page * log.pageSize < log.total} onPage={setPage} />}
      </section>
    </>
  );
}
