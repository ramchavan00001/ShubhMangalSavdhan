import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="heading text-5xl">This page isn’t here</h1>
      <p className="text-ink-muted">The page may have moved, or the link may be wrong.</p>
      <Link href="/" className="btn-primary mt-2">
        Go to homepage
      </Link>
    </div>
  );
}
