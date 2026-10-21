/**
 * Inputs shared by the Quant pages: the long daily close series, the tip
 * height, the halving dates read from the chain and the live block time.
 * React `cache` makes one render read them once (the HTTP layer additionally
 * caches each response: closes a day, halving blocks 30 days, tip ten minutes).
 */
import { cache } from 'react';
import { HALVINGS_FALLBACK } from '@/lib/quant/config';
import { prepareDaily, isoDay, lastDay, toDay, type DailySeries } from '@/lib/quant/daily';
import { getBtcDailyCloses, type PriceSource } from '@/lib/sources/coinmetrics';
import { getBlockHeight } from '@/lib/sources/blockHeight';
import { getAverageBlockMinutes, getHalvings, type Halving } from '@/lib/sources/halvings';
import { getCandles as coinbaseCandles } from '@/lib/sources/coinbase';
import { getCandles as krakenCandles } from '@/lib/sources/kraken';

export interface CycleInputs {
  series: DailySeries;
  source: PriceSource;
  /** `null` when no height source answered: the next-halving estimate is then not shown. */
  height: number | null;
  halvings: Halving[];
  /** Live average minutes per block (current difficulty epoch), when available. */
  liveBlockMinutes: number | null;
  /** End of the newest close's day (that close is final then). */
  asOf: string;
}

const warn = (what: string) => (err: unknown) => {
  console.warn(`[quant] ${what}:`, err instanceof Error ? err.message : err);
  return null;
};

/**
 * Daily closes up to today. The long history (Coin Metrics, updated daily
 * with a lag of a day or two) is extended with exchange daily candles for the
 * days it does not have yet; today's candle closes at the live price, so the
 * Quant pages always read "today" on every load.
 */
export const loadCloses = cache(async () => {
  const [closes, recent] = await Promise.all([
    getBtcDailyCloses(),
    coinbaseCandles('1d', 30, 'BTC-USD').catch(() => krakenCandles('1d', 'XBTUSD')).catch(warn('recent daily candles')),
  ]);
  const histEnd = closes.rows.reduce((m, r) => (r.date > m ? r.date : m), '');
  const tail = (recent ?? []).map((c) => ({ date: isoDay(Math.floor(c.ts / 86_400)), price: c.close })).filter((r) => r.date > histEnd);
  const series = prepareDaily([...closes.rows, ...tail]);
  if (series.prices.length < 3000) return null;
  const lastTs = recent?.length ? recent[recent.length - 1].ts : null;
  // Today's candle is live (its open is the honest timestamp); a history-only
  // series is final at the end of its last day.
  const asOf = tail.length && lastTs !== null ? new Date(lastTs * 1000).toISOString() : `${isoDay(lastDay(series) + 1)}T00:00:00Z`;
  return { series, source: closes.source, asOf };
});

export const loadCycleInputs = cache(async (): Promise<CycleInputs | null> => {
  const [closes, height, liveBlockMinutes] = await Promise.all([
    loadCloses(),
    getBlockHeight().catch(warn('block height')),
    getAverageBlockMinutes().catch(warn('block time')),
  ]);
  if (!closes) return null;
  // Without a tip height the past halvings still stand (tested fallback list); only the estimate is lost.
  const halvings = height !== null ? await getHalvings(height) : HALVINGS_FALLBACK.map((h) => ({ ...h, ts: null }));
  return { ...closes, height, halvings, liveBlockMinutes };
});

/** One point per week counting back from the last day (so the newest close is always plotted), from `fromIso`. */
export function weeklyIndices(s: DailySeries, fromIso: string): number[] {
  const from = toDay(fromIso) - s.start;
  const out: number[] = [];
  for (let i = s.prices.length - 1; i >= Math.max(0, from); i -= 7) out.push(i);
  return out.reverse();
}
