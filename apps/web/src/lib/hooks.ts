'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';
import { ApiError, fetcher } from './api';
import type { Masters, Me } from './types';

/** The logged-in member, or null when logged out. */
export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<Me | null>(
    '/auth/me',
    async (path: string) => {
      try {
        return await fetcher<Me>(path);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    { revalidateOnFocus: true },
  );
  return { me: data ?? null, loading: isLoading, error, mutate };
}

/**
 * Guards a page. Sends logged-out visitors to /login, unfinished profiles to the wizard,
 * and non-admins away from admin pages.
 */
export function useRequireMe(opts: { needsProfile?: boolean; admin?: boolean } = {}) {
  const { me, loading, mutate } = useMe();
  const router = useRouter();
  const needsProfile = opts.needsProfile ?? true;

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    } else if (opts.admin && me.role !== 'ADMIN') {
      router.replace('/');
    } else if (needsProfile && me.role !== 'ADMIN' && me.profile?.status === 'DRAFT') {
      router.replace('/onboarding');
    }
  }, [me, loading, needsProfile, opts.admin, router]);

  const ready =
    !loading && !!me && (!opts.admin || me.role === 'ADMIN') && (!needsProfile || me.role === 'ADMIN' || me.profile?.status !== 'DRAFT');
  return { me, ready, mutate };
}

export function useMasters() {
  const { data } = useSWR<Masters>('/masters', fetcher, { revalidateOnFocus: false });
  return data;
}

export function values(masters: Masters | undefined, type: keyof Masters, parent?: string | null) {
  const list = masters?.[type] ?? [];
  return (parent ? list.filter((m) => m.parent === parent) : list).map((m) => m.value);
}
