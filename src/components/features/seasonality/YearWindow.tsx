'use client';

import { useState, type ReactNode } from 'react';

const OPTIONS = [
  { key: 'yr-5', label: '5 tahun' },
  { key: 'yr-10', label: '10 tahun' },
  { key: 'yr-all', label: 'Semua' },
] as const;

/**
 * Pills that hide the older year rows of the seasonality table (CSS classes
 * `age-ge5` / `age-ge10` on each cell). Only the year rows: the summary rows
 * stay computed from every year, server-side.
 */
export function YearWindow({ children, total }: { children: ReactNode; total: number }) {
  const [win, setWin] = useState<(typeof OPTIONS)[number]['key']>('yr-5');
  return (
    <div className={win} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="tablist" aria-label="Rentang tahun" className="seg" style={{ alignSelf: 'flex-start' }}>
        {OPTIONS.filter((o) => o.key !== 'yr-10' || total > 10).map((o) => (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={win === o.key}
            onClick={() => setWin(o.key)}
            className="seg-btn"
            style={{ border: 0, cursor: 'pointer', padding: '7px 14px', fontSize: 13 }}
          >
            {o.key === 'yr-all' ? `${o.label} (${total})` : o.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
