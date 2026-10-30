'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Loading } from '@/components/ui';
import { useRequireMe } from '@/lib/hooks';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/approvals', label: 'Approvals' },
  { href: '/admin/users', label: 'Members' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/whatsapp', label: 'WhatsApp' },
  { href: '/admin/masters', label: 'Dropdown lists' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { ready } = useRequireMe({ admin: true });
  const pathname = usePathname();
  if (!ready) return <Loading />;
  return (
    <div className="container-page flex flex-wrap gap-8 py-10">
      <nav aria-label="Admin" className="w-full md:w-52 md:flex-none">
        <p className="eyebrow mb-3">Admin</p>
        <ul className="flex flex-wrap gap-1 md:flex-col">
          {NAV.map((n) => {
            const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center px-3 font-semibold no-underline ${active ? 'bg-maroon text-ivory hover:text-ivory' : 'text-ink hover:bg-sand'}`}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">{children}</div>
    </div>
  );
}
