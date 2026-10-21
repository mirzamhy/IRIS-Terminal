import { Panel, MockBadge, SourceFootnote } from '@/components/primitives';
import { ChartHover } from '@/components/charts/ChartHover';
import type { Envelope } from '@/lib/envelope';
import type { PowerLawData } from '@/lib/features/powerLawCorridor';
import { usd } from '@/lib/features/halvingCycle/present';
import { toDay } from '@/lib/quant/daily';
import { bandsAt, zoneOf } from '@/lib/quant/powerLaw';
import { fmtDay } from '@/lib/dates';
import { decadeTicks, logScale, tickUsd, yearTicks } from '../cycle/ui';

const W = 1000;
const H = 400;
const HEIGHT = 420;
const LAST = 4;

const k = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1000).toFixed(1)}k`);

/**
 * Price (log) inside the corridor of the newest fit: the P5–P95 lane filled,
 * P25–P75 a shade deeper, the P50 line dashed, the close as a glowing line.
 * Bands use today's fit, so their past shape uses today's knowledge; the
 * walk-forward percentile (no hindsight) lives in its own card.
 *
 * Labels are HTML over the SVG so they keep the terminal's type: the SVG
 * stretches to the card and would stretch any text drawn inside it.
 */
export function CorridorChart({ pl }: { pl: Envelope<PowerLawData> }) {
  const d = pl.data;
  const pts = d.series;
  const d0 = toDay(pts[0].date);
  const d1 = toDay(pts[pts.length - 1].date);
  const x = (day: number) => ((day - d0) / (d1 - d0)) * W;
  const bands = pts.map((p) => bandsAt(d.fit, toDay(p.date)));
  const lo = Math.min(...pts.map((p) => p.price), ...bands.map((b) => b[0])) * 0.8;
  const hi = Math.max(...pts.map((p) => p.price), ...bands.map((b) => b[LAST])) * 1.3;
  const y = logScale(lo, hi, 6, H - 6);
  const px = (vy: number) => (vy / H) * HEIGHT;

  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(toDay(pts[i].date)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ribbon = (qa: number, qb: number) => {
    const up = bands.map((b, i) => `${i ? 'L' : 'M'}${x(toDay(pts[i].date)).toFixed(1)},${y(b[qb]).toFixed(1)}`).join(' ');
    const down = bands
      .map((b, i) => `L${x(toDay(pts[i].date)).toFixed(1)},${y(b[qa]).toFixed(1)}`)
      .reverse()
      .join(' ');
    return `${up} ${down} Z`;
  };
  const end = bands[bands.length - 1];
  const lastPt = pts[pts.length - 1];

  return (
    <Panel>
      <div style={{ position: 'relative', zIndex: 4, padding: '24px 26px 4px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="t-title" style={{ margin: 0, fontSize: 22 }}>
            Koridor power-law
          </h2>
          <MockBadge env={pl} />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: 'var(--mut)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
            Harga mingguan
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 0, borderTop: '2px dashed #e9c4a6' }} />
            Tengah (P50)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 10, borderRadius: 3, background: 'color-mix(in srgb, var(--accent) 22%, var(--panel))' }} />
            Koridor P5–P95
          </span>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 4, padding: '12px 26px 8px' }}>
        <div style={{ position: 'relative' }}>
          <ChartHover
            viewW={W}
            viewH={H}
            height={HEIGHT}
            ariaLabel="Harga BTC dalam koridor power-law, skala log"
            points={pts.map((p, i) => ({
              x: x(toDay(p.date)),
              y: y(p.price),
              lines: [fmtDay(p.date), `Harga ${usd(p.price)}`, `Tengah ${usd(bands[i][2])}`, `Koridor ${usd(bands[i][0])} – ${usd(bands[i][LAST])}`, `Persentil ${p.pct.toFixed(0)} · ${zoneOf(p.pct)}`],
            }))}
          >
            {decadeTicks(lo, hi).map((p) => (
              <line key={p} x1={0} x2={W} y1={y(p)} y2={y(p)} stroke="#241a13" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={ribbon(0, LAST)} fill="var(--accent)" fillOpacity={0.08} />
            <path d={ribbon(1, 3)} fill="var(--accent)" fillOpacity={0.08} />
            {[0, LAST].map((q) => (
              <path key={q} d={line(bands.map((b) => b[q]))} fill="none" stroke="#8a5e40" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={line(bands.map((b) => b[2]))} fill="none" stroke="#e9c4a6" strokeWidth={1.5} strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
            <path
              d={line(pts.map((p) => p.price))}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 70%, transparent))' }}
            />
          </ChartHover>
          {decadeTicks(lo, hi).map((p) => (
            <span key={p} style={{ position: 'absolute', left: 8, top: px(y(p)) - 17, fontSize: 12, color: '#8f7d70', pointerEvents: 'none' }}>
              {tickUsd(p)}
            </span>
          ))}
          {(() => {
            // Above its line for the top two, below for the floor; then pushed apart so none overlap.
            const tops = [px(y(end[LAST])) - 20, px(y(end[2])) - 20, px(y(end[0])) + 6];
            for (let i = 1; i < tops.length; i += 1) tops[i] = Math.max(tops[i], tops[i - 1] + 18);
            return (
              [
                ['Mahal (P95)', end[LAST], 'var(--mut)'],
                ['Tengah (P50)', end[2], '#e9c4a6'],
                ['Murah (P5)', end[0], 'var(--mut)'],
              ] as const
            ).map(([label, v, c], i) => (
              <span key={label} style={{ position: 'absolute', right: 22, top: tops[i], fontSize: 13, color: c, pointerEvents: 'none', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {label} · {k(v)}
              </span>
            ));
          })()}
          <span
            className="iris-pulse"
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 0,
              top: px(y(lastPt.price)),
              width: 14,
              height: 14,
              margin: -7,
              borderRadius: '50%',
              background: '#ffd2ae',
              border: '3px solid var(--accent)',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 8, fontSize: 12, color: '#8f7d70' }}>
          {yearTicks(d0, d1).map((t) => (
            <span key={t.year} style={{ position: 'absolute', left: `${((x(t.day) / W) * 100).toFixed(2)}%`, transform: x(t.day) < 30 ? undefined : 'translateX(-50%)' }}>
              {t.year}
            </span>
          ))}
        </div>
      </div>
      <SourceFootnote env={pl} />
    </Panel>
  );
}
