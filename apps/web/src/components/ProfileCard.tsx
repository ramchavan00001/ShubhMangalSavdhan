import Link from 'next/link';
import type { ReactNode } from 'react';
import { mediaUrl } from '@/lib/api';
import { feetInches } from '@/lib/labels';
import type { ProfileCard as Card } from '@/lib/types';
import { Lock } from './icons';

function initials(p: Card) {
  return `${p.firstName?.[0] ?? ''}${p.lastInitial?.[0] ?? ''}`.toUpperCase() || '—';
}

/** Photo, or the member's initials on sand when there's no visible photo. */
export function ProfilePhoto({ profile, className = 'h-[260px]' }: { profile: Card; className?: string }) {
  const src = mediaUrl(profile.photo);
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-sand-photo ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Photo of ${profile.firstName ?? 'member'}`} className="h-full w-full object-cover" />
      ) : (
        <span className="font-serif text-6xl text-gold-dark" aria-hidden="true">
          {initials(profile)}
        </span>
      )}
      {profile.photoLocked && (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-maroon-deep/85 px-2 py-2 text-xs font-semibold text-gold-light">
          <Lock size={14} /> {profile.photoLocked}
        </span>
      )}
    </div>
  );
}

export function ProfileCard({ profile, children }: { profile: Card; children?: ReactNode }) {
  const href = `/profile/${profile.code}`;
  return (
    <article className="card flex flex-col">
      <Link href={href} className="no-underline" aria-label={`View ${profile.firstName ?? 'profile'}`}>
        <ProfilePhoto profile={profile} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[19px] font-bold">
            <Link href={href} className="text-ink no-underline hover:text-maroon">
              {profile.firstName} {profile.lastInitial}
            </Link>
          </h3>
          {profile.isNew && <span className="badge bg-gold text-maroon-deep">New</span>}
        </div>
        <p className="text-sm leading-normal text-ink-muted">
          {[profile.age && `${profile.age} yrs`, profile.heightCm && feetInches(profile.heightCm), profile.city].filter(Boolean).join(' · ')}
          <br />
          {[profile.profession, profile.motherTongue].filter(Boolean).join(' · ')}
          <br />
          {[profile.religion, profile.community].filter(Boolean).join(' · ')}
        </p>
        <p className="text-xs font-bold text-gold-dark">
          {profile.matchPercent}% match with your preferences · {profile.code}
        </p>
        {children && <div className="mt-auto flex flex-col gap-2 pt-2">{children}</div>}
      </div>
    </article>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-6">{children}</div>;
}
