/** MVRV (live) and SOPR (live from Bitview, delayed fallback) — see `sources/valuation.ts`. */
import { getMvrvDaily, getSoprDaily, getSoprLive } from '@/lib/sources/valuation';
import { getSpot } from '@/lib/sources/coinbase';
import { getCandles as krakenCandles } from '@/lib/sources/kraken';
import type { ValuationArgs, ValuationData } from './types';

async function loadSopr(days: number, start: string): Promise<ValuationData['sopr']> {
  try {
    const { rows, week } = await getSoprLive(days);
    const last = rows[rows.length - 1];
    return { latest: last.sopr, date: last.date, avg7: week, source: 'live', history: rows.map((r) => ({ date: r.date, value: r.sopr })) };
  } catch (err) {
    console.warn('[valuation] bitview sopr:', err instanceof Error ? err.message : err);
  }
  try {
    const s = await getSoprDaily(start);
    const tail = s.slice(-7);
    return {
      latest: s[s.length - 1].sopr,
      date: s[s.length - 1].date,
      avg7: tail.reduce((a, r) => a + r.sopr, 0) / tail.length,
      source: 'delayed',
      history: s.map((r) => ({ date: r.date, value: r.sopr })),
    };
  } catch {
    return null;
  }
}

export async function fetchValuation({ days = 365 }: ValuationArgs) {
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const [mvrvR, sopr, spotR] = await Promise.all([
    getMvrvDaily(start).then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const }),
    ),
    loadSopr(days, start),
    getSpot('BTC-USD')
      .catch(async () => {
        const c = await krakenCandles('1m', 'XBTUSD');
        const last = c[c.length - 1];
        return { price: last.close, volume: 0, time: new Date(last.ts * 1000).toISOString() };
      })
      .catch(() => null),
  ]);
  if (!mvrvR.ok || !spotR) return null;
  const m = mvrvR.v;
  const last = m[m.length - 1];
  const spot = spotR.price;

  const data: ValuationData = {
    mvrv: {
      now: spot / last.realizedPrice,
      spot,
      realizedPrice: last.realizedPrice,
      realizedDate: last.date,
      history: m.map((r) => ({ date: r.date, value: r.mvrv })),
    },
    sopr,
  };
  return { data, asOf: spotR.time ?? new Date(`${last.date}T23:59:59Z`).toISOString(), synthetic: false };
}
