import { Panel, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { ChainFlowsData, FlowTransfer } from '@/lib/features/chainFlows';
import { LivePill, FreshRows } from '@/components/shell/LiveFeed';
import { TransferRow, nowSec, readAt } from '@/components/features/onchain/OnChainCards';

export interface FlowRadarProps {
  flows: Envelope<ChainFlowsData>;
  limit?: number;
}

const KIND_GROUP: Record<FlowTransfer['kind'], 'in' | 'out' | 'move'> = {
  EXCHANGE_INFLOW: 'in',
  HOT_LOADING: 'in',
  EXCHANGE_OUTFLOW: 'out',
  COLD_STORING: 'out',
  INTER_EXCHANGE: 'move',
  WALLET_TRANSFER: 'move',
};

/**
 * The wire, live: every classified movement over 50 BTC touching a tracked
 * wallet, newest first, re-read every 30 seconds with new rows flashing. The
 * strip above counts what the window holds by direction: coins moving onto
 * exchanges (can be sold), off them (taken away), or between wallets.
 */
export function FlowRadar({ flows, limit = 10 }: FlowRadarProps) {
  const all = [...flows.data.transfers].sort((a, b) => (b.blockTime || Infinity) - (a.blockTime || Infinity));
  const rows = all.slice(0, limit);
  const sum = (g: 'in' | 'out' | 'move') => all.filter((t) => KIND_GROUP[t.kind] === g).reduce((s, t) => s + t.amountBtc, 0);
  const groups = [
    { k: 'Ke bursa', v: sum('in'), c: '#6b4a35' },
    { k: 'Dari bursa', v: sum('out'), c: 'var(--accent)' },
    { k: 'Antar dompet', v: sum('move'), c: '#3a2b20' },
  ];
  const total = Math.max(1, groups.reduce((s, g) => s + g.v, 0));

  return (
    <Panel style={{ height: '100%' }}>
      <div style={{ position: 'relative', zIndex: 4, padding: '24px 26px 10px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 className="t-title" style={{ margin: 0, fontSize: 22 }}>
            Flow radar
          </h2>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>Transfer ≥ 50 BTC · terbaru di atas</span>
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <LivePill renderedAt={readAt(flows)} />
          <MockBadge env={flows} />
        </span>
      </div>
      <div style={{ position: 'relative', zIndex: 4, padding: '4px 26px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', height: 12, gap: 3 }}>
          {groups.map((g) =>
            g.v > 0 ? (
              <span
                key={g.k}
                className="ember-grow"
                data-tip={`${g.k}\n${Math.round(g.v).toLocaleString('en-US')} BTC · ${((g.v / total) * 100).toFixed(0)}%`}
                style={{ width: `${(g.v / total) * 100}%`, borderRadius: 999, background: g.c }}
              />
            ) : null,
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: 'var(--mut)' }}>
          {groups.map((g) => (
            <span key={g.k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: g.c }} />
              {g.k} <b style={{ color: 'var(--txt)' }}>{Math.round(g.v).toLocaleString('en-US')}</b>
            </span>
          ))}
        </div>
      </div>
      <FreshRows ids={rows.map((t) => t.txid)} style={{ position: 'relative', zIndex: 4, padding: '0 26px 14px', display: 'flex', flexWrap: 'wrap', gap: '2px 32px' }}>
        {rows.length === 0 ? <span style={{ fontSize: 14, color: 'var(--mut)', padding: '8px 0' }}>Belum ada transfer di atas 50 BTC di jendela ini.</span> : null}
        {rows.map((t) => (
          <TransferRow key={t.txid} t={t} wide nowSec={nowSec(flows)} />
        ))}
      </FreshRows>
      <SourceFootnote env={flows} />
    </Panel>
  );
}
