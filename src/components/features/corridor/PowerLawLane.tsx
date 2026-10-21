import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import { ChartHover } from '@/components/charts/ChartHover';
import type { Envelope } from '@/lib/envelope';
import type { PowerLawData } from '@/lib/features/powerLawCorridor';
import { usd } from '@/lib/features/halvingCycle/present';
import { ZONE_EDGES } from '@/lib/quant/config';
import { bandsAt, zoneOf } from '@/lib/quant/powerLaw';
import { toDay } from '@/lib/quant/daily';
import { fmtDay } from '@/lib/dates';
import { ZoneGauge } from './PowerLawCards';

const k = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1000).toFixed(1)}k`);

/**
 * "Where in the lane": today's walk-forward percentile set large on the accent
 * bar, two tiles, and the percentile's own history (no hindsight) with the
 * zone edges, hoverable.
 */
export function PowerLawPercentile({ pl }: { pl: Envelope<PowerLawData> }) {
  const d = pl.data;
  const pts = d.series;
  const below = pts.length ? (pts.filter((p) => p.pct < 50).length / pts.length) * 100 : 0;
  const W = 600;
  const H = 120;
  const X = (i: number) => (i / Math.max(1, pts.length - 1)) * W;
  const Y = (v: number) => H - 4 - (v / 100) * (H - 8);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.pct).toFixed(1)}`).join(' ');
  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title="Posisi di koridor" note="persentil walk-forward" right={<MockBadge env={pl} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '4px 26px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="t-display" style={{ fontSize: 60 }}>
            {Math.round(d.today.pct)}
          </span>
          <span style={{ fontSize: 16, color: 'var(--mut)' }}>dari 100 · {d.today.zone.toLowerCase()}</span>
        </div>
        <ZoneGauge pct={d.today.pct} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
          <div className="iris-inset" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>Minggu di bawah tengah</span>
            <span style={{ fontSize: 19, fontWeight: 600 }}>{below.toFixed(0)}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>Riwayat persentil sejak {pts[0]?.date.slice(0, 4)}, tanpa hindsight</span>
          <div style={{ borderRadius: 14, background: 'var(--sunk)', padding: '8px 0' }}>
            <ChartHover
              viewW={W}
              viewH={H}
              height={110}
              ariaLabel="Riwayat persentil walk-forward"
              points={pts.map((p, i) => ({ x: X(i), y: Y(p.pct), lines: [fmtDay(p.date), `Persentil ${Math.round(p.pct)} · ${zoneOf(p.pct)}`, `Harga ${usd(p.price)}`] }))}
            >
              {ZONE_EDGES.map((e) => (
                <line key={e} x1={0} x2={W} y1={Y(e)} y2={Y(e)} stroke="#3a2b20" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={`${line} L${W},${H} L0,${H} Z`} fill="var(--accent)" fillOpacity={0.1} />
              <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </ChartHover>
          </div>
        </div>
      </div>
      <SourceFootnote env={pl} />
    </Panel>
  );
}

/**
 * "Where the lane goes": the newest fit's P5 / P50 / P95 on 31 December of the
 * next five years, each lane drawn on one shared log scale.
 */
export function PowerLawProjection({ pl }: { pl: Envelope<PowerLawData> }) {
  const d = pl.data;
  const y0 = Number(d.lastDate.slice(0, 4));
  const years = Array.from({ length: 5 }, (_, i) => y0 + i).map((y) => ({ y, b: bandsAt(d.fit, toDay(`${y}-12-31`)) }));
  const lo = Math.log(Math.min(d.priceNow, ...years.map((r) => r.b[0])) * 0.9);
  const hi = Math.log(Math.max(...years.map((r) => r.b[4])) * 1.05);
  const at = (v: number) => ((Math.log(v) - lo) / (hi - lo)) * 100;
  const cols = 'minmax(56px, 0.6fr) repeat(3, minmax(80px, 1fr)) minmax(160px, 2fr)';
  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title="Ke mana koridornya" note="nilai pada 31 Desember · fit terbaru" right={<MockBadge env={pl} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '0 14px 18px', overflowX: 'auto' }}>
        <div style={{ minWidth: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '8px 12px', fontSize: 13, color: 'var(--dim)' }}>
            <span>Tahun</span>
            <span style={{ textAlign: 'right' }}>Murah (P5)</span>
            <span style={{ textAlign: 'right' }}>Tengah (P50)</span>
            <span style={{ textAlign: 'right' }}>Mahal (P95)</span>
            <span>Koridor</span>
          </div>
          {years.map((r) => (
            <div
              key={r.y}
              className="ember-row"
              data-tip={`31 Des ${r.y}\nMurah ${usd(r.b[0])}\nTengah ${usd(r.b[2])}\nMahal ${usd(r.b[4])}`}
              style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'center', padding: '13px 12px', fontSize: 15 }}
            >
              <span style={{ fontWeight: 600 }}>{r.y}</span>
              <span style={{ textAlign: 'right', color: '#e9ddd2' }}>{k(r.b[0])}</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: '#ffd2ae' }}>{k(r.b[2])}</span>
              <span style={{ textAlign: 'right', color: '#e9ddd2' }}>{k(r.b[4])}</span>
              <div style={{ position: 'relative', height: 10, borderRadius: 999, background: 'var(--sunk)' }}>
                <span
                  className="ember-grow"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${at(r.b[0])}%`,
                    width: `${at(r.b[4]) - at(r.b[0])}%`,
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--accent) 45%, #241a13)',
                  }}
                />
                <span style={{ position: 'absolute', top: -3, height: 16, left: `${at(r.b[2])}%`, width: 3, marginLeft: -1.5, borderRadius: 2, background: '#ffd2ae' }} />
                {r.y === y0 ? (
                  <span
                    style={{ position: 'absolute', top: -4, left: `${at(d.priceNow)}%`, width: 18, height: 18, marginLeft: -9, borderRadius: '50%', background: 'var(--accent)', border: '3px solid #ffd2ae' }}
                  />
                ) : null}
              </div>
            </div>
          ))}
          <span style={{ fontSize: 14, color: 'var(--mut)', padding: '10px 12px 0' }}>Garis tren, bukan janji. Titik oranye = harga hari ini ({usd(d.priceNow)}).</span>
        </div>
      </div>
      <SourceFootnote env={pl} />
    </Panel>
  );
}
