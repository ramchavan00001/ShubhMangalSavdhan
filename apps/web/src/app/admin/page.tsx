'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Loading, PageTitle } from '@/components/ui';
import { fetcher } from '@/lib/api';
import { rupees } from '@/lib/labels';

interface Dashboard {
  users: number;
  signupsToday: number;
  signupsThisWeek: number;
  activeLast7Days: number;
  premiumMembers: number;
  pendingProfiles: number;
  pendingVerifications: number;
  pendingPhotos: number;
  openReports: number;
  revenueThisMonthPaise: number;
  netRevenueThisMonthPaise: number;
  revenueTotalPaise: number;
}

function Stat({ label, value, href, sub }: { label: string; value: string | number; href?: string; sub?: string }) {
  const body = (
    <>
      <p className="text-sm font-bold text-ink-muted">{label}</p>
      <p className="font-serif text-4xl font-semibold text-maroon">{value}</p>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card flex flex-col gap-1 p-5 no-underline hover:border-gold">
      {body}
    </Link>
  ) : (
    <div className="card flex flex-col gap-1 p-5">{body}</div>
  );
}

export default function AdminDashboard() {
  const { data } = useSWR<Dashboard>('/admin/dashboard', fetcher, { refreshInterval: 60_000 });
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle title="Dashboard" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        <Stat label="Waiting for approval" value={data.pendingProfiles} href="/admin/approvals" sub={`${data.pendingPhotos} new photos on live profiles`} />
        <Stat label="Verifications to review" value={data.pendingVerifications} href="/admin/verifications" />
        <Stat label="Open reports" value={data.openReports} href="/admin/reports" />
        <Stat label="Members" value={data.users} href="/admin/users" />
        <Stat label="Sign-ups today" value={data.signupsToday} sub={`${data.signupsThisWeek} this week`} />
        <Stat label="Active in last 7 days" value={data.activeLast7Days} />
        <Stat label="Premium members" value={data.premiumMembers} />
        <Stat label="Revenue this month" value={rupees(data.revenueThisMonthPaise)} href="/admin/payments" sub={`${rupees(data.netRevenueThisMonthPaise)} before GST`} />
        <Stat label="Revenue all time" value={rupees(data.revenueTotalPaise)} />
      </div>
    </>
  );
}
