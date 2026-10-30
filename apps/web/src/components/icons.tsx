import type { SVGProps } from 'react';

/** Stroke icons in the Royal Heritage style. Decorative by default (aria-hidden). */
function Icon({ children, size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

export const ShieldCheck = (p: P) => (
  <Icon {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);
export const Chat = (p: P) => (
  <Icon {...p}>
    <path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" />
    <path d="M9 10h6M9 13h4" />
  </Icon>
);
export const Star = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
  </Icon>
);
export const People = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="9" r="3" />
    <circle cx="16" cy="9" r="3" />
    <path d="M2.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M10.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
  </Icon>
);
export const Heart = (p: P) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" />
  </Icon>
);
export const Bookmark = (p: P) => (
  <Icon {...p}>
    <path d="M6 4h12v16l-6-4-6 4z" />
  </Icon>
);
export const Bell = (p: P) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
);
export const Phone = (p: P) => (
  <Icon {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Icon>
);
export const Lock = (p: P) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="10" rx="1" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);
export const Check = (p: P) => (
  <Icon {...p}>
    <path d="M5 12l5 5 9-10" />
  </Icon>
);
export const Close = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const Menu = (p: P) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const Search = (p: P) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Icon>
);
export const Camera = (p: P) => (
  <Icon {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
export const Flag = (p: P) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Icon>
);
export const Block = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
);

/** Two interlocking rings inside a dotted circle — the brand mark. */
export function BrandMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" stroke="#C9A24B" strokeWidth="1.5" aria-hidden="true" className={className}>
      <circle cx="17" cy="22" r="10" />
      <circle cx="27" cy="22" r="10" />
      <circle cx="22" cy="22" r="20" strokeDasharray="2 3" />
    </svg>
  );
}

/** Faint gold mandala used behind hero sections. */
export function Mandala({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="#C9A24B" strokeOpacity="0.18" strokeWidth="0.6" aria-hidden="true" className={className}>
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="80" />
      <circle cx="100" cy="100" r="64" />
      <circle cx="100" cy="100" r="40" />
      <path d="M100 4 L100 196 M4 100 L196 100 M32 32 L168 168 M168 32 L32 168" />
      <circle cx="100" cy="36" r="16" />
      <circle cx="100" cy="164" r="16" />
      <circle cx="36" cy="100" r="16" />
      <circle cx="164" cy="100" r="16" />
    </svg>
  );
}
