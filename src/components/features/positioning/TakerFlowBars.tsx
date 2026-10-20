import { Panel, MockBadge, SourceFootnote } from '@/components/primitives';
import { fmtHour } from '@/lib/dates';
import type { Envelope } from '@/lib/envelope';
import type { PositioningData } from '@/lib/features/positioning';
import { TAKER_NOTE } from '@/lib/features/positioning';
import { fmtCompact } from '@/lib/format';

/**
 * Hourly aggressive flow as the mockup draws it: market buys above the line,
 * market sells below, one column per hour. A buy bar is lit when buyers beat
 * sellers that hour. Heights are on a square-root scale; hover a column for
 * both sides and the net.
 */
export function TakerFlowBars({ positioning, hours = 24 }: { positioning: Envelope<PositioningData>; hours?: number }) {
  const rows = positioning.data.taker.slice(-hours);
  const n = rows.length;

  if (n === 0) {
    return (
      <Panel>
        <div style={{ padding: 26, fontSize: 14, color: 'var(--dim)' }}>Data taker sedang tidak tersedia.</div>
        <SourceFootnote env={positioning} />
      </Panel>
    );
  }

  const peak = Math.max(1, ...rows.map((r) => Math.max(r.buyVol, r.sellVol)));
  // Square-root heights: one panic hour would otherwise flatten every other bar. Hover gives the exact volume.
  const h = (v: number) => `${Math.max(2, Math.sqrt(v / peak) * 100)}%`;
  const buy = rows.reduce((s, r) => s + r.buyVol, 0);
  const sell = rows.reduce((s, r) => s + r.sellVol, 0);
  const net = buy - sell;
  // Binance reports taker volume in BTC.
  const btc = (v: number) => `${fmtCompact(v, '')} BTC`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => rows[Math.round(f * (n - 1))]);

  return (
    <Panel>
      <div style={{ position: 'relative', zIndex: 4, padding: '24px 26px 4px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="t-title" style={{ margin: 0, fontSize: 22 }}>
              Taker flow, {n} jam terakhir
            </h2>
            <MockBadge env={positioning} />
          </span>
          <span style={{ fontSize: 14, color: 'var(--mut)' }} data-tip={TAKER_NOTE}>
            Beli market di atas garis, jual market di bawah
          </span>
        </span>
        <div style={{ display: 'flex', gap: 28 }}>
          {(
            [
              ['Dibeli', btc(buy), '#ffb27a'],
              ['Dijual', btc(sell), 'var(--txt)'],
              ['Bersih', `${net >= 0 ? '+' : '−'}${btc(Math.abs(net))}`, net >= 0 ? '#ffb27a' : 'var(--down)'],
            ] as const
          ).map(([k, v, c]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>{k}</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 4, padding: '16px 26px 8px' }}>
        <div role="img" aria-label={`Volume taker beli dan jual per jam, ${n} jam`} style={{ display: 'flex', gap: n > 36 ? 3 : 6, height: 220 }}>
          {rows.map((r) => {
            const lit = r.buyVol > r.sellVol;
            return (
              <div
                key={r.ts}
                data-tip={`${fmtHour(r.ts)}\nBeli ${btc(r.buyVol)}\nJual ${btc(r.sellVol)}\nBersih ${r.netVol >= 0 ? '+' : '−'}${btc(Math.abs(r.netVol))}`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
              >
                <div style={{ height: '50%', display: 'flex', alignItems: 'flex-end' }}>
                  <div
                    style={{
                      width: '100%',
                      height: h(r.buyVol),
                      borderRadius: '4px 4px 1px 1px',
                      background: lit ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, var(--panel))',
                      boxShadow: lit ? '0 0 10px color-mix(in srgb, var(--accent) 40%, transparent)' : undefined,
                    }}
                  />
                </div>
                <div style={{ height: 2, background: '#3a2b20' }} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: '100%', height: h(r.sellVol), borderRadius: '1px 1px 4px 4px', background: '#6b4a35' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8f7d70', marginTop: 10 }}>
          {ticks.map((t, i) => (
            <span key={`${t.ts}-${i}`}>{i === ticks.length - 1 ? 'Sekarang' : fmtHour(t.ts).replace(' UTC', '').split(' ').pop()}</span>
          ))}
        </div>
      </div>
      <SourceFootnote env={positioning} />
    </Panel>
  );
}
