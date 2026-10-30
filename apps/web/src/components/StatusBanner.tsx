'use client';

import Link from 'next/link';
import type { Me } from '@/lib/types';
import { Alert } from './ui';

/** Reminds members their profile is under review / needs changes / is hidden. */
export function StatusBanner({ me }: { me: Me }) {
  const p = me.profile;
  if (!p) return null;
  if (p.status === 'PENDING') {
    return (
      <Alert tone="info">
        Your profile is being reviewed by our team, usually within 24 hours. You can browse now; sending interests and unlocking contacts
        open up once it’s approved.
      </Alert>
    );
  }
  if (p.status === 'REJECTED') {
    return (
      <Alert tone="warning">
        Your profile needs changes{p.rejectionReason ? `: ${p.rejectionReason}` : '.'} <Link href="/me">Edit and resubmit</Link>
      </Alert>
    );
  }
  if (p.hidden) {
    return (
      <Alert tone="info">
        Your profile is hidden, so others can’t find you. <Link href="/settings">Show my profile</Link>
      </Alert>
    );
  }
  return null;
}
