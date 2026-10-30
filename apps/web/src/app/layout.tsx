import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Mulish, Tiro_Devanagari_Hindi } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import './globals.css';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-serif', display: 'swap' });
const sans = Mulish({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-sans', display: 'swap' });
const deva = Tiro_Devanagari_Hindi({ subsets: ['devanagari'], weight: '400', variable: '--font-deva', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Shubh Mangal Savdhan — Matrimony for every community', template: '%s · Shubh Mangal Savdhan' },
  description:
    'Verified matrimony profiles from every community, daily matches, kundli matching and one simple plan: ₹150 a month.',
};

export const viewport: Viewport = { themeColor: '#3E0913', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${deva.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ivory focus:p-3">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
