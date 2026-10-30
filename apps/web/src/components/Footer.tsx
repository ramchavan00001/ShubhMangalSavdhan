import Link from 'next/link';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/safety', label: 'Safety tips' },
  { href: '/faq', label: 'FAQs' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refund-policy', label: 'Refund policy' },
  { href: '/guidelines', label: 'Community guidelines' },
  { href: '/contact', label: 'Contact' },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gold bg-maroon-deep">
      <div className="container-page flex flex-wrap justify-between gap-8 py-12 text-sm text-blush">
        <div className="flex flex-col gap-2">
          <span className="font-serif text-2xl font-bold text-gold-light">Shubh Mangal Savdhan</span>
          <span>Matrimony for every community.</span>
          <span className="text-xs">© {new Date().getFullYear()} Shubh Mangal Savdhan</span>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-blush hover:text-gold">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
