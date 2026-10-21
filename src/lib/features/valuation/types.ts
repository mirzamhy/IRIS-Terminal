export interface ValuationPoint {
  date: string;
  value: number;
}

export interface ValuationData {
  mvrv: {
    /** Live spot ÷ the latest realized price. */
    now: number;
    spot: number;
    realizedPrice: number;
    /** Day of the realized price used. */
    realizedDate: string;
    history: ValuationPoint[];
  };
  /** `null` when bitcoin-data.com did not answer. */
  sopr: {
    latest: number;
    date: string;
    /** Trailing-week SOPR (Bitview) or the 7-day mean (fallback). */
    avg7: number;
    /** `live` = Bitview, per block; `delayed` = bitcoin-data.com, 7 days behind. */
    source: 'live' | 'delayed';
    history: ValuationPoint[];
  } | null;
}

export interface ValuationArgs {
  days?: number;
}
