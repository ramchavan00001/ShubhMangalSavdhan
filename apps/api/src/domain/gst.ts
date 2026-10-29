export interface GstSplit {
  kind: 'INTRA' | 'INTER';
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

/**
 * Same state as the business → CGST 9% + SGST 9%. Other state (or unknown) → IGST 18%.
 */
export function splitGst(gstPaise: number, businessState: string, customerState?: string | null): GstSplit {
  const same =
    !!customerState && customerState.trim().toLowerCase() === businessState.trim().toLowerCase();
  if (same) {
    const cgst = Math.floor(gstPaise / 2);
    return { kind: 'INTRA', cgstPaise: cgst, sgstPaise: gstPaise - cgst, igstPaise: 0 };
  }
  return { kind: 'INTER', cgstPaise: 0, sgstPaise: 0, igstPaise: gstPaise };
}

/** Indian financial year label for a date, e.g. 2026-10-29 → "2026-27". */
export function financialYear(date: Date): string {
  // Financial years run April–March (IST); a few hours of skew around midnight is irrelevant here.
  const y = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function formatInvoiceNumber(fy: string, n: number): string {
  return `SMS/${fy}/${String(n).padStart(6, '0')}`;
}

export function rupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
