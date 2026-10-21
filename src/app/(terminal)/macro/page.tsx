import { LiveOnly } from '@/components/primitives';
import { getMacroCountry } from '@/lib/features/macroCountry';
import { COUNTRY_CODES, DEFAULT_COUNTRY, COUNTRIES } from '@/lib/nav';
import { MacroMetrics } from '@/components/features/macro/MacroMetrics';
import { getMacroCalendar } from '@/lib/features/macroCalendar';
import { getMacroMarkets } from '@/lib/features/macroMarkets';
import { MacroCalendar } from '@/components/features/macro/MacroCalendar';
import { RegimeMini, MarketsMini } from '@/components/features/macro/MacroMini';

export const revalidate = 30;

function resolveCountry(raw: string | undefined): string {
  return raw && (COUNTRY_CODES as readonly string[]).includes(raw) ? raw : DEFAULT_COUNTRY;
}

/** Macro overview: the US data, the release calendar, the regime and global markets. */
export default async function MacroOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: rawCountry } = await searchParams;
  const country = resolveCountry(rawCountry);
  const label = COUNTRIES.find((c) => c.code === country)?.display ?? country;

  const [macro, calendar, markets] = await Promise.all([
    getMacroCountry({ countries: [country] }),
    getMacroCalendar({}),
    getMacroMarkets({ range: '1y' }),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <section className="ember-split" aria-label="Data ekonomi AS">
        <div className="main rise" style={{ ['--i' as string]: 2 }}>
          <LiveOnly env={macro} title="DATA EKONOMI AS">
            <MacroMetrics macro={macro} country={country} countryLabel={label} />
          </LiveOnly>
        </div>
        <div className="side rise" style={{ ['--i' as string]: 3 }}>
          <LiveOnly env={calendar} title="JADWAL MAKRO AS">
            <MacroCalendar cal={calendar} />
          </LiveOnly>
        </div>
      </section>
      <section className="ember-row3" aria-label="Fase dan pasar">
        <div className="rise" style={{ ['--i' as string]: 4, flex: '1 1 520px' }}>
          <LiveOnly env={macro} title="FASE EKONOMI">
            <RegimeMini macro={macro} country={country} />
          </LiveOnly>
        </div>
        <div className="rise" style={{ ['--i' as string]: 5, flex: '1 1 520px' }}>
          <LiveOnly env={markets} title="PASAR GLOBAL">
            <MarketsMini markets={markets} />
          </LiveOnly>
        </div>
      </section>
    </div>
  );
}
