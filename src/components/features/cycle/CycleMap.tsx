import { Panel, MockBadge, SourceFootnote } from '@/components/primitives';
import { ChartHover } from '@/components/charts/ChartHover';
import { ExpandChart } from '@/components/charts/ChartStudio';
import type { Envelope } from '@/lib/envelope';
import type { HalvingCycleData } from '@/lib/features/halvingCycle';
import { PROJECTION_LABEL, usd } from '@/lib/features/halvingCycle/present';
import { toDay } from '@/lib/quant/daily';
import { fmtDay } from '@/lib/dates';
import { decadeTicks, logScale, tickUsd, yearTicks } from './ui';

const W = 1000;
const H = 340;
const PAD_T = 24;
const PAD_B = 8;
const HEIGHT = 340;

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {swatch}
      {label}
    </span>
  );
}

/**
 * Every cycle on one log chart, growing by itself each day: the price as a
 * glowing line, halvings from the chain as faint verticals, peaks (light) and
 * floors (accent) — filled once final, hollow while provisional — and the 80%
 * window of each active projection. Weekly closes; hover for date and price.
 *
 * Text sits in HTML over the SVG: the SVG stretches to the card's width, and
 * text drawn inside it would stretch with it.
 */
export function CycleMap({ cycle }: { cycle: Envelope<HalvingCycleData> }) {
  const d = cycle.data;
  const a = d.analysis;
  const hist = d.history;
  const d0 = toDay(hist[0].date);
  const ends = [...a.projections.map((p) => p.primary.p80[1]), ...(a.nextHalving ? [a.nextHalving.center] : [])];
  const d1 = Math.max(toDay(d.lastDate), ...ends.map(toDay)) + 45;
  const x = (day: number) => ((day - d0) / (d1 - d0)) * W;
  const prices = hist.map((p) => p.price);
  const lo = Math.min(...prices) * 0.7;
  const hi = Math.max(...prices) * 1.6;
  const y = logScale(lo, hi, PAD_T, H - PAD_B);
  const line = hist.map((p, i) => `${i ? 'L' : 'M'}${x(toDay(p.date)).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
  const area = `${line} L${x(toDay(hist[hist.length - 1].date)).toFixed(1)},${H} L${x(d0)},${H} Z`;
  const pct = (vx: number) => `${((vx / W) * 100).toFixed(2)}%`;
  const px = (vy: number) => (vy / H) * HEIGHT;
  const last = hist[hist.length - 1];

  const marks = a.cycles.flatMap((c) => [
    ...(c.top
      ? [{ key: `t${c.index}`, kind: 'top' as const, solid: c.top.kind === 'final', date: c.top.date, price: c.top.price, tip: `Puncak ${c.top.kind === 'final' ? 'final' : 'sementara'} · siklus ${c.index}\n${fmtDay(c.top.date)}\n${usd(c.top.price)}` }]
      : []),
    ...(c.bottom
      ? [{ key: `b${c.index}`, kind: 'bottom' as const, solid: c.bottomConfirmed, date: c.bottom.date, price: c.bottom.price, tip: `${c.bottomConfirmed ? 'Dasar terkonfirmasi' : 'Terendah sejauh ini'} · siklus ${c.index}\n${fmtDay(c.bottom.date)}\n${usd(c.bottom.price)}` }]
      : []),
  ]);

  return (
    <Panel>
      <div style={{ position: 'relative', zIndex: 4, padding: '24px 26px 4px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="t-title" style={{ margin: 0, fontSize: 22 }}>
            Peta siklus
          </h2>
          <MockBadge env={cycle} />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: 'var(--mut)' }}>
          <Legend swatch={<span style={{ width: 18, height: 3, borderRadius: 2, background: 'var(--accent)' }} />} label="Harga, skala log" />
          <Legend swatch={<span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffd2ae' }} />} label="Puncak" />
          <Legend swatch={<span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />} label="Dasar" />
          <Legend swatch={<span style={{ width: 2, height: 14, background: 'color-mix(in srgb, #f6eee7 40%, transparent)' }} />} label="Halving" />
          <Legend swatch={<span style={{ width: 10, height: 10, borderRadius: '50%', boxShadow: 'inset 0 0 0 2px #c9b8aa' }} />} label="Belum final" />
          <ExpandChart title="BTC mingguan, semua siklus" source={{ kind: 'series', points: hist.map((p) => ({ t: Date.parse(p.date), v: p.price })), unit: '$', digits: 0 }} />
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 4, padding: '12px 26px 8px' }}>
        <div style={{ position: 'relative' }}>
          <ChartHover
            viewW={W}
            viewH={H}
            height={HEIGHT}
            points={hist.map((p) => ({ x: x(toDay(p.date)), y: y(p.price), lines: [fmtDay(p.date), `Harga ${usd(p.price)}`] }))}
            ariaLabel="Harga BTC per siklus halving, skala log"
          >
            {decadeTicks(lo, hi).map((p) => (
              <line key={p} x1={0} x2={W} y1={y(p)} y2={y(p)} stroke="#241a13" vectorEffect="non-scaling-stroke" />
            ))}
            {a.projections.map((p) => {
              const [from, to] = p.primary.p80.map(toDay);
              return (
                <rect
                  key={p.key}
                  x={x(from)}
                  y={0}
                  width={Math.max(2, x(to) - x(from))}
                  height={H}
                  fill={p.key === 'bottom' ? 'var(--accent)' : '#f6eee7'}
                  fillOpacity={p.key === 'bottom' ? 0.1 : 0.06}
                />
              );
            })}
            {a.cycles
              .filter((c) => toDay(c.halving) >= d0)
              .map((c) => (
                <line key={c.halving} x1={x(toDay(c.halving))} x2={x(toDay(c.halving))} y1={0} y2={H} stroke="#f6eee7" strokeOpacity={0.18} vectorEffect="non-scaling-stroke" />
              ))}
            {a.nextHalving ? (
              <line x1={x(a.nextHalving.day)} x2={x(a.nextHalving.day)} y1={0} y2={H} stroke="#f6eee7" strokeOpacity={0.18} strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
            ) : null}
            <path d={area} fill="var(--accent)" fillOpacity={0.08} />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 70%, transparent))' }}
            />
          </ChartHover>
          {decadeTicks(lo, hi).map((p) => (
            <span key={p} style={{ position: 'absolute', left: 8, top: px(y(p)) - 16, fontSize: 12, color: '#8f7d70', pointerEvents: 'none' }}>
              {tickUsd(p)}
            </span>
          ))}
          {a.projections.map((p) => (
            <span
              key={p.key}
              data-tip={`${PROJECTION_LABEL[p.key]}\n8 dari 10: ${fmtDay(p.primary.p80[0])} – ${fmtDay(p.primary.p80[1])}`}
              style={{
                position: 'absolute',
                left: pct(x(toDay(p.primary.p80[0]))),
                top: 4,
                fontSize: 12,
                color: p.key === 'bottom' ? '#ffb27a' : 'var(--mut)',
                whiteSpace: 'nowrap',
              }}
            >
              {p.key === 'bottom' ? 'Dasar?' : 'Puncak?'}
            </span>
          ))}
          {marks.map((m) => (
            <span
              key={m.key}
              data-tip={m.tip}
              style={{
                position: 'absolute',
                left: pct(x(toDay(m.date))),
                top: px(y(m.price)),
                width: 12,
                height: 12,
                margin: -6,
                borderRadius: '50%',
                background: m.solid ? (m.kind === 'top' ? '#ffd2ae' : 'var(--accent)') : 'var(--panel)',
                boxShadow: m.solid ? '0 0 0 3px var(--panel)' : `inset 0 0 0 2px ${m.kind === 'top' ? '#ffd2ae' : 'var(--accent)'}`,
              }}
            />
          ))}
          <span
            className="iris-pulse"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: pct(x(toDay(last.date))),
              top: px(y(last.price)),
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
            <span key={t.year} style={{ position: 'absolute', left: pct(x(t.day)), transform: x(t.day) < 30 ? undefined : 'translateX(-50%)' }}>
              {t.year}
            </span>
          ))}
        </div>
      </div>
      <SourceFootnote env={cycle} />
    </Panel>
  );
}
