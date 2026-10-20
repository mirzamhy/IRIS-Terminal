'use client';

import { useState } from 'react';
import { Panel, PanelHeader, MockBadge } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroMarketsData, MarketSeries } from '@/lib/features/macroMarkets';
import { MARKET_NAME } from '../macro/ui';
import { ExpandChart } from '@/components/charts/ChartStudio';

/**
 * 30-day rolling correlation of each market's daily returns with BTC's, over the
 * last year — one small chart per market on the same −1..+1 scale (small
 * multiples: five tangled lines on one chart would need five colours and a
 * legend to read).
 *
 * The shaded band is |r| < 1.96/√30 ≈ 0.36: with 30 returns, values inside it
 * are not distinguishable from "no relationship" (large-sample 95% band).
 */

const WINDOW = 30;
const NOISE = 1.96 / Math.sqrt(WINDOW);

const W = 300;
const H = 120;
const PAD_T = 6;
const PAD_B = 6;

const y = (r: number) => PAD_T + ((1 - r) / 2) * (H - PAD_T - PAD_B);

const fmtR = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** Formatted by hand in UTC so server and browser render the same text. */
const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};

/** The current reading in plain words, on the noise band only — no invented "strong" cut. */
export function corrWords(r: number | null): string {
  if (r === null) return 'belum cukup data';
  if (r >= NOISE) return 'searah dengan BTC';
  if (r <= -NOISE) return 'berlawanan dengan BTC';
  return 'tidak ada hubungan jelas';
}

function SmallChart({ s }: { s: MarketSeries }) {
  const pts = s.rollingCorr30d;
  const [hover, setHover] = useState<number | null>(null);
  const name = MARKET_NAME[s.key] ?? s.label;

  if (pts.length < 2) {
    return (
      <div className="iris-inset" style={{ padding: 18, fontSize: 14, color: 'var(--dim)' }}>
        {name}: belum cukup data untuk korelasi 30 hari.
      </div>
    );
  }

  const t0 = pts[0].ts;
  const t1 = pts[pts.length - 1].ts;
  const x = (ts: number) => ((ts - t0) / (t1 - t0 || 1)) * W;
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ts).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${y(0)} L0,${y(0)} Z`;
  const last = pts[pts.length - 1];
  const h = hover === null ? null : pts[hover];
  const shown = h ?? last;
  const stroke = last.r >= 0 ? 'var(--accent)' : '#b8663a';

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ts = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < pts.length; i += 1) {
      if (Math.abs(pts[i].ts - ts) < Math.abs(pts[best].ts - ts)) best = i;
    }
    setHover(best);
  };

  return (
    <div style={{ padding: 18, borderRadius: 20, background: 'var(--sunk)', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15 }}>{name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExpandChart title={`Korelasi 30 hari BTC vs ${name}`} source={{ kind: 'series', points: pts.map((p) => ({ t: p.ts, v: p.r })), unit: '', digits: 2 }} label="" />
          <span className="t-title" style={{ fontSize: 20, color: shown.r >= 0 ? '#ffb27a' : '#c9b8aa' }}>
            {fmtR(shown.r)}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 110, display: 'block', touchAction: 'none' }}
        role="img"
        aria-label={`${name}: korelasi 30 hari dengan BTC, sekarang ${fmtR(last.r)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <rect x={0} y={y(NOISE)} width={W} height={y(-NOISE) - y(NOISE)} fill="#1f1712" />
        <path d={`M0 ${y(0)} L${W} ${y(0)}`} stroke="#3a2b20" strokeWidth={1} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={stroke} fillOpacity={0.14} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {h ? <line x1={x(h.ts)} x2={x(h.ts)} y1={0} y2={H} stroke="var(--mut)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--dim)' }}>
        {h ? (
          <span>
            {fmtDate(h.ts)} · {corrWords(h.r)}
          </span>
        ) : (
          <>
            <span>{fmtDate(t0)}</span>
            <span>{corrWords(last.r)}</span>
            <span>Hari ini</span>
          </>
        )}
      </div>
    </div>
  );
}

export function RollingCorrelationCharts({ macro }: { macro: Envelope<MacroMarketsData> }) {
  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title="Korelasi 30 hari, setahun terakhir" note="+1 searah · −1 berlawanan · area gelap = lemah" right={<MockBadge env={macro} />} />
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          padding: '4px 26px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {macro.data.series.map((s) => (
          <SmallChart key={s.key} s={s} />
        ))}
      </div>
    </Panel>
  );
}
