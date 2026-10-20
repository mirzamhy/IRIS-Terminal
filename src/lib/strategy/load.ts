import 'server-only';
/**
 * Reads every feature the checklist needs (in parallel) and turns each live
 * envelope into a checklist item. A feature that is on its placeholder layer
 * is listed as unavailable and left out of the tally, never scored.
 */
import type { Envelope } from '@/lib/envelope';
import { getWeeklyForecast } from '@/lib/features/weeklyForecast';
import { getMonthlyForecast } from '@/lib/features/monthlyForecast';
import { getSentiment } from '@/lib/features/sentiment';
import { getSocialSentiment } from '@/lib/features/socialSentiment';
import { getFearGreed } from '@/lib/features/fearGreed';
import { getIndicators } from '@/lib/features/indicators';
import { getMacroCountry } from '@/lib/features/macroCountry';
import { getMacroMarkets } from '@/lib/features/macroMarkets';
import { getMacroCalendar } from '@/lib/features/macroCalendar';
import { getEtfFlows } from '@/lib/features/etfFlows';
import { getChainFlows } from '@/lib/features/chainFlows';
import { getPositioning } from '@/lib/features/positioning';
import { getPowerLaw } from '@/lib/features/powerLawCorridor';
import { getHalvingCycle } from '@/lib/features/halvingCycle';
import { getSeasonality } from '@/lib/features/seasonality';
import { getBtcSnapshot } from '@/lib/features/snapshot';
import type { MacroCalendarData } from '@/lib/features/macroCalendar';
import * as C from './checklist';

export interface StrategyState {
  items: C.CheckItem[];
  /** Signals whose source is down right now (named, not scored). */
  missing: string[];
  tally: C.Tally;
  price: number | null;
  change24hPct: number | null;
  calendar: MacroCalendarData | null;
  /** ISO time the state was assembled. */
  at: string;
}

function take<T>(env: Envelope<T>, label: string, missing: string[], make: (d: T) => C.CheckItem | C.CheckItem[] | null): C.CheckItem[] {
  if (env.isMock) {
    missing.push(label);
    return [];
  }
  try {
    const r = make(env.data);
    return r === null ? [] : Array.isArray(r) ? r : [r];
  } catch {
    missing.push(label);
    return [];
  }
}

export async function loadStrategy(): Promise<StrategyState> {
  const [weekly, monthly, news, social, fg, ind, macro, markets, cal, etf, flows, pos, pl, cycle, season, snap] = await Promise.all([
    getWeeklyForecast({ symbol: 'BTC-USD' }),
    getMonthlyForecast({}),
    getSentiment({ days: 7 }),
    getSocialSentiment({ days: 30 }),
    getFearGreed({ limit: 2 }),
    getIndicators({ symbol: 'BTC-USD', interval: '1d', limit: 365 }),
    getMacroCountry({ countries: ['US'] }),
    getMacroMarkets({ range: '1y' }),
    getMacroCalendar({}),
    getEtfFlows({ limit: 10 }),
    getChainFlows({ symbol: 'BTC' }),
    getPositioning({ hours: 48 }),
    getPowerLaw({}),
    getHalvingCycle({}),
    getSeasonality({ symbol: 'BTC-USD' }),
    getBtcSnapshot({ symbol: 'BTC-USD' }),
  ]);
  const missing: string[] = [];
  const items = [
    ...take(weekly, 'Prakiraan mingguan', missing, C.weeklyItem),
    ...take(monthly, 'Prakiraan 30 hari', missing, C.monthlyItem),
    ...take(news, 'Sentimen berita', missing, C.newsItem),
    ...take(social, 'Sentimen sosial', missing, C.socialItem),
    ...take(fg, 'Fear & Greed', missing, C.fearGreedItem),
    ...take(ind, 'Teknikal harian', missing, C.technicalItem),
    ...take(macro, 'Fase ekonomi AS', missing, (d) => (d[0] ? C.regimeItem(d[0]) : null)),
    ...take(markets, 'Pasar global', missing, (d) => [C.dollarItem(d), C.stocksItem(d)].filter((x): x is C.CheckItem => x !== null)),
    ...take(etf, 'Arus ETF spot', missing, C.etfItem),
    ...take(flows, 'Arus bursa', missing, C.exchangeItem),
    ...take(pos, 'Posisi futures', missing, C.positioningItem),
    ...take(pl, 'Koridor power-law', missing, C.powerLawItem),
    ...take(cycle, 'Siklus halving', missing, C.cycleItem),
    ...take(season, 'Musiman', missing, C.seasonalityItem),
  ];
  return {
    items,
    missing,
    tally: C.tally(items),
    price: snap.isMock ? null : snap.data.last,
    change24hPct: snap.isMock ? null : snap.data.change24hPct,
    calendar: cal.isMock ? null : cal.data,
    at: new Date().toISOString(),
  };
}
