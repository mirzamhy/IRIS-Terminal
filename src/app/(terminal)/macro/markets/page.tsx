import { LiveOnly } from '@/components/primitives';
import { getMacroMarkets } from '@/lib/features/macroMarkets';
import { MarketsHero } from '@/components/features/macroMarkets/MarketsHero';
import { MarketsTable } from '@/components/features/macroMarkets/MarketsTable';
import { RollingCorrelationCharts } from '@/components/features/macroMarkets/RollingCorrelationCharts';

/** Daily bars upstream; an hour is plenty. */
export const revalidate = 900;

export default async function MacroMarketsPage() {
  const macro = await getMacroMarkets({ range: '1y' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <section className="ember-split" aria-label="Korelasi">
        <div className="side rise" style={{ ['--i' as string]: 2, flex: '1 1 400px' }}>
          <LiveOnly env={macro} title="GLOBAL MARKETS">
            <MarketsHero macro={macro} />
          </LiveOnly>
        </div>
        <div className="main rise" style={{ ['--i' as string]: 3, flex: '999 1 680px' }}>
          <LiveOnly env={macro} title="KORELASI 30 HARI">
            <RollingCorrelationCharts macro={macro} />
          </LiveOnly>
        </div>
      </section>
      <div className="rise" style={{ ['--i' as string]: 4 }}>
        <LiveOnly env={macro} title="PAPAN PASAR">
          <MarketsTable macro={macro} />
        </LiveOnly>
      </div>
    </div>
  );
}
