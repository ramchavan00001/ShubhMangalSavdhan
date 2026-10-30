import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage, H2, List } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <ContentPage eyebrow="How it works" title="From sign-up to shubh mangal">
      <H2>1. Create a profile</H2>
      <p>
        Sign up with your mobile number — no password needed. Create a profile for yourself or for a son, daughter, brother, sister,
        relative or friend. The step-by-step form takes about ten minutes.
      </p>
      <H2>2. Get approved</H2>
      <p>Our team reviews each new profile and photo, usually within 24 hours. You can browse while you wait.</p>
      <H2>3. Find matches</H2>
      <List
        items={[
          <>
            <strong>My matches</strong> shows people who fit your partner preferences — and whose preferences you fit too.
          </>,
          <>
            <strong>Search</strong> lets you filter by age, height, religion, community, mother tongue, location, education and more, or
            find someone by profile ID.
          </>,
        ]}
      />
      <H2>4. Send interest</H2>
      <p>Like a profile? Send an interest. If they accept, you’re connected. Free members can send 5 interests a day; Premium is unlimited.</p>
      <H2>5. Unlock contact details</H2>
      <p>
        Free members can unlock 1 contact a week; Premium members can unlock 4 a week (16 a month). Your week starts on the day you signed up
        or paid, and unused unlocks don’t carry over. <Link href="/plans">See plans</Link>.
      </p>
      <H2>6. Families connect</H2>
      <p>Talk, meet with family, and take it forward at your own pace. When you find your match, hide or delete your profile — and tell us your story!</p>
    </ContentPage>
  );
}
