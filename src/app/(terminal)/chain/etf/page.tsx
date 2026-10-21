import { LiveOnly } from '@/components/primitives';
import { getEtfFlows } from '@/lib/features/etfFlows';
import { EtfHero, EtfFunds } from '@/components/features/onchain/OnChainCards';
import { FlowMatrix } from '@/components/features/etf/FlowMatrix';

/** The ETF table updates once a session (after the US close). */
export const revalidate = 300;

/** Spot ETF flows only: the daily net flow, the matrix and each fund. */
export default async function EtfFlowsPage() {
  const etf = await getEtfFlows({ limit: 10 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <div className="rise" style={{ ['--i' as string]: 2 }}>
        <LiveOnly env={etf} title="ETF FLOWS">
          <EtfHero etf={etf} />
        </LiveOnly>
      </div>
      <section className="ember-split" aria-label="Per fund">
        <div className="main rise" style={{ ['--i' as string]: 3 }}>
          <LiveOnly env={etf} title="FLOW MATRIX">
            <FlowMatrix etf={etf} />
          </LiveOnly>
        </div>
        <div className="side rise" style={{ ['--i' as string]: 4 }}>
          <LiveOnly env={etf} title="PER FUND">
            <EtfFunds etf={etf} />
          </LiveOnly>
        </div>
      </section>
    </div>
  );
}
