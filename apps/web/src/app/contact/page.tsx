import type { Metadata } from 'next';
import { ContentPage, H2 } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Contact us' };

export default function ContactPage() {
  return (
    <ContentPage eyebrow="Contact" title="We’re here to help" draft>
      <p>For help with your profile, payments, or to share your success story, reach us at:</p>
      <p>
        <strong>Email:</strong> [support@yourdomain.in]
        <br />
        <strong>Phone / WhatsApp:</strong> [+91 XXXXX XXXXX] (Mon–Sat, 10am–7pm)
      </p>
      <H2>Grievance officer</H2>
      <p>
        As required under the Information Technology Rules, 2021 and the Digital Personal Data Protection Act, 2023:
        <br />
        [Name of Grievance Officer]
        <br />
        [Email] · [Address]
        <br />
        We acknowledge complaints within 24 hours and resolve them within 15 days.
      </p>
      <H2>Registered office</H2>
      <p>[Business name] · [Registered address] · GSTIN [Your GSTIN]</p>
    </ContentPage>
  );
}
