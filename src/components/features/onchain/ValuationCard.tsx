import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import { ExpandChart } from '@/components/charts/ChartStudio';
import type { Envelope } from '@/lib/envelope';
import type { ValuationData } from '@/lib/features/valuation';
import { fmtDay } from '@/lib/dates';

/**
 * MVRV (live: spot ÷ realized price) and SOPR (Bitview, per block; bitcoin-data.com fallback, whose free tier
 * withholds the last 7 days). Each with a one-year sparkline that opens in the
 * chart studio.
 */

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

function mvrvZone(v: number): { word: string; color: string } {
  if (v < 1) return { word: 'Di bawah harga realisasi · historis murah', color: '#ffb27a' };
  if (v < 2) return { word: 'Wajar', color: 'var(--txt)' };
  if (v < 3) return { word: 'Mulai mahal', color: '#e9c4a6' };
  return { word: 'Sangat mahal · zona puncak historis', color: 'var(--down)' };
}

function Spark({ pts, ref1 }: { pts: { value: number }[]; ref1: number }) {
  if (pts.length < 2) return null;
  const W = 300;
  const H = 60;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(...vals, ref1);
  const hi = Math.max(...vals, ref1);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * W).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 60, display: 'block' }} aria-hidden="true">
      <line x1={0} x2={W} y1={y(ref1)} y2={y(ref1)} stroke="#3a2b20" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ValuationCard({ val }: { val: Envelope<ValuationData> }) {
  const v = val.data;
  const z = mvrvZone(v.mvrv.now);
  const s = v.sopr;
  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title="MVRV & SOPR" note="valuasi on-chain" right={<MockBadge env={val} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '4px 26px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <div className="iris-inset" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>MVRV · live</span>
            <ExpandChart
              title="MVRV harian"
              label="Chart"
              source={{ kind: 'series', points: v.mvrv.history.map((p) => ({ t: Date.parse(p.date), v: p.value })), unit: '', digits: 2 }}
            />
          </span>
          <span className="t-display" style={{ fontSize: 44 }}>
            {v.mvrv.now.toFixed(2)}
          </span>
          <span style={{ fontSize: 14, color: z.color }}>{z.word}</span>
          <Spark pts={v.mvrv.history} ref1={1} />
          <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
            Harga {usd(v.mvrv.spot)} ÷ harga realisasi {usd(v.mvrv.realizedPrice)} (Coin Metrics, {fmtDay(v.mvrv.realizedDate)}).
          </span>
        </div>
        <div className="iris-inset" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s ? (
            <>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{s.source === 'live' ? 'SOPR 24 jam · live' : `SOPR · ${fmtDay(s.date)}`}</span>
                <ExpandChart
                  title="SOPR harian"
                  label="Chart"
                  source={{ kind: 'series', points: s.history.map((p) => ({ t: Date.parse(p.date), v: p.value })), unit: '', digits: 3 }}
                />
              </span>
              <span className="t-display" style={{ fontSize: 44 }}>
                {s.latest.toFixed(3)}
              </span>
              <span style={{ fontSize: 14, color: s.avg7 >= 1 ? '#ffb27a' : 'var(--down)' }}>
                {s.source === 'live' ? 'SOPR 1 minggu' : 'Rata-rata 7 hari'} {s.avg7.toFixed(3)} · {s.avg7 >= 1 ? 'koin dijual untung' : 'koin dijual rugi (kapitulasi)'}
              </span>
              <Spark pts={s.history} ref1={1} />
              <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                {s.source === 'live'
                  ? 'Bitview (node Bitcoin sendiri, open source): dihitung ulang tiap blok dari koin yang dipakai 24 jam terakhir.'
                  : 'Cadangan: bitcoin-data.com, tier gratis menahan 7 hari terakhir (Bitview sedang tidak menjawab).'}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>SOPR: Bitview dan bitcoin-data.com sedang tidak menjawab.</span>
          )}
        </div>
      </div>
      <SourceFootnote env={val} />
    </Panel>
  );
}
