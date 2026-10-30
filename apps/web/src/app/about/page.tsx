import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, H2 } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'About us' };

export default function AboutPage() {
  return (
    <ContentPage eyebrow="About us" title="Matrimony for every community">
      <p>
        Shubh Mangal Savdhan helps people and their families find a life partner. We believe finding the right match shouldn’t depend on
        which community you belong to or how much you can pay — so there is one simple plan for everyone, at ₹150 a month.
      </p>
      <H2>What we stand for</H2>
      <p>
        <strong>Genuine profiles.</strong> Every profile and photo is reviewed by our team before it goes live.
      </p>
      <p>
        <strong>Respect for privacy.</strong> You decide who sees your photos and when your contact details are shared.
      </p>
      <p>
        <strong>Matches that work both ways.</strong> We show you people who fit your preferences and whose preferences you fit too.
      </p>
      <p>
        <strong>Fair pricing.</strong> One price for all communities. No add-ons, no auto-renewal surprises.
      </p>
      <p>
        Questions? <Link href="/contact">Get in touch</Link>.
      </p>
    </ContentPage>
  );
}
