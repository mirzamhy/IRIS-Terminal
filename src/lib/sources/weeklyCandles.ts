/**
 * BTC weekly candles, Monday-open UTC weeks (the TradingView convention), oldest
 * first. Yahoo's `1wk` bars go back to 2014, enough for a 200-week average;
 * Kraken's 10080-minute bars are the fallback.
 *
 * Yahoo appends the live quote as an extra point stamped "now" after the
 * current week's bar, so bars are regrouped by week start: one bar per week.
 */
import type { Candle } from './coinbase';
import { getCandles as yahooCandles } from './yahooCrypto';
import { getKrakenCandles } from './kraken';

const WEEK = 7 * 86_400;
// 1970-01-01 was a Thursday; Monday 1970-01-05 is the week origin.
const MONDAY0 = 4 * 86_400;

export const weekStart = (ts: number) => Math.floor((ts - MONDAY0) / WEEK) * WEEK + MONDAY0;

export function byWeek(candles: readonly Candle[]): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const t = weekStart(c.ts);
    const last = out[out.length - 1];
    if (last && last.ts === t) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.volume = Math.max(last.volume, c.volume);
    } else out.push({ ...c, ts: t });
  }
  return out;
}

/** Weekly bars plus `asOf`: the newest raw timestamp seen (the live quote). */
export async function getWeeklyCandles(): Promise<{ candles: Candle[]; asOf: number }> {
  let raw: Candle[];
  try {
    raw = await yahooCandles('1w', 'BTC-USD');
    if (raw.length < 210) throw new Error(`yahoo weekly: ${raw.length} bars`);
  } catch {
    raw = await getKrakenCandles('1w', 'XBTUSD');
  }
  return { candles: byWeek(raw), asOf: raw[raw.length - 1]?.ts ?? 0 };
}
