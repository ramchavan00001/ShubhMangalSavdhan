import { AppConfig } from '../config';
import { rupees, splitGst } from '../domain/gst';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface InvoiceData {
  invoiceNumber: string | null;
  paidAt: Date | null;
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
  billingState: string | null;
  providerPaymentId: string | null;
  user: { phone: string; email: string | null; profile: { firstName: string | null; lastName: string | null; city: string | null; state: string | null } | null };
}

/** Printable GST tax invoice (the member can "Save as PDF" from the browser). */
export function renderInvoiceHtml(p: InvoiceData, business: AppConfig['business']): string {
  const gst = splitGst(p.gstPaise, business.state, p.billingState);
  const name = [p.user.profile?.firstName, p.user.profile?.lastName].filter(Boolean).join(' ') || 'Member';
  const date = (p.paidAt ?? new Date()).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const taxRows =
    gst.kind === 'INTRA'
      ? `<tr><td>CGST @ 9%</td><td class="r">₹${rupees(gst.cgstPaise)}</td></tr><tr><td>SGST @ 9%</td><td class="r">₹${rupees(gst.sgstPaise)}</td></tr>`
      : `<tr><td>IGST @ 18%</td><td class="r">₹${rupees(gst.igstPaise)}</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(p.invoiceNumber)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#2B1A14;max-width:760px;margin:32px auto;padding:0 16px}
h1{color:#5B0F1E;font-size:22px;margin:0}
.head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #C9A24B;padding-bottom:16px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{padding:10px;border-bottom:1px solid #E4D5BB;text-align:left;font-size:14px}
.r{text-align:right}.muted{color:#6B5A50;font-size:13px}
.total td{font-weight:bold;border-top:2px solid #5B0F1E}
@media print{.noprint{display:none}}
</style></head><body>
<div class="head">
  <div><h1>${esc(business.name)}</h1><div class="muted">${esc(business.address)}<br>GSTIN: ${esc(business.gstin)}<br>State: ${esc(business.state)}</div></div>
  <div class="r"><strong>TAX INVOICE</strong><br><span class="muted">No. ${esc(p.invoiceNumber)}<br>Date: ${date}</span></div>
</div>
<p><strong>Billed to:</strong> ${esc(name)}<br><span class="muted">+${esc(p.user.phone)}${p.user.email ? ' · ' + esc(p.user.email) : ''}<br>${esc([p.user.profile?.city, p.billingState].filter(Boolean).join(', '))}</span></p>
<table>
<tr><th>Description</th><th class="r">Amount</th></tr>
<tr><td>Universal Premium membership — 1 month<br><span class="muted">SAC ${esc(business.sac)} · Online matchmaking service</span></td><td class="r">₹${rupees(p.basePaise)}</td></tr>
${taxRows}
<tr class="total"><td>Total paid</td><td class="r">₹${rupees(p.totalPaise)}</td></tr>
</table>
<p class="muted">Payment reference: ${esc(p.providerPaymentId)}</p>
<p class="noprint muted">To save as PDF, use your browser’s Print option (Ctrl+P).</p>
</body></html>`;
}
