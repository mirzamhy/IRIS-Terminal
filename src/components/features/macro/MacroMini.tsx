import Link from 'next/link';
import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroMetric } from '@/lib/features/macroCountry';
import type { MacroMarketsData } from '@/lib/features/macroMarkets';
import { fmtLevel } from '@/lib/features/macroMarkets';
import { classifyRegime, toPct, Tile, CorrBar, marketName, fmtChg, chgColor, QUADRANT_LABEL, type RegimeName } from './ui';

/** Top row is inflation above usual; right column is growth above usual. */
const CELLS: { name: RegimeName; radius: string; align: string; justify: string }[] = [
  { name: 'STAGFLATION', radius: '18px 6px 6px 6px', align: 'flex-start', justify: 'flex-start' },
  { name: 'REFLATION', radius: '6px 18px 6px 6px', align: 'flex-start', justify: 'flex-end' },
  { name: 'DEFLATION', radius: '6px 6px 6px 18px', align: 'flex-end', justify: 'flex-start' },
  { name: 'GOLDILOCKS', radius: '6px 6px 18px 6px', align: 'flex-end', justify: 'flex-end' },
];

/** Economic-data tab: the phase set large beside a small quadrant. */
export function RegimeMini({ macro, country }: { macro: Envelope<MacroMetric[]>; country: string }) {
  const m = macro.data.find((x) => x.country === country) ?? macro.data[0];
  const gz = m.zScores.growth;
  const iz = m.zScores.inflation;
  const r = classifyRegime(gz, iz);
  const accent = r.quadrant === 'GOLDILOCKS' && !r.nearNormal;
  return (
    <Panel style={{ height: '100%' }}>
      <div style={{ position: 'relative', zIndex: 4, padding: 28, display: 'flex', flexWrap: 'wrap', gap: 28 }}>
        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="t-title" style={{ margin: 0, fontSize: 18 }}>
              Fase ekonomi
            </h2>
            <MockBadge env={macro} />
          </span>
          <span className={`t-display${accent ? ' t-accent' : ''}`} style={{ fontSize: 52, color: accent ? 'var(--accent)' : 'var(--txt)' }}>
            {r.label}
          </span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#e9ddd2' }}>{r.blurb}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Tile k="Pertumbuhan" v={gz >= 0 ? 'Di atas' : 'Di bawah'} />
            </div>
            <div style={{ flex: 1 }}>
              <Tile k="Inflasi inti" v={iz >= 0 ? 'Di atas' : 'Di bawah'} />
            </div>
          </div>
          <Link href="/macro/regime" style={{ fontSize: 14, fontWeight: 600 }}>
            Buka fase ekonomi →
          </Link>
        </div>
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative', aspectRatio: '1 / 1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {CELLS.map((c) => {
              const on = c.name === r.quadrant;
              return (
                <div
                  key={c.name}
                  style={{
                    borderRadius: c.radius,
                    background: on ? 'color-mix(in srgb, var(--accent) 20%, var(--sunk))' : 'var(--sunk)',
                    padding: 14,
                    display: 'flex',
                    alignItems: c.align,
                    justifyContent: c.justify,
                    fontSize: 14,
                    fontWeight: on ? 600 : 400,
                    color: on ? '#ffd2ae' : 'var(--mut)',
                  }}
                >
                  {QUADRANT_LABEL(c.name)}
                </div>
              );
            })}
            <span
              className="iris-pulse"
              role="img"
              aria-label={`Posisi sekarang: ${r.label}`}
              style={{
                position: 'absolute',
                left: `${toPct(gz)}%`,
                top: `${100 - toPct(iz)}%`,
                width: 18,
                height: 18,
                margin: -9,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '3px solid #ffd2ae',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--dim)' }}>
            <span>← Pertumbuhan melambat</span>
            <span>Atas = inflasi naik</span>
          </div>
        </div>
      </div>
      <SourceFootnote env={macro} />
    </Panel>
  );
}

/** Economic-data tab: each market's level, day change and 30-day correlation with BTC. */
export function MarketsMini({ markets }: { markets: Envelope<MacroMarketsData> }) {
  const rows = [...markets.data.series].sort((a, b) => (b.corr30d ?? -2) - (a.corr30d ?? -2));
  const cols = 'minmax(110px, 1.4fr) minmax(70px, 1fr) minmax(60px, 0.8fr) minmax(110px, 1.4fr)';
  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title="Pasar global" note="korelasi dengan BTC, 30 hari" right={<MockBadge env={markets} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '0 26px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((s) => (
          <div key={s.key} className="ember-row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'center', padding: 12, margin: '0 -12px' }}>
            <span style={{ fontSize: 15 }}>{marketName(s)}</span>
            <span style={{ fontSize: 15, fontWeight: 600, textAlign: 'right' }}>{fmtLevel(s)}</span>
            <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', color: chgColor(s.change1dPct) }}>{fmtChg(s.change1dPct)}</span>
            <CorrBar r={s.corr30d} />
          </div>
        ))}
        <Link href="/macro/markets" style={{ fontSize: 14, fontWeight: 600, paddingTop: 10 }}>
          Buka pasar global →
        </Link>
      </div>
      <SourceFootnote env={markets} />
    </Panel>
  );
}
