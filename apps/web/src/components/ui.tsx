'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    info: 'border-gold bg-[#FBF1DC] text-ink',
    danger: 'border-danger bg-danger-bg text-danger',
    success: 'border-success bg-success-bg text-success',
    warning: 'border-gold-dark bg-[#FBF1DC] text-ink',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="heading text-4xl sm:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center py-20 text-ink-muted">
      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h2 className="font-serif text-2xl font-semibold text-maroon">{title}</h2>
      {body && <p className="max-w-md text-[15px] text-ink-muted">{body}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-sand-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`min-h-[44px] whitespace-nowrap border-b-2 px-4 text-[15px] font-bold ${
            value === t.value ? 'border-maroon text-maroon' : 'border-transparent text-ink-muted hover:text-maroon'
          }`}
        >
          {t.label}
          {t.count ? <span className="badge ml-2 bg-gold text-maroon-deep">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, hasMore, onPage }: { page: number; hasMore: boolean; onPage: (p: number) => void }) {
  if (page === 1 && !hasMore) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-sm text-ink-muted">Page {page}</span>
      <button type="button" className="btn-outline" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

/** Chip-style multi-select for preferences and filters. Empty selection means "any". */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Any',
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const remaining = options.filter((o) => !value.includes(o.value));
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-bold text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && <span className="py-1 text-sm text-ink-muted">{placeholder}</span>}
        {value.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-maroon px-3 text-sm font-semibold text-ivory"
            aria-label={`Remove ${labelOf(v)}`}
          >
            {labelOf(v)} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      {remaining.length > 0 && (
        <select
          className="input mt-1"
          value=""
          aria-label={`Add ${label}`}
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        >
          <option value="">+ Add {label.toLowerCase()}</option>
          {remaining.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </fieldset>
  );
}

export function opts(list: string[]) {
  return list.map((v) => ({ value: v, label: v }));
}

export function enumOpts(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
