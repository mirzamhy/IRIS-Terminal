/** One FRED indicator as the Macro pages show it: latest, previous, history. */
export interface MacroIndicator {
  key: string;
  label: string;
  /** What the number is, in a few words. */
  what: string;
  unit: '%' | 'k' | 'pp';
  latest: number;
  previous: number | null;
  /** Observation date of `latest` (period start for monthly data). */
  date: string;
  /** Position against the last two years. */
  z: number;
  /** Oldest first; monthly (quarterly for GDP), about two years. */
  history: { date: string; value: number }[];
  seriesId: string;
}

export interface MacroMetric {
  country: string;
  /** The full US indicator set (2026-10-21). Missing ones failed this render. */
  indicators?: MacroIndicator[];
  cpi: number;
  rate: number;
  growth: number;
  inflation: number;
  zScores: {
    cpi: number;
    rate: number;
    growth: number;
    inflation: number;
  };
}

export interface MacroCountryArgs {
  countries?: string[];
}
