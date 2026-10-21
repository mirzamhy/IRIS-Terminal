import { LiveOnly } from '@/components/primitives';
import { getEtfFlows } from '@/lib/features/etfFlows';
import { getPositioning } from '@/lib/features/positioning';
import { getChainFlows } from '@/lib/features/chainFlows';
import { EtfHero, LargeTransfers, LongShortMini, ReserveMini } from '@/components/features/onchain/OnChainCards';
import { getValuation } from '@/lib/features/valuation';
import { ValuationCard } from '@/components/features/onchain/ValuationCard';

export const revalidate = 60;

/** On-chain overview: ETF flows, the crowd's positioning, exchange reserves, MVRV / SOPR and the large-transfer wire. */
export default async function ChainOverviewPage() {
  const [etf, positioning, flows, valuation] = await Promise.all([
    getEtfFlows({ limit: 10 }),
    getPositioning({ hours: 48 }),
    getChainFlows({ symbol: 'BTC' }),
    getValuation({ days: 365 }),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <section className="ember-split" aria-label="ETF flows and positioning">
        <div className="main rise" style={{ ['--i' as string]: 2 }}>
          <LiveOnly env={etf} title="ETF FLOWS">
            <EtfHero etf={etf} />
          </LiveOnly>
        </div>
        <div className="side">
          <div className="rise" style={{ ['--i' as string]: 3 }}>
            <LiveOnly env={positioning} title="LONG / SHORT">
              <LongShortMini positioning={positioning} />
            </LiveOnly>
          </div>
          <div className="rise" style={{ ['--i' as string]: 4, flex: 1 }}>
            <LiveOnly env={flows} title="EXCHANGE RESERVE">
              <ReserveMini flows={flows} />
            </LiveOnly>
          </div>
        </div>
      </section>
      <div className="rise" style={{ ['--i' as string]: 5 }}>
        <LiveOnly env={valuation} title="MVRV & SOPR">
          <ValuationCard val={valuation} />
        </LiveOnly>
      </div>
      <div className="rise" style={{ ['--i' as string]: 7 }}>
        <LiveOnly env={flows} title="TRANSFER BESAR">
          <LargeTransfers flows={flows} />
        </LiveOnly>
      </div>
    </div>
  );
}
