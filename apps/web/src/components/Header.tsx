'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { Bell, BrandMark, Close, Menu } from './icons';

const MEMBER_LINKS = [
  { href: '/matches', label: 'Matches' },
  { href: '/search', label: 'Search' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/chat', label: 'Chat' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/plans', label: 'Plans' },
];

const PUBLIC_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/plans', label: 'Plans' },
  { href: '/safety', label: 'Safety' },
];

export function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 no-underline sm:gap-3">
      <BrandMark className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap font-serif text-[17px] font-bold tracking-wide text-gold-light sm:text-[26px]">Shubh Mangal Savdhan</span>
        <span className="font-deva text-xs text-gold sm:text-sm" lang="hi">
          शुभ मंगल सावधान
        </span>
      </span>
    </Link>
  );
}

export function Header() {
  const { me, mutate } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = me ? MEMBER_LINKS : PUBLIC_LINKS;

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    await mutate(null, { revalidate: false });
    router.push('/');
  }

  return (
    <header className="border-b border-gold bg-maroon-deep">
      <div className="container-page flex items-center justify-between gap-2 py-4 sm:gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] font-semibold lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? 'page' : undefined}
              className={`no-underline hover:text-gold ${pathname.startsWith(l.href) ? 'text-gold' : 'text-gold-light'}`}
            >
              {l.label}
              {l.href === '/chat' && !!me?.unreadMessages && (
                <span className="badge ml-1.5 bg-gold text-maroon-deep" aria-label={`${me.unreadMessages} unread`}>
                  {me.unreadMessages}
                </span>
              )}
            </Link>
          ))}
          {me?.role === 'ADMIN' && (
            <Link href="/admin" className="text-gold-light no-underline hover:text-gold">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {me ? (
            <>
              <Link href="/notifications" aria-label={`Notifications${me.unreadNotifications ? `, ${me.unreadNotifications} unread` : ''}`} className="relative flex h-11 w-11 items-center justify-center text-gold-light hover:text-gold">
                <Bell />
                {me.unreadNotifications > 0 && (
                  <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-maroon-deep">
                    {me.unreadNotifications > 9 ? '9+' : me.unreadNotifications}
                  </span>
                )}
              </Link>
              <Link href="/me" className="btn-outline-gold hidden sm:inline-flex">
                My profile
              </Link>
              <button type="button" onClick={logout} className="btn-ghost hidden text-gold-light hover:bg-maroon hover:text-gold-light lg:inline-flex">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-outline-gold hidden sm:inline-flex">
                Log in
              </Link>
              <Link href="/login?signup=1" className="btn-gold whitespace-nowrap px-3 text-sm sm:px-5 sm:text-[15px]">
                Register<span className="hidden sm:inline">&nbsp;free</span>
              </Link>
            </>
          )}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-gold-light lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-maroon-soft lg:hidden">
          <ul className="container-page flex flex-col py-2">
            {[...links, ...(me ? [{ href: '/me', label: 'My profile' }, { href: '/verify', label: 'Get verified' }, { href: '/settings', label: 'Settings' }] : [{ href: '/login', label: 'Log in' }])].map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block py-3 font-semibold text-gold-light no-underline">
                  {l.label}
                </Link>
              </li>
            ))}
            {me?.role === 'ADMIN' && (
              <li>
                <Link href="/admin" onClick={() => setOpen(false)} className="block py-3 font-semibold text-gold-light no-underline">
                  Admin
                </Link>
              </li>
            )}
            {me && (
              <li>
                <button type="button" onClick={logout} className="block w-full py-3 text-left font-semibold text-gold-light">
                  Log out
                </button>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
