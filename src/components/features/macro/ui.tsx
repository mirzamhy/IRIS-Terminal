import type { ReactNode } from 'react';
import type { MarketSeries } from '@/lib/features/macroMarkets';

/** Shared pieces for the Macro tab's cards. */

export const POS = '#ffb27a';
export const NEG = '#c9b8aa';

export type RegimeName = 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION';

export interface Regime {
  label: string;
  quadrant: RegimeName;
  blurb: string;
  /** Both readings within ±1 of their usual: the label says Normal and only leans. */
  nearNormal: boolean;
}

const QUADRANT: Record<RegimeName, { label: string; blurb: string }> = {
  GOLDILOCKS: { label: 'Goldilocks', blurb: 'Pertumbuhan di atas biasanya, inflasi di bawah biasanya.' },
  REFLATION: { label: 'Reflation', blurb: 'Pertumbuhan dan inflasi sama-sama di atas biasanya.' },
  STAGFLATION: { label: 'Stagflation', blurb: 'Pertumbuhan di bawah biasanya, inflasi di atas biasanya.' },
  DEFLATION: { label: 'Deflation', blurb: 'Pertumbuhan dan inflasi sama-sama di bawah biasanya (bukan berarti harga turun).' },
};

/**
 * Blurbs are relative on purpose: each axis is "vs its own last 2 years", so
 * DEFLATION here means growth AND inflation are both below their usual level,
 * not that prices are falling.
 */
export function classifyRegime(growthZ: number, inflationZ: number): Regime {
  const quadrant: RegimeName =
    growthZ >= 0 ? (inflationZ < 0 ? 'GOLDILOCKS' : 'REFLATION') : inflationZ >= 0 ? 'STAGFLATION' : 'DEFLATION';
  const q = QUADRANT[quadrant];
  const nearNormal = Math.abs(growthZ) < 1 && Math.abs(inflationZ) < 1;
  return nearNormal
    ? { quadrant, nearNormal, label: 'Normal', blurb: `Pertumbuhan dan inflasi sama-sama dekat kebiasaannya, sedikit condong ke ${q.label}.` }
    : { quadrant, nearNormal, ...q };
}

export const QUADRANT_LABEL = (q: RegimeName) => QUADRANT[q].label;

/** 3 standard deviations reach the edge of a plot (not shown as a number). */
export const AXIS_MAX = 3;
export const toPct = (z: number) => 50 + Math.max(-1, Math.min(1, z / AXIS_MAX)) * 44;

/** Plain names for the Yahoo instruments. */
export const MARKET_NAME: Record<string, string> = {
  dxy: 'Dollar index',
  spx: 'S&P 500',
  vix: 'VIX',
  gold: 'Emas',
  us10y: 'Yield AS 10 tahun',
};
export const MARKET_GROUP: Record<string, string> = {
  spx: 'Saham',
  vix: 'Saham',
  dxy: 'Suku bunga & mata uang',
  us10y: 'Suku bunga & mata uang',
  gold: 'Komoditas',
};
/** What "BTC trades like X" reads as, per instrument. */
export const MARKET_LIKE: Record<string, string> = {
  dxy: 'Dolar AS',
  spx: 'Saham AS',
  vix: 'Rasa takut',
  gold: 'Emas',
  us10y: 'Obligasi AS',
};
export const marketName = (s: MarketSeries) => MARKET_NAME[s.key] ?? s.label;

export const fmtR = (r: number | null) => (r === null ? '—' : `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`);
export const fmtChg = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(2)}%`;
export const chgColor = (p: number) => (p > 0 ? POS : p < 0 ? NEG : 'var(--mut)');

/** A −1..+1 correlation as a bar growing from a centre tick, with the number beside it. */
export function CorrBar({ r }: { r: number | null }) {
  const w = r === null ? 0 : Math.min(50, Math.abs(r) * 50);
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--line)', position: 'relative', overflow: 'hidden' }}>
        {r !== null ? (
          <span
            className="ember-grow"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: 999,
              background: r >= 0 ? 'var(--accent)' : '#8a5e40',
              ...(r >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%`, transformOrigin: 'right center' }),
            }}
          />
        ) : null}
        <span style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 2, background: '#3a2b20' }} />
      </span>
      <span style={{ fontSize: 13, color: '#e9ddd2', minWidth: 40, textAlign: 'right' }}>{fmtR(r)}</span>
    </span>
  );
}

/** A z-score as a dot on a −3..+3 track, "usual" shaded in the middle. */
export function ZTrack({ z }: { z: number }) {
  const at = toPct(z);
  return (
    <span style={{ position: 'relative', display: 'block', height: 18 }}>
      <span style={{ position: 'absolute', left: 0, right: 0, top: 7, height: 4, borderRadius: 999, background: 'var(--line)' }} />
      <span style={{ position: 'absolute', left: `${toPct(-1)}%`, width: `${toPct(1) - toPct(-1)}%`, top: 5, height: 8, borderRadius: 999, background: '#2e2219' }} />
      <span style={{ position: 'absolute', left: '50%', top: 2, bottom: 2, width: 2, background: '#3a2b20' }} />
      <span
        style={{
          position: 'absolute',
          left: `${at}%`,
          top: 9,
          width: 14,
          height: 14,
          margin: -7,
          borderRadius: '50%',
          background: Math.abs(z) >= 1 ? 'var(--accent)' : '#b8663a',
          border: '3px solid #ffd2ae',
        }}
      />
    </span>
  );
}

/** Short words for a z-score's band. */
export function zBand(z: number): string {
  if (z >= 2) return 'Jauh di atas';
  if (z >= 1) return 'Di atas';
  if (z > -1) return 'Sekitar biasa';
  if (z > -2) return 'Di bawah';
  return 'Jauh di bawah';
}

export function Tile({ k, v, hint, on, hintColor }: { k: string; v: ReactNode; hint?: ReactNode; on?: boolean; hintColor?: string }) {
  return (
    <div
      className="iris-inset"
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: on ? 'color-mix(in srgb, var(--accent) 14%, var(--sunk))' : undefined,
      }}
    >
      <span style={{ fontSize: 13, color: on ? '#e9c4a6' : 'var(--dim)' }}>{k}</span>
      <span className="t-title" style={{ fontSize: 19 }}>
        {v}
      </span>
      {hint ? <span style={{ fontSize: 14, fontWeight: 600, color: hintColor ?? 'var(--mut)' }}>{hint}</span> : null}
    </div>
  );
}
