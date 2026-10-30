import type { Metadata } from 'next';
import { ContentPage, H2, List } from '@/components/ContentPage';

export const metadata: Metadata = { title: 'Refund policy' };

export default function RefundPolicyPage() {
  return (
    <ContentPage eyebrow="Legal" title="Refund & cancellation policy" updated="[Date]" draft>
      <H2>Cancellation</H2>
      <p>Universal Premium is a one-month plan that does not renew automatically, so there is nothing to cancel. It simply ends at the end of the month.</p>
      <H2>Refunds</H2>
      <List
        items={[
          'If you were charged but Premium was not activated, or you were charged twice, we will refund the extra amount in full.',
          'If you request a refund within [48 hours] of payment and have not unlocked any contact details, we will refund you in full.',
          'Otherwise, payments for a month already started are not refundable.',
          'Accounts suspended or banned for breaking our terms are not eligible for refunds.',
        ]}
      />
      <H2>How to request</H2>
      <p>Contact us with your registered mobile number and invoice number. Approved refunds go back to the original payment method within 5–7 working days.</p>
    </ContentPage>
  );
}
