'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import { Loading, PageTitle, Pager } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { formatDate } from '@/lib/labels';

interface UserRow {
  id: string;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
  premium: boolean;
  profile: { code: string; name: string; gender: string | null; city: string | null; status: string } | null;
}

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [status, setStatus] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (applied) params.set('q', applied);
  if (status) params.set('status', status);
  if (profileStatus) params.set('profileStatus', profileStatus);
  const { data } = useSWR<{ items: UserRow[]; total: number; page: number; pageSize: number }>(`/admin/users?${params}`, fetcher);

  function search(e: FormEvent) {
    e.preventDefault();
    setApplied(q.trim());
    setPage(1);
  }

  return (
    <>
      <PageTitle title="Members" />
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="label flex-1">
          Search
          <input className="input" placeholder="Name, phone or profile ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="label">
          Account
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
          </select>
        </label>
        <label className="label">
          Profile
          <select className="input" value={profileStatus} onChange={(e) => { setProfileStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="DRAFT">Incomplete</option>
            <option value="PENDING">Pending review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Needs changes</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>
      {!data ? (
        <Loading />
      ) : (
        <>
          <p className="text-sm text-ink-muted">{data.total} members</p>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-sand">
                <tr>
                  <th className="p-3">Member</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Profile</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-t border-sand-line">
                    <td className="p-3">
                      <Link href={`/admin/users/${u.id}`} className="font-semibold">
                        {u.profile?.name ?? '—'}
                      </Link>
                      <div className="text-xs text-ink-muted">
                        {u.profile?.code} {u.role === 'ADMIN' && '· Admin'}
                      </div>
                    </td>
                    <td className="p-3">+{u.phone}</td>
                    <td className="p-3">{u.profile?.status ?? '—'}</td>
                    <td className="p-3">{u.status}</td>
                    <td className="p-3">{u.premium ? 'Premium' : 'Free'}</td>
                    <td className="p-3">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} hasMore={page * data.pageSize < data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
