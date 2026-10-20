import { Panel, MockBadge, SourceFootnote } from '@/components/primitives';
import { ChartHover } from '@/components/charts/ChartHover';
import { ExpandChart } from '@/components/charts/ChartStudio';
import { fmtHour } from '@/lib/dates';
import type { Envelope } from '@/lib/envelope';
import type { PositioningData } from '@/lib/features/positioning';
import { CROWDING_NOTE } from '@/lib/features/positioning';

/**
 * Retail against the large book, on one shared scale (the two lines exist to be
 * compared; separate scales would fake lockstep). Retail is the glowing accent
 * line over a soft area, the top traders a quiet second line, 1.00 = balanced.
 */

const W = 1000;
const H = 280;
const HEIGHT = 280;
const PAD = 18;

export function LongShortChart({ positioning }: { positioning: Envelope<PositioningData> }) {
  const d = positioning.data;
  const both = [...d.retail, ...d.topTrader];

  if (both.length === 0) {
    return (
      <Panel style={{ height: '100%' }}>
        <div style={{ padding: 26, fontSize: 14, color: 'var(--dim)' }}>Data posisi Binance sedang tidak tersedia.</div>
        <SourceFootnote env={positioning} />
      </Panel>
    );
  }

  // Always include 1.0 so "balanced" is on screen even in a one-sided window.
  const values = [...both.map((p) => p.ratio), 1];
  const hi = Math.max(...values) * 1.02;
  const lo = Math.min(...values) * 0.98;
  const span = hi - lo || 1;
  const n = d.retail.length;
  const X = (i: number, len: number) => (len === 1 ? W / 2 : (i / (len - 1)) * W);
  const Y = (r: number) => H - PAD - ((r - lo) / span) * (H - PAD * 2);
  const path = (pts: { ratio: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(i, pts.length).toFixed(1)},${Y(p.ratio).toFixed(1)}`).join(' ');
  const retailLine = path(d.retail);
  const yOne = Y(1);
  const last = d.retail[n - 1];
  const topByTs = new Map(d.topTrader.map((p) => [p.ts, p.ratio]));
  const ticks = n > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => d.retail[Math.round(f * (n - 1))]) : [];

  return (
    <Panel style={{ height: '100%' }}>
      <div style={{ position: 'relative', zIndex: 4, padding: '24px 26px 4px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="t-title" style={{ margin: 0, fontSize: 18 }}>
            Rasio long / short, {n} jam
          </h2>
          <MockBadge env={positioning} />
        </span>
        <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--mut)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 3, borderRadius: 2, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
            Semua akun
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }} data-tip={CROWDING_NOTE}>
            <span style={{ width: 18, height: 3, borderRadius: 2, background: '#8a7a6e' }} />
            Top trader
          </span>
          <ExpandChart title="Rasio long / short, semua akun" source={{ kind: 'series', points: d.retail.map((p) => ({ t: p.ts, v: p.ratio })), unit: '', digits: 3 }} />
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 4, padding: '14px 26px 8px' }}>
        <div style={{ position: 'relative' }}>
          <ChartHover
            viewW={W}
            viewH={H}
            height={HEIGHT}
            ariaLabel="Rasio long/short semua akun dan top trader, per jam"
            points={d.retail.map((p, i) => {
              const top = topByTs.get(p.ts);
              return {
                x: X(i, n),
                y: Y(p.ratio),
                lines: [fmtHour(p.ts), `Semua akun ${p.ratio.toFixed(2)} · long ${(p.longShare * 100).toFixed(0)}%`, top === undefined ? 'Top trader —' : `Top trader ${top.toFixed(2)}`],
              };
            })}
          >
            <path d={`M0 ${yOne} L${W} ${yOne}`} stroke="#3a2b20" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
            <path d={path(d.topTrader)} fill="none" stroke="#8a7a6e" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={`${retailLine} L${W},${H} L0,${H} Z`} fill="var(--accent)" fillOpacity={0.1} />
            <path
              d={retailLine}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 70%, transparent))' }}
            />
          </ChartHover>
          <span style={{ position: 'absolute', left: 8, top: (yOne / H) * HEIGHT - 20, fontSize: 12, color: '#8f7d70', pointerEvents: 'none' }}>1.00 seimbang</span>
          {last ? (
            <span
              className="iris-pulse"
              aria-hidden="true"
              style={{ position: 'absolute', right: 0, top: (Y(last.ratio) / H) * HEIGHT, width: 12, height: 12, margin: -6, borderRadius: '50%', background: '#ffd2ae', border: '3px solid var(--accent)', pointerEvents: 'none' }}
            />
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8f7d70', marginTop: 8 }}>
          {ticks.map((t, i) => (
            <span key={`${t.ts}-${i}`}>{i === ticks.length - 1 ? 'Sekarang' : fmtHour(t.ts).replace(' UTC', '')}</span>
          ))}
        </div>
      </div>
      <SourceFootnote env={positioning} />
    </Panel>
  );
}
