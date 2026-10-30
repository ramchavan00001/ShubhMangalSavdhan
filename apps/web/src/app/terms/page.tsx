import type { Metadata } from 'next';
import { ContentPage, H2, List } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <ContentPage eyebrow="Legal" title="Terms of service" updated="[Date]" draft>
      <p>By creating an account on Shubh Mangal Savdhan, operated by [Business name], you agree to these terms.</p>
      <H2>Who can use the service</H2>
      <List
        items={[
          'You must be of legal marriageable age in India (18 for women, 21 for men) and legally able to marry.',
          'The service is only for finding a life partner for marriage — not for dating, business or any other purpose.',
          'You may create a profile for yourself or, with their consent, for a family member or friend.',
        ]}
      />
      <H2>Your profile</H2>
      <List
        items={[
          'Information you provide must be true and current. Photos must be of the person the profile is for.',
          'Don’t post phone numbers, emails or links in your description or messages.',
          'We may review, edit, reject or remove any profile or photo that breaks these terms or our community guidelines.',
        ]}
      />
      <H2>Plans and payments</H2>
      <List
        items={[
          'Universal Premium costs ₹150 + applicable GST per month. Prices may change with notice; a change never affects a month already paid.',
          'Premium lasts one calendar month from payment and does not renew automatically.',
          'Contact unlocks are limited per 7-day week (Free: 1, Premium: 4). Unused unlocks expire at the end of each week.',
          'Refunds are covered by our Refund Policy.',
        ]}
      />
      <H2>Conduct</H2>
      <p>Harassment, fraud, requests for money, impersonation and misuse of other members’ contact details are not allowed and may lead to suspension, a ban and reporting to the authorities.</p>
      <H2>Our role</H2>
      <p>
        We provide a platform to discover potential matches. We review profiles but cannot guarantee that every detail members provide is
        accurate. Please verify details independently and involve your family before making decisions.
      </p>
      <H2>Liability</H2>
      <p>To the extent permitted by law, our liability for any claim is limited to the amount you paid us in the 3 months before the claim.</p>
      <H2>Termination</H2>
      <p>You can delete your account at any time. We may suspend or end accounts that break these terms.</p>
      <H2>Governing law</H2>
      <p>These terms are governed by the laws of India. Courts at [City] have exclusive jurisdiction.</p>
    </ContentPage>
  );
}
