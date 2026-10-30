import type { ReactNode } from 'react';

/** Long-form text page (about, policies, help). */
export function ContentPage({ eyebrow, title, updated, draft, children }: { eyebrow?: string; title: string; updated?: string; draft?: boolean; children: ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-2 border-b border-gold pb-6">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="heading text-4xl sm:text-5xl">{title}</h1>
        {updated && <p className="text-sm text-ink-muted">Last updated: {updated}</p>}
      </header>
      {draft && (
        <p className="border border-gold bg-[#FBF1DC] px-4 py-3 text-sm">
          Draft for review: have a qualified lawyer check this page before launch. Items in [square brackets] need your details.
        </p>
      )}
      <div className="prose-sms flex flex-col gap-4 text-[16px] leading-relaxed text-ink-soft">{children}</div>
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="heading mt-4 text-2xl sm:text-3xl">{children}</h2>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
