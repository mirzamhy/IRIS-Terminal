import { LiveOnly, Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import { getMacroCountry } from '@/lib/features/macroCountry';
import { COUNTRY_CODES, DEFAULT_COUNTRY, COUNTRIES } from '@/lib/nav';
import { MacroMetrics } from '@/components/features/macro/MacroMetrics';
import { getMacroCalendar } from '@/lib/features/macroCalendar';
import { MacroCalendar } from '@/components/features/macro/MacroCalendar';
import { MacroHistory } from '@/components/features/macro/MacroHistory';

export const revalidate = 30;

function resolveCountry(raw: string | undefined): string {
  return raw && (COUNTRY_CODES as readonly string[]).includes(raw) ? raw : DEFAULT_COUNTRY;
}

/** Economic data only: the latest US prints, the release calendar, and each indicator's history. */
export default async function MacroDataPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: rawCountry } = await searchParams;
  const country = resolveCountry(rawCountry);
  const label = COUNTRIES.find((c) => c.code === country)?.display ?? country;

  const [macro, calendar] = await Promise.all([getMacroCountry({ countries: [country] }), getMacroCalendar({})]);
  const indicators = (macro.data.find((x) => x.country === country) ?? macro.data[0])?.indicators ?? [];

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
      {indicators.length ? (
        <div className="rise" style={{ ['--i' as string]: 4 }}>
          <LiveOnly env={macro} title="RIWAYAT DATA">
            <Panel>
              <PanelHeader title="Riwayat data AS" note="FRED · ±2 tahun" right={<MockBadge env={macro} />} />
              <div style={{ position: 'relative', zIndex: 4, padding: '4px 26px 18px' }}>
                <MacroHistory indicators={indicators} />
              </div>
              <SourceFootnote env={macro} />
            </Panel>
          </LiveOnly>
        </div>
      ) : null}
    </div>
  );
}
