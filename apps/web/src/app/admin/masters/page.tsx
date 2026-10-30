'use client';

import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import { Alert, Loading, PageTitle } from '@/components/ui';
import { api, fetcher } from '@/lib/api';

const TYPES = {
  RELIGION: 'Religions',
  COMMUNITY: 'Communities',
  MOTHER_TONGUE: 'Mother tongues',
  EDUCATION: 'Education',
  PROFESSION: 'Professions',
  INCOME: 'Income bands',
  STATE: 'States',
} as const;
type MasterType = keyof typeof TYPES;

interface Item {
  id: string;
  type: MasterType;
  value: string;
  parent: string | null;
  sortOrder: number;
  active: boolean;
}

export default function AdminMastersPage() {
  const [type, setType] = useState<MasterType>('RELIGION');
  const { data, mutate } = useSWR<Item[]>(`/admin/masters?type=${type}`, fetcher);
  const { data: religions } = useSWR<Item[]>('/admin/masters?type=RELIGION', fetcher);
  const [value, setValue] = useState('');
  const [parent, setParent] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/admin/masters', {
        method: 'POST',
        json: { type, value, parent: type === 'COMMUNITY' ? parent : undefined, sortOrder: (data?.length ?? 0) + 1 },
      });
      setValue('');
      mutate();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(item: Item) {
    await api(`/admin/masters/${item.id}`, { method: 'PATCH', json: { active: !item.active } });
    mutate();
  }

  return (
    <>
      <PageTitle title="Dropdown lists" />
      <p className="text-sm text-ink-muted">These lists power the profile form and search filters. Turning an item off hides it for new choices; existing profiles keep their value.</p>
      <label className="label max-w-xs">
        List
        <select className="input" value={type} onChange={(e) => setType(e.target.value as MasterType)}>
          {Object.entries(TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="label flex-1">
          New value
          <input className="input" required maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        {type === 'COMMUNITY' && (
          <label className="label">
            Religion
            <select className="input" required value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Select</option>
              {religions?.map((r) => (
                <option key={r.id}>{r.value}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>
      {error && <Alert tone="danger">{error}</Alert>}
      {!data ? (
        <Loading />
      ) : (
        <ul className="card divide-y divide-sand-line">
          {data.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className={it.active ? '' : 'text-ink-muted line-through'}>
                {it.value} {it.parent && <span className="text-xs text-ink-muted">· {it.parent}</span>}
              </span>
              <button type="button" className="btn-ghost min-h-[36px] text-xs" onClick={() => toggle(it)}>
                {it.active ? 'Turn off' : 'Turn on'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
