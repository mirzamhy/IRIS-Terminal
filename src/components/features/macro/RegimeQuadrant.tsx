import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroMetric } from '@/lib/features/macroCountry';
import { toMacroCountryLabels } from '@/lib/features/macroCountry/present';
import { zWords } from '@/lib/zWords';
import { AXIS_MAX, classifyRegime, toPct, ZTrack, zBand, QUADRANT_LABEL, POS, type RegimeName } from './ui';

export interface RegimeQuadrantProps {
  macro: Envelope<MacroMetric[]>;
  country: string;
  countryLabel: string;
}

/** Top row is inflation above usual; right column is growth above usual. */
const CELLS: { name: RegimeName; align: string; justify: string; radius: string }[] = [
  { name: 'STAGFLATION', align: 'flex-start', justify: 'flex-start', radius: '22px 6px 6px 6px' },
  { name: 'REFLATION', align: 'flex-end', justify: 'flex-start', radius: '6px 22px 6px 6px' },
  { name: 'DEFLATION', align: 'flex-start', justify: 'flex-end', radius: '6px 6px 6px 22px' },
  { name: 'GOLDILOCKS', align: 'flex-end', justify: 'flex-end', radius: '6px 6px 22px 6px' },
];

/** Each phase as its two directions, for the legend card. */
const PHASES: { name: RegimeName; color: string; growth: 1 | -1; inflation: 1 | -1 }[] = [
  { name: 'GOLDILOCKS', color: 'var(--accent)', growth: 1, inflation: -1 },
  { name: 'REFLATION', color: '#b8663a', growth: 1, inflation: 1 },
  { name: 'DEFLATION', color: '#5a4130', growth: -1, inflation: -1 },
  { name: 'STAGFLATION', color: '#2e2219', growth: -1, inflation: 1 },
];

function ScoreBar({ label, z }: { label: string; z: number }) {
  const w = Math.min(50, (Math.abs(z) / AXIS_MAX) * 50);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-tip={zWords(z, '2 tahun terakhir')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: z >= 0 ? POS : 'var(--down)' }}>
          {zBand(z)} {z >= 0 ? '↑' : '↓'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 999, background: 'var(--line)' }}>
        <span style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 2, background: '#3a2b20' }} />
        <div
          className="ember-grow"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            borderRadius: 999,
            background: z >= 0 ? 'var(--accent)' : '#8a5e40',
            ...(z >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%`, transformOrigin: 'right center' }),
          }}
        />
      </div>
    </div>
  );
}

const Arrow = ({ up }: { up: boolean }) => (
  <span style={{ fontWeight: 600, color: up ? POS : 'var(--down)' }}>{up ? '↑ naik' : '↓ turun'}</span>
);

/**
 * The US macro phase: growth and core inflation, each against its own last two
 * years (FRED). The label is set large with the two readings as bars; the
 * quadrant marks where the economy sits. Below: every indicator on one track,
 * and the four phases as a legend.
 */
export function RegimeQuadrant({ macro, country, countryLabel }: RegimeQuadrantProps) {
  const m = macro.data.find((x) => x.country === country) ?? macro.data[0];
  const L = toMacroCountryLabels(m);
  const gz = m.zScores.growth;
  const iz = m.zScores.inflation;
  const regime = classifyRegime(gz, iz);
  const accent = regime.quadrant === 'GOLDILOCKS' && !regime.nearNormal;
  const indicators = [
    { k: 'Pertumbuhan GDP', v: L.growth, z: gz },
    { k: 'Inflasi inti', v: L.inflation, z: iz },
    { k: 'Suku bunga Fed', v: L.rate, z: m.zScores.rate },
    { k: 'Indeks CPI', v: L.cpi, z: m.zScores.cpi },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <div className="rise" style={{ ['--i' as string]: 2 }}>
        <Panel>
          <div className="ember-halo" aria-hidden="true" style={{ top: -320, left: -200 }} />
          <div style={{ position: 'relative', zIndex: 4, padding: 32, display: 'flex', flexWrap: 'wrap', gap: 40 }}>
            <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--mut)' }}>{countryLabel} · fase ekonomi</h2>
                <MockBadge env={macro} />
              </div>
              <span className={`t-display${accent ? ' t-accent' : ''}`} style={{ fontSize: 'clamp(56px, 7vw, 88px)', color: accent ? 'var(--accent)' : 'var(--txt)' }}>
                {regime.label}
              </span>
              <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: '#e9ddd2' }}>{regime.blurb}</p>
              <ScoreBar label="Pertumbuhan ekonomi" z={gz} />
              <ScoreBar label="Inflasi inti" z={iz} />
            </div>

            <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 12, color: 'var(--dim)', textAlign: 'center' }}>
                  Inflasi turun ← → Inflasi naik
                </div>
                <div style={{ flex: 1, position: 'relative', aspectRatio: '1 / 1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  {CELLS.map((c) => {
                    const on = c.name === regime.quadrant;
                    return (
                      <div
                        key={c.name}
                        style={{
                          borderRadius: c.radius,
                          background: on ? 'color-mix(in srgb, var(--accent) 20%, var(--sunk))' : 'var(--sunk)',
                          padding: 18,
                          display: 'flex',
                          alignItems: c.justify,
                          justifyContent: c.align,
                          fontSize: 16,
                          fontWeight: 600,
                          color: on ? '#ffd2ae' : 'var(--mut)',
                          transition: 'background-color 350ms ease',
                        }}
                      >
                        {QUADRANT_LABEL(c.name)}
                      </div>
                    );
                  })}
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <line x1={50} y1={50} x2={toPct(gz)} y2={100 - toPct(iz)} stroke="#f6eee7" strokeOpacity={0.55} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span
                    className="iris-pulse"
                    role="img"
                    aria-label={`Posisi sekarang: ${regime.label}`}
                    style={{
                      position: 'absolute',
                      left: `${toPct(gz)}%`,
                      top: `${100 - toPct(iz)}%`,
                      width: 24,
                      height: 24,
                      margin: -12,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      border: '4px solid #ffd2ae',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: `calc(${toPct(gz)}% + 18px)`,
                      top: `calc(${100 - toPct(iz)}% - 11px)`,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: '#f6eee7',
                      color: '#1a110b',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Sekarang
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 26, fontSize: 12, color: 'var(--dim)' }}>
                <span>← Pertumbuhan melambat</span>
                <span>Pertumbuhan menguat →</span>
              </div>
            </div>
          </div>
          <SourceFootnote env={macro} />
        </Panel>
      </div>

      <section className="ember-split" aria-label="Indikator dan fase">
        <div className="main rise" style={{ ['--i' as string]: 3 }}>
          <Panel style={{ height: '100%' }}>
            <PanelHeader title="Posisi tiap indikator" note="vs 2 tahun terakhir" right={<MockBadge env={macro} />} />
            <div style={{ position: 'relative', zIndex: 4, padding: '0 26px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(70px, 0.5fr) minmax(200px, 2fr)', gap: 16, padding: '4px 12px 8px', fontSize: 12.5, color: 'var(--dim)' }}>
                <span>Indikator</span>
                <span style={{ textAlign: 'right' }}>Terbaru</span>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>lebih rendah</span>
                  <span>biasanya</span>
                  <span>lebih tinggi</span>
                </span>
              </div>
              {indicators.map((x) => (
                <div
                  key={x.k}
                  className="ember-row"
                  data-tip={zWords(x.z, '2 tahun terakhir')}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(70px, 0.5fr) minmax(200px, 2fr)', gap: 16, alignItems: 'center', padding: '14px 12px' }}
                >
                  <span style={{ fontSize: 15 }}>{x.k}</span>
                  <span className="t-title" style={{ fontSize: 18, textAlign: 'right' }}>
                    {x.v}
                  </span>
                  <ZTrack z={x.z} />
                </div>
              ))}
            </div>
            <SourceFootnote env={macro} />
          </Panel>
        </div>
        <div className="side rise" style={{ ['--i' as string]: 4 }}>
          <Panel style={{ height: '100%' }}>
            <PanelHeader title="Empat fase" note="arah relatif" />
            <div style={{ position: 'relative', zIndex: 4, padding: '0 14px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 12, padding: '0 12px 6px', fontSize: 13, color: 'var(--dim)' }}>
                <span>Fase</span>
                <span style={{ textAlign: 'right' }}>Pertumbuhan</span>
                <span style={{ textAlign: 'right' }}>Inflasi</span>
              </div>
              {PHASES.map((p) => {
                const on = p.name === regime.quadrant;
                return (
                  <div
                    key={p.name}
                    className="ember-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.3fr 1fr 1fr',
                      gap: 12,
                      alignItems: 'center',
                      padding: '13px 12px',
                      fontSize: 15,
                      background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : undefined,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: on ? 600 : 400 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, boxShadow: p.name === 'STAGFLATION' ? 'inset 0 0 0 1px #5a4130' : undefined }} />
                      {QUADRANT_LABEL(p.name)}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <Arrow up={p.growth > 0} />
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <Arrow up={p.inflation > 0} />
                    </span>
                  </div>
                );
              })}
              <span style={{ fontSize: 13, color: 'var(--dim)', padding: '10px 12px 0' }}>
                {regime.nearNormal ? `Sekarang: dekat normal, condong ke ${QUADRANT_LABEL(regime.quadrant)}.` : `Sekarang: ${regime.label}.`}
              </span>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
