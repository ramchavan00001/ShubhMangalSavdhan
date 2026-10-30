import type { Metadata } from 'next';
import { ContentPage, H2, List } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Safety tips' };

export default function SafetyPage() {
  return (
    <ContentPage eyebrow="Safety" title="Stay safe while you search">
      <H2>Never send money</H2>
      <p>
        No genuine match will ask you for money, gifts, investments, crypto or help with “customs fees”. If someone does, stop talking to
        them and report the profile.
      </p>
      <H2>Protect your personal details</H2>
      <List
        items={[
          'Don’t share bank details, OTPs, Aadhaar or PAN numbers with anyone.',
          'Be careful about sharing your home address or workplace until you trust the person and their family.',
          'Use our privacy settings to control who sees your photos and contact details.',
        ]}
      />
      <H2>Meeting for the first time</H2>
      <List
        items={[
          'Meet in a public place, and tell a family member where you’re going.',
          'Involve families early — it’s the best way to verify someone.',
          'Arrange your own travel, and leave if anything feels wrong.',
        ]}
      />
      <H2>Warning signs</H2>
      <List
        items={[
          'They avoid video calls or meeting family.',
          'Their story keeps changing, or the photos look like a model or celebrity.',
          'They push you to move to another app quickly, or to keep things secret.',
        ]}
      />
      <H2>Report anything suspicious</H2>
      <p>Use “Report profile” on any profile. Our team reviews every report. You can also block someone so you never see each other again.</p>
    </ContentPage>
  );
}
