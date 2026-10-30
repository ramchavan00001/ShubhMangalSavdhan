import type { Metadata } from 'next';
import { ContentPage, H2, List } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <ContentPage eyebrow="Legal" title="Privacy policy" updated="[Date]" draft>
      <p>
        This policy explains how [Business name] (“Shubh Mangal Savdhan”, “we”) collects and uses your personal data, in line with the
        Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000.
      </p>
      <H2>What we collect</H2>
      <List
        items={[
          'Account details: mobile number and, if you add it, email address.',
          'Profile details you provide: name, date of birth, gender, height, religion, community, language, location, education, career, income, family and lifestyle details, description and photos.',
          'Partner preferences, interests sent and received, shortlists, blocks and reports.',
          'Payment records (we never see or store your card or UPI details — Razorpay processes payments).',
          'Technical data such as IP address, device and usage logs, used for security.',
        ]}
      />
      <H2>Why we use it</H2>
      <List
        items={[
          'To create your profile and show it to members who may be a suitable match.',
          'To suggest matches, run search, and deliver interests and notifications.',
          'To review profiles and keep the platform safe from fraud and abuse.',
          'To process payments and issue GST invoices.',
          'To meet legal obligations.',
        ]}
      />
      <H2>Who can see your information</H2>
      <p>
        Your profile is shown only to logged-in members. Your photos follow your photo-visibility setting. Your phone number and email are
        shared only with a member who unlocks your contact details, and only as your contact-visibility setting allows. We do not sell
        your personal data.
      </p>
      <H2>Service providers</H2>
      <p>We use trusted providers to run the service — for example hosting (India region), SMS (OTP), WhatsApp messaging, email and payment processing. They may process your data only on our instructions.</p>
      <p>
        We use an AI service (Anthropic’s Claude) to pre-check uploaded photos for our moderators, to draft profile descriptions when you
        ask for help, and to understand WhatsApp replies. Only what each task needs is sent — never your phone number or contact details
        for drafting. AI never approves or rejects anything on its own; our team does.
      </p>
      <H2>Sensitive information</H2>
      <p>Religion, community and photos can be sensitive. We collect them only because matrimonial matching depends on them, and only with your consent when you add them to your profile.</p>
      <H2>Your rights</H2>
      <List
        items={[
          'Access and correct your data at any time from “My profile”.',
          'Withdraw consent by hiding or deleting your profile from Settings.',
          'Erase your account permanently — deletion removes your profile, photos and activity.',
          'Raise a grievance with our Grievance Officer (see the Contact page).',
        ]}
      />
      <H2>How long we keep data</H2>
      <p>We keep your data while your account is active. When you delete your account we erase it, except records we must keep by law (such as payment and tax records, kept for [8] years).</p>
      <H2>Security</H2>
      <p>We use encryption in transit, access controls and regular reviews. No system is perfectly secure; please keep your OTPs private.</p>
      <H2>Children</H2>
      <p>The service is only for adults of legal marriageable age in India (18 for women, 21 for men).</p>
      <H2>Changes</H2>
      <p>We’ll notify you of significant changes to this policy on the site.</p>
    </ContentPage>
  );
}
