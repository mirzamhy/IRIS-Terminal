/**
 * MVRV and SOPR.
 *
 * MVRV live: Coin Metrics Community publishes daily `CapMVRVCur` and
 * `CapMrktCurUSD` (keyless); their ratio is the realized cap, and realized cap
 * ÷ `SplyCur` is the realized price. Realized price drifts slowly (well under
 * 1% a day), so the live MVRV is the live spot ÷ yesterday's realized price.
 *
 * SOPR live: Bitview (`getSoprLive`), recomputed every block. Fallback:
 * bitcoin-data.com (BGeometrics), free with the last 7 days withheld; the
 * card says which one answered and dates the value.
 *
 * Docs: https://docs.coinmetrics.io/api/v4 · https://bitcoin-data.com/api
 */
import { fetchJson } from './http';

const CM = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const BG = 'https://bitcoin-data.com/v1';

export interface MvrvDaily {
  date: string;
  mvrv: number;
  realizedPrice: number;
}

interface CmRow {
  time?: string;
  CapMVRVCur?: string;
  CapMrktCurUSD?: string;
  SplyCur?: string;
}

/** Daily MVRV and realized price, oldest first, from `startIso`. */
export async function getMvrvDaily(startIso: string): Promise<MvrvDaily[]> {
  const out: MvrvDaily[] = [];
  let url: string | undefined = `${CM}?assets=btc&metrics=CapMVRVCur,CapMrktCurUSD,SplyCur&frequency=1d&start_time=${startIso}&page_size=10000`;
  for (let page = 0; url && page < 3; page += 1) {
    const j: { data?: CmRow[]; next_page_url?: string } = await fetchJson(url, { revalidate: 3600, timeoutMs: 20_000 });
    if (!Array.isArray(j?.data)) throw new Error('coinmetrics: missing data array');
    for (const r of j.data) {
      const mvrv = Number(r.CapMVRVCur);
      const cap = Number(r.CapMrktCurUSD);
      const sply = Number(r.SplyCur);
      if (!r.time || !(mvrv > 0) || !(cap > 0) || !(sply > 0)) continue;
      out.push({ date: r.time.slice(0, 10), mvrv, realizedPrice: cap / mvrv / sply });
    }
    url = j.next_page_url;
  }
  if (out.length < 30) throw new Error(`coinmetrics mvrv: only ${out.length} rows`);
  return out;
}

export interface SoprDaily {
  date: string;
  sopr: number;
}

const BV = 'https://bitview.space/api/series';

interface BvSeries<T> {
  data?: T[];
  stamp?: string;
}

/**
 * Live SOPR from Bitview (bitview.space, the open-source Bitcoin Research Kit
 * running its own node; keyless). `sopr_24h` is the trailing-24h SOPR
 * recomputed every block, so today's point moves during the day; `sopr_1w`
 * is the trailing-week value. Oldest first.
 */
export async function getSoprLive(days: number): Promise<{ rows: SoprDaily[]; week: number; stamp: string | null }> {
  const [vals, dates, week] = await Promise.all([
    fetchJson<BvSeries<number>>(`${BV}/sopr_24h/day1?from=-${days}`, { revalidate: 300 }),
    fetchJson<BvSeries<string>>(`${BV}/date/day1?from=-${days}`, { revalidate: 300 }),
    fetchJson<BvSeries<number>>(`${BV}/sopr_1w/day1?from=-1`, { revalidate: 300 }),
  ]);
  const v = vals.data ?? [];
  const d = dates.data ?? [];
  if (v.length < 10 || v.length !== d.length) throw new Error(`bitview sopr: ${v.length} values, ${d.length} dates`);
  const rows = v.map((sopr, i) => ({ date: d[i], sopr: Number(sopr) })).filter((r) => Number.isFinite(r.sopr) && r.sopr > 0);
  const w = Number(week.data?.[week.data.length - 1]);
  if (!Number.isFinite(w)) throw new Error('bitview sopr_1w: no value');
  return { rows, week: w, stamp: vals.stamp ?? null };
}

/** Daily SOPR from bitcoin-data.com, oldest first. Free tier lags 7 days (fallback only). */
export async function getSoprDaily(startIso: string): Promise<SoprDaily[]> {
  // Free tier allows a handful of calls an hour: cache for six hours.
  const j = await fetchJson<{ d?: string; sopr?: number | string | null }[]>(`${BG}/sopr?startday=${startIso}`, { revalidate: 6 * 3600, timeoutMs: 20_000 });
  if (!Array.isArray(j)) throw new Error('bitcoin-data.com sopr: not an array');
  const out = j
    .map((r) => ({ date: String(r.d ?? '').slice(0, 10), sopr: Number(r.sopr) }))
    .filter((r) => r.date && Number.isFinite(r.sopr) && r.sopr > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (out.length < 10) throw new Error(`bitcoin-data.com sopr: only ${out.length} rows`);
  return out;
}
