/** Weekly technical checklist from Monday-open weekly candles. */
import { getWeeklyCandles } from '@/lib/sources/weeklyCandles';
import { weeklyTech } from '@/lib/quant/weeklyTech';
import type { WeeklyTechData } from './types';

export async function fetchWeeklyTech(): Promise<{ data: WeeklyTechData; asOf: string | null; synthetic: boolean } | null> {
  const { candles, asOf } = await getWeeklyCandles();
  const data = weeklyTech(candles.map((c) => ({ time: c.ts, open: c.open, high: c.high, low: c.low, close: c.close })));
  if (!data) return null;
  return { data, asOf: new Date(asOf * 1000).toISOString(), synthetic: false };
}
