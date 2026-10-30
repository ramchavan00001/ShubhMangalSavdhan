'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { api, mediaUrl } from '@/lib/api';
import type { OwnProfile } from '@/lib/types';
import { Camera } from './icons';
import { Alert } from './ui';

const MAX = 10;

/** Upload, reorder (choose main) and delete own photos. */
export function PhotoManager({ photos, onChange }: { photos: OwnProfile['photos']; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) throw new Error(`${f.name} is larger than 5 MB`);
        const body = new FormData();
        body.append('file', f);
        await api('/photos', { method: 'POST', body });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      onChange();
    }
  }

  async function act(path: string, method: 'POST' | 'DELETE') {
    setError(null);
    try {
      await api(path, { method });
    } catch (err) {
      setError((err as Error).message);
    }
    onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id} className="card flex flex-col">
            <div className="relative aspect-[4/5] bg-sand-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p.url)!} alt="" className="h-full w-full object-cover" />
              <span
                className={`badge absolute left-2 top-2 ${
                  p.status === 'APPROVED' ? 'bg-success-bg text-success' : p.status === 'REJECTED' ? 'bg-danger-bg text-danger' : 'bg-ivory text-ink'
                }`}
              >
                {p.status === 'APPROVED' ? 'Approved' : p.status === 'REJECTED' ? 'Not approved' : 'In review'}
              </span>
              {p.isMain && <span className="badge absolute right-2 top-2 bg-maroon text-ivory">Main</span>}
            </div>
            <div className="flex">
              {!p.isMain && (
                <button type="button" className="btn-ghost flex-1 px-2 text-sm" onClick={() => act(`/photos/${p.id}/main`, 'POST')}>
                  Make main
                </button>
              )}
              <button
                type="button"
                className="btn-ghost flex-1 px-2 text-sm text-danger"
                onClick={() => confirm('Delete this photo?') && act(`/photos/${p.id}`, 'DELETE')}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 border border-dashed border-gold-dark bg-ivory-card text-gold-dark hover:bg-sand"
            >
              <Camera size={32} />
              <span className="text-sm font-bold">{busy ? 'Uploading…' : 'Add photos'}</span>
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
      <p className="text-sm text-ink-muted">
        Up to {MAX} photos, JPG/PNG/WebP, 5 MB each. Clear, recent photos of your face get many more responses. Every photo is reviewed
        before others can see it.
      </p>
    </div>
  );
}
