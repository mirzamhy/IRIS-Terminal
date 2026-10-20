import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroMarketsData, MarketSeries } from '@/lib/features/macroMarkets';
import { fmtLevel } from '@/lib/features/macroMarkets';
import { zWordsShort } from '@/lib/zWords';
import { MiniSpark } from './MiniSpark';
import { CorrBar, MARKET_GROUP, marketName, fmtChg, chgColor } from '../macro/ui';

const GROUP_ORDER = ['Saham', 'Suku bunga & mata uang', 'Komoditas'];

/**
 * What the rest of the world is doing, and how closely BTC has been following,
 * grouped by asset class.
 *
 * Symbols that failed upstream are listed under the board rather than dropped —
 * a missing row is information, and silently shortening the list would hide it.
 */
export function MarketsTable({ macro }: { macro: Envelope<MacroMarketsData> }) {
  const d = macro.data;
  const groups = new Map<string, MarketSeries[]>();
  for (const s of d.series) {
    const g = MARKET_GROUP[s.key] ?? 'Lainnya';
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  const rank = (g: string) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  const ordered = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  const cols = 'minmax(150px, 1.6fr) minmax(80px, 1fr) repeat(3, minmax(64px, 0.8fr)) minmax(120px, 1.2fr) minmax(140px, 1.4fr)';

  return (
    <Panel>
      <PanelHeader title="Papan pasar" note="harian · Yahoo Finance" right={<MockBadge env={macro} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '0 14px 14px', overflowX: 'auto' }}>
        <div style={{ minWidth: 860, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '0 12px 8px', fontSize: 13, color: 'var(--dim)' }}>
            <span>Pasar</span>
            <span style={{ textAlign: 'right' }}>Terakhir</span>
            <span style={{ textAlign: 'right' }}>1 hari</span>
            <span style={{ textAlign: 'right' }}>5 hari</span>
            <span style={{ textAlign: 'right' }}>30 hari</span>
            <span>Setahun</span>
            <span>Korelasi dengan BTC</span>
          </div>
          {ordered.map(([g, rows]) => (
            <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 12px 6px', fontSize: 14, fontWeight: 600, color: 'var(--mut)' }}>{g}</div>
              {rows.map((s) => (
                <div key={s.key} className="ember-row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'center', padding: 12, fontSize: 15 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                    <span>{marketName(s)}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{s.symbol}</span>
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 600 }} data-tip={`Level vs setahun terakhir: ${zWordsShort(s.z1y).toLowerCase()}`}>
                    {fmtLevel(s)}
                  </span>
                  <span style={{ textAlign: 'right', color: chgColor(s.change1dPct) }}>{fmtChg(s.change1dPct)}</span>
                  <span style={{ textAlign: 'right', color: chgColor(s.change5dPct) }}>{fmtChg(s.change5dPct)}</span>
                  <span style={{ textAlign: 'right', color: chgColor(s.change30dPct) }}>{fmtChg(s.change30dPct)}</span>
                  <MiniSpark
                    fmt={(v: number) => (s.kind === 'rate' ? `${v.toFixed(2)}%` : v.toLocaleString('en-US', { maximumFractionDigits: 2 }))}
                    points={s.points}
                    stroke={s.change30dPct >= 0 ? 'var(--accent)' : '#b8663a'}
                  />
                  <CorrBar r={s.corr30d} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {d.missing.length > 0 ? <p style={{ margin: '10px 12px 0', fontSize: 12.5, color: 'var(--amber)' }}>Tidak tersedia: {d.missing.join(' · ')}</p> : null}
      </div>
      <SourceFootnote env={macro} />
    </Panel>
  );
}
