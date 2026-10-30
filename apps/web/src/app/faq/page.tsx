import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'FAQs' };

const FAQS: [string, string][] = [
  ['How much does it cost?', 'Creating a profile, browsing and searching are free. Universal Premium costs ₹150 + 18% GST (₹177) a month and is the same for every community.'],
  ['How do contact unlocks work?', 'Free members can unlock 1 contact per week. Premium members can unlock 4 per week, 16 in a month. Weeks repeat every 7 days from your signup date (Free) or payment date (Premium).'],
  ['If I use all 4 unlocks on day one, what happens?', 'You’ll be able to unlock more when your next week begins. The page shows exactly when that is.'],
  ['Do unused unlocks carry over?', 'No. Each week’s unlocks are available only during that week.'],
  ['Does Premium renew automatically?', 'No. Premium lasts one month. We remind you before it ends, and you can renew whenever you like.'],
  ['Can I make a profile for my son or daughter?', 'Yes. Choose who the profile is for when you create it. Many profiles are managed by parents.'],
  ['Why is my profile “under review”?', 'Our team checks every new profile and photo to keep the site genuine. This usually takes less than 24 hours.'],
  ['Who can see my photos?', 'You choose: all members, Premium members only, or only members you’ve connected with. Change it any time in Settings.'],
  ['How do I hide or delete my profile?', 'Go to Settings. Hiding keeps your data and lets you come back later; deleting removes everything permanently.'],
  ['Can I get a GST invoice?', 'Yes. Every payment has a downloadable GST invoice on the Payments page.'],
];

export default function FaqPage() {
  return (
    <ContentPage eyebrow="Help" title="Frequently asked questions">
      {FAQS.map(([q, a]) => (
        <details key={q} className="card group p-5">
          <summary className="cursor-pointer list-none font-bold text-ink marker:hidden">
            {q}
          </summary>
          <p className="mt-3">{a}</p>
        </details>
      ))}
    </ContentPage>
  );
}
