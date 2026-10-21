/**
 * Live macro metrics per country — pulled straight from FRED.
 *
 * Each country maps to four FRED series (headline CPI, policy rate, real GDP
 * growth, core/annual inflation). For every requested country with a mapping we
 * fetch all four in parallel via `fred.getLatestAndZScore`, which also hands
 * back a trailing-window z-score.
 *
 * US only (curation 2026-10-18: the other countries were removed from the
 * dashboard). An unmapped country returns `null` (→ mock).
 *
 * FRED needs `FRED_API_KEY`. With no key `fred.*` throws on the first call,
 * `defineFeature` catches it, and the panel shows MOCK with the unlock note.
 */
import { getLatestAndZScore, getObservations, type FredFrequency, type FredUnits } from '@/lib/sources/fred';
import type { MacroIndicator, MacroMetric, MacroCountryArgs } from './types';

interface SeriesRef {
  id: string;
  units: FredUnits;
  /** Oldest acceptable latest observation, by publication frequency. */
  maxAgeDays: number;
  /** Aggregate a daily series to monthly, so a 24-point z-score spans two years. */
  frequency?: FredFrequency;
}

const MONTHLY = 120;
/**
 * Quarterly observations are dated at the quarter's START, so the newest print
 * can be ~6 months + the release lag old before the next one lands. 200 days
 * expired on 2026-10-18 (Q2 = 2026-04-01, Q3 due end of October) and sent the
 * page to MOCK; 270 = 183 + ~60 days lag + slack.
 */
const QUARTERLY = 270;

/** Observations in two years per frequency, so every z-score is "vs the last 2 years". */
const Z_WINDOW_MONTHLY = 24;
const Z_WINDOW_QUARTERLY = 8;

/**
 * `cpi` stays a level (the panel labels it CPI INDEX). `inflation` and `growth`
 * must be rates: a price index or a real-GDP level is turned into a rate with
 * FRED's `pc1` (% change from a year ago). Before 2026-10-17 inflation was the raw
 * index (US core CPI ~339, rendered "338.90%") and EU/JP/GB growth was a GDP
 * level — so their z-scores measured a trend, not a regime.
 */
interface SeriesMap {
  cpi: SeriesRef;
  rate: SeriesRef;
  growth: SeriesRef;
  inflation: SeriesRef;
}

const lvl = (id: string, maxAgeDays = MONTHLY): SeriesRef => ({ id, units: 'lin', maxAgeDays });
const yoy = (id: string, maxAgeDays = MONTHLY): SeriesRef => ({ id, units: 'pc1', maxAgeDays });

/**
 * FRED keeps discontinued series online with their last value, and a stale value
 * renders exactly like a current one. Measured 2026-10-17: Japan's CPI
 * (JPNCPIALLMINMEI) ended 2021-06, its discount rate 2017-04; the UK's CPI ended
 * 2025-03 and BOERUKM 2017-01 — all were on screen as "current". A country with
 * any series older than its frequency allows is refused (-> badged mock), the
 * same way CN and ID are, instead of being shown.
 */
export function staleSeries(
  results: { ref: SeriesRef; asOf: string }[],
  now: number,
): string[] {
  return results
    .filter(({ ref, asOf }) => now - Date.parse(`${asOf}T00:00:00Z`) > ref.maxAgeDays * 86_400_000)
    .map(({ ref, asOf }) => `${ref.id} (last ${asOf})`);
}

const FRED_SERIES: Record<string, SeriesMap> = {
  US: {
    cpi: lvl('CPIAUCSL'),
    // Upper bound of the target range, the same series the FOMC release card
    // reads (was FEDFUNDS, the monthly average effective rate, which disagreed).
    rate: { id: 'DFEDTARU', units: 'lin', maxAgeDays: MONTHLY, frequency: 'm' },
    growth: lvl('A191RL1Q225SBEA', QUARTERLY), // already a rate: real GDP, QoQ annualised %
    inflation: yoy('CPILFESL'), // core CPI, % y/y
  },
};

const DEFAULT_COUNTRIES = ['US'];

/**
 * The US indicator set. CPI y/y, NFP and the Fed upper bound use exactly the
 * series and transforms of the macro release card (`macroCalendar/live.ts`),
 * so the two cards always agree.
 */
interface IndicatorDef {
  key: string;
  label: string;
  what: string;
  id: string;
  units: FredUnits;
  unit: MacroIndicator['unit'];
  /** Daily / weekly series: history aggregated monthly, latest from the raw series. */
  daily?: boolean;
  quarterly?: boolean;
  /** Multiply values (ICSA is in persons; shown in thousands). */
  scale?: number;
}

export const US_INDICATORS: IndicatorDef[] = [
  { key: 'cpi', label: 'Inflasi CPI', what: 'headline, per tahun', id: 'CPIAUCSL', units: 'pc1', unit: '%' },
  { key: 'core_cpi', label: 'Inflasi inti CPI', what: 'tanpa makanan & energi, per tahun', id: 'CPILFESL', units: 'pc1', unit: '%' },
  { key: 'core_pce', label: 'Inflasi inti PCE', what: 'acuan The Fed, per tahun', id: 'PCEPILFE', units: 'pc1', unit: '%' },
  { key: 'fed', label: 'Suku bunga The Fed', what: 'batas atas target', id: 'DFEDTARU', units: 'lin', unit: '%', daily: true },
  { key: 'nfp', label: 'NFP', what: 'tambahan lapangan kerja, ribu', id: 'PAYEMS', units: 'chg', unit: 'k' },
  { key: 'unrate', label: 'Pengangguran', what: 'tingkat pengangguran', id: 'UNRATE', units: 'lin', unit: '%' },
  { key: 'claims', label: 'Klaim pengangguran', what: 'klaim awal mingguan, ribu', id: 'ICSA', units: 'lin', unit: 'k', daily: true, scale: 0.001 },
  { key: 'gdp', label: 'Pertumbuhan GDP', what: 'riil, kuartal disetahunkan', id: 'A191RL1Q225SBEA', units: 'lin', unit: '%', quarterly: true },
  { key: 'retail', label: 'Penjualan ritel', what: 'perubahan bulanan', id: 'RSAFS', units: 'pch', unit: '%' },
  { key: 'y10', label: 'Yield US 10 tahun', what: 'obligasi pemerintah', id: 'DGS10', units: 'lin', unit: '%', daily: true },
  { key: 'm2', label: 'M2 money supply', what: 'per tahun', id: 'M2SL', units: 'pc1', unit: '%' },
];

async function loadIndicator(d: IndicatorDef): Promise<MacroIndicator> {
  const n = d.quarterly ? 12 : 25;
  const k = d.scale ?? 1;
  const [hist, raw] = await Promise.all([
    getObservations(d.id, n, d.units, d.daily ? 'm' : null),
    d.daily ? getObservations(d.id, 2, d.units) : Promise.resolve(null),
  ]);
  if (hist.length < 2) throw new Error(`fred ${d.id}: ${hist.length} observations`);
  const history = hist.map((o) => ({ date: o.date, value: o.value * k })).reverse();
  const latestObs = raw?.[0] ?? hist[0];
  const latest = latestObs.value * k;
  const vals = history.map((h) => h.value);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return {
    key: d.key,
    label: d.label,
    what: d.what,
    unit: d.unit,
    latest,
    // Previous period: last month's (or quarter's) value, also for daily series.
    previous: history[history.length - 2].value,
    date: latestObs.date,
    z: sd === 0 ? 0 : (latest - mean) / sd,
    history,
    seriesId: d.id,
  };
}

async function loadIndicators(): Promise<MacroIndicator[]> {
  const settled = await Promise.allSettled(US_INDICATORS.map(loadIndicator));
  return settled.flatMap((r, i) => {
    if (r.status === 'fulfilled') return [r.value];
    console.warn(`[macroCountry] ${US_INDICATORS[i].id}:`, r.reason instanceof Error ? r.reason.message : r.reason);
    return [];
  });
}

const zWindow = (ref: SeriesRef) => (ref.maxAgeDays === QUARTERLY ? Z_WINDOW_QUARTERLY : Z_WINDOW_MONTHLY);

export async function fetchMacroCountry({ countries = DEFAULT_COUNTRIES }: MacroCountryArgs) {
  const mapped = countries.filter((c) => FRED_SERIES[c]);

  // Nothing we can serve. If the caller asked for exactly one unmapped country
  // (the pages request one at a time), that is a "no data" — hand back null so
  // the resolver mocks it. If they asked for several, we would have kept the
  // mapped ones; landing here means none were mapped.
  if (mapped.length === 0) return null;

  const rows: MacroMetric[] = [];
  const asOfDates: string[] = [];

  for (const country of mapped) {
    const s = FRED_SERIES[country];
    const [cpi, rate, growth, inflation] = await Promise.all([
      getLatestAndZScore(s.cpi.id, zWindow(s.cpi), s.cpi.units),
      getLatestAndZScore(s.rate.id, zWindow(s.rate), s.rate.units, s.rate.frequency ?? null),
      getLatestAndZScore(s.growth.id, zWindow(s.growth), s.growth.units),
      getLatestAndZScore(s.inflation.id, zWindow(s.inflation), s.inflation.units),
    ]);

    const stale = staleSeries(
      [
        { ref: s.cpi, asOf: cpi.asOf },
        { ref: s.rate, asOf: rate.asOf },
        { ref: s.growth, asOf: growth.asOf },
        { ref: s.inflation, asOf: inflation.asOf },
      ],
      Date.now(),
    );
    if (stale.length > 0) {
      throw new Error(`macro ${country}: stale FRED series ${stale.join(', ')}`);
    }

    // Every input passed the freshness check above, so the newest observation
    // date is an honest age for the panel.
    asOfDates.push(cpi.asOf, rate.asOf, growth.asOf, inflation.asOf);

    const indicators = country === 'US' ? await loadIndicators() : undefined;
    // Daily series (Fed target, 10Y, claims) carry the newest observation.
    indicators?.forEach((x) => asOfDates.push(x.date));
    rows.push({
      country,
      indicators,
      cpi: cpi.latest,
      rate: rate.latest,
      growth: growth.latest,
      inflation: inflation.latest,
      zScores: {
        cpi: cpi.z,
        rate: rate.z,
        growth: growth.z,
        inflation: inflation.z,
      },
    });
  }

  if (rows.length === 0) return null;

  const asOf = asOfDates.sort().at(-1) ?? null;

  return { data: rows, asOf, synthetic: false };
}
