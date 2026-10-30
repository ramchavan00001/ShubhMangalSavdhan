import type { Metadata } from 'next';
import { ContentPage, H2, List } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Community guidelines' };

export default function GuidelinesPage() {
  return (
    <ContentPage eyebrow="Community" title="Community guidelines">
      <p>Shubh Mangal Savdhan is a respectful place for families to find a life partner. Please help us keep it that way.</p>
      <H2>Profiles</H2>
      <List
        items={[
          'Be honest about yourself and your family.',
          'Use recent, clear photos of the person the profile is for. No group photos, celebrities, cartoons or stock images.',
          'Keep contact details out of your description — members unlock them through the site.',
        ]}
      />
      <H2>Interactions</H2>
      <List
        items={[
          'Be polite, even when declining. A simple “no” is always okay.',
          'Never ask for money, gifts or financial help.',
          'Don’t share another member’s contact details or photos outside the site.',
          'Respect people from every community, religion and background.',
        ]}
      />
      <H2>What happens if rules are broken</H2>
      <p>Depending on what happened, we may remove content, ask for changes, suspend the account, or ban it permanently. Serious cases may be reported to the police.</p>
    </ContentPage>
  );
}
