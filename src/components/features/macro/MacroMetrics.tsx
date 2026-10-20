import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroMetric } from '@/lib/features/macroCountry';
import { toMacroCountryLabels } from '@/lib/features/macroCountry/present';
import { zWords } from '@/lib/zWords';
import { ZTrack, zBand } from './ui';

export interface MacroMetricsProps {
  macro: Envelope<MacroMetric[]>;
  country: string;
  countryLabel: string;
}

/**
 * Four US FRED series, each placed against its own last two years as a dot on
 * a track (curation 2026-10-18: no z / sigma numbers on screen). No good/bad
 * colour: "above usual" is a position, not news.
 */
export function MacroMetrics({ macro, country, countryLabel }: MacroMetricsProps) {
  const m = macro.data.find((x) => x.country === country) ?? macro.data[0];
  const L = toMacroCountryLabels(m);

  const metrics: { key: string; label: string; what: string; value: string; z: number }[] = [
    { key: 'inflation', label: 'Inflasi inti', what: 'per tahun, tanpa makanan & energi', value: L.inflation, z: m.zScores.inflation },
    { key: 'rate', label: 'Suku bunga The Fed', what: 'rata-rata bulanan', value: L.rate, z: m.zScores.rate },
    { key: 'growth', label: 'Pertumbuhan GDP', what: 'riil, per kuartal disetahunkan', value: L.growth, z: m.zScores.growth },
    { key: 'cpi', label: 'Indeks CPI', what: 'level, hampir selalu naik', value: L.cpi, z: m.zScores.cpi },
  ];
  const cols = 'minmax(170px, 1.6fr) minmax(80px, 0.7fr) minmax(160px, 1.6fr) minmax(100px, 0.8fr)';

  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title={`${countryLabel}, data terbaru`} note="FRED · vs 2 tahun terakhir" right={<MockBadge env={macro} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '0 14px 14px', overflowX: 'auto' }}>
        <div style={{ minWidth: 560, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '6px 12px 10px', fontSize: 13, color: 'var(--dim)' }}>
            <span>Indikator</span>
            <span style={{ textAlign: 'right' }}>Terbaru</span>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>lebih rendah</span>
              <span>biasanya</span>
              <span>lebih tinggi</span>
            </span>
            <span style={{ textAlign: 'right' }}>Posisi</span>
          </div>
          {metrics.map((x) => (
            <div
              key={x.key}
              className="ember-row"
              data-tip={zWords(x.z, '2 tahun terakhir')}
              style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'center', padding: '13px 12px' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>{x.label}</span>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{x.what}</span>
              </span>
              <span className="t-title" style={{ fontSize: 19, textAlign: 'right' }}>
                {x.value}
              </span>
              <ZTrack z={x.z} />
              <span style={{ fontSize: 14, textAlign: 'right', fontWeight: Math.abs(x.z) >= 1 ? 600 : 400, color: Math.abs(x.z) >= 1 ? '#ffb27a' : 'var(--mut)' }}>
                {zBand(x.z)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <SourceFootnote env={macro} />
    </Panel>
  );
}
