import { Panel, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroMarketsData } from '@/lib/features/macroMarkets';
import { Tile, fmtR, marketName, MARKET_LIKE, POS, NEG } from '../macro/ui';

/** With 30 returns, |r| below this is indistinguishable from no relationship (large-sample 95% band). */
const NOISE = 1.96 / Math.sqrt(30);

/** Global-markets hero: what BTC has been trading like, and its strongest pull either way. */
export function MarketsHero({ macro }: { macro: Envelope<MacroMarketsData> }) {
  const withCorr = macro.data.series.filter((s) => s.corr30d !== null);
  const most = [...withCorr].sort((a, b) => (b.corr30d ?? 0) - (a.corr30d ?? 0))[0];
  const least = [...withCorr].sort((a, b) => (a.corr30d ?? 0) - (b.corr30d ?? 0))[0];
  const tied = most && (most.corr30d ?? 0) >= NOISE;
  const headline = tied ? MARKET_LIKE[most.key] ?? marketName(most) : 'Jalan sendiri';
  const line = !most
    ? 'Belum cukup data untuk korelasi 30 hari.'
    : tied
      ? `Korelasi 30 hari dengan ${marketName(most)} ${fmtR(most.corr30d)}.${least && (least.corr30d ?? 0) <= -NOISE ? ` ${marketName(least)} paling berlawanan (${fmtR(least.corr30d)}).` : ''}`
      : 'Tidak ada pasar yang bergerak jelas searah dengan BTC dalam 30 hari terakhir.';

  return (
    <Panel style={{ height: '100%' }}>
      <div className="ember-halo" aria-hidden="true" style={{ top: -320, left: -240 }} />
      <div style={{ position: 'relative', zIndex: 4, padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--mut)' }}>Bitcoin sedang bergerak seperti</h2>
          <MockBadge env={macro} />
        </span>
        <span className={`t-display${tied ? ' t-accent' : ''}`} style={{ fontSize: 'clamp(52px, 6vw, 72px)', color: tied ? 'var(--accent)' : 'var(--txt)' }}>
          {headline}
        </span>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: '#e9ddd2' }}>{line}</p>
        {most && least ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Tile k="Paling searah" v={marketName(most)} hint={fmtR(most.corr30d)} hintColor={POS} on />
            <Tile k="Paling berlawanan" v={marketName(least)} hint={fmtR(least.corr30d)} hintColor={NEG} />
          </div>
        ) : null}
      </div>
      <SourceFootnote env={macro} />
    </Panel>
  );
}
