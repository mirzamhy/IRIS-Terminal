'use client';

import { useState } from 'react';
import type { MacroIndicator } from '@/lib/features/macroCountry/types';

/**
 * History of one US indicator as bars (about two years, monthly; GDP by
 * quarter). Pick the indicator with the tabs; hover a bar for its value.
 * Bars grow up or down from zero, so a negative NFP or GDP print reads at once.
 */

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const period = (iso: string) => `${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
const fmt = (unit: MacroIndicator['unit'], v: number) =>
  unit === 'k' ? `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}k` : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;

export function MacroHistory({ indicators }: { indicators: MacroIndicator[] }) {
  const [key, setKey] = useState(indicators.find((i) => i.key === 'nfp')?.key ?? indicators[0]?.key);
  const [hover, setHover] = useState<number | null>(null);
  const ind = indicators.find((i) => i.key === key) ?? indicators[0];
  if (!ind) return null;
  const h = ind.history;
  const vals = h.map((p) => p.value);
  const hi = Math.max(0, ...vals);
  const lo = Math.min(0, ...vals);
  const span = hi - lo || 1;
  const zeroPct = (hi / span) * 100;
  const shown = hover !== null ? h[hover] : h[h.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="seg" role="tablist" style={{ flexWrap: 'wrap', alignSelf: 'flex-start' }}>
        {indicators.map((i) => (
          <button
            key={i.key}
            type="button"
            role="tab"
            aria-selected={i.key === ind.key}
            className="seg-btn"
            onClick={() => {
              setKey(i.key);
              setHover(null);
            }}
            style={{ border: 0, cursor: 'pointer', padding: '6px 11px', fontSize: 12.5 }}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span className="t-display" style={{ fontSize: 36 }}>
          {fmt(ind.unit, shown.value)}
        </span>
        <span style={{ fontSize: 14, color: 'var(--mut)' }}>
          {ind.label} · {ind.what} · {period(shown.date)}
        </span>
      </div>
      <div
        role="img"
        aria-label={`Riwayat ${ind.label}`}
        onPointerLeave={() => setHover(null)}
        style={{ position: 'relative', height: 220, display: 'flex', gap: 3, alignItems: 'stretch' }}
      >
        <span style={{ position: 'absolute', left: 0, right: 0, top: `${zeroPct}%`, height: 1, background: '#3a2b20' }} />
        {h.map((p, i) => {
          const pos = p.value >= 0;
          const hgt = (Math.abs(p.value) / span) * 100;
          const last = i === h.length - 1;
          return (
            <div key={p.date} onPointerEnter={() => setHover(i)} style={{ flex: 1, position: 'relative', minWidth: 0, cursor: 'default' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: pos ? `${zeroPct - hgt}%` : `${zeroPct}%`,
                  height: `${Math.max(hgt, 0.6)}%`,
                  borderRadius: pos ? '4px 4px 1px 1px' : '1px 1px 4px 4px',
                  background: last || hover === i ? 'var(--accent)' : pos ? 'color-mix(in srgb, var(--accent) 45%, var(--line))' : '#6b4a35',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--dim)' }}>
        <span>{period(h[0].date)}</span>
        <span>{period(h[Math.floor(h.length / 2)].date)}</span>
        <span>{period(h[h.length - 1].date)}</span>
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>FRED {ind.seriesId}. Arahkan kursor ke batang untuk nilainya.</span>
    </div>
  );
}
