/**
 * Weekly technical checklist, computed from weekly candles (oldest first).
 * Pure functions: the Overview card and the chart studio run the same code,
 * so the lines drawn on the chart are the ones the card reports.
 *
 *   - Stochastic 5,3,3: raw %K over 5 bars, slow %K = SMA3, %D = SMA3 of slow %K.
 *   - Divergence: two consecutive pivots of slow %K (both highs or both lows),
 *     compared with the price extreme around each pivot.
 *       regular bearish  price higher high, stoch lower high
 *       hidden bearish   price lower high,  stoch higher high
 *       regular bullish  price lower low,   stoch higher low
 *       hidden bullish   price higher low,  stoch lower low
 *     A divergence only counts once %K has crossed %D in its direction after
 *     the second pivot ("udah crossing").
 *   - Moving averages: EMA13, EMA21, SMA50, SMA200 on closes. "CLOSE" when the
 *     close sits within CLOSE_BAND of the average.
 *   - Major support / resistance: a level touched by at least three swing highs
 *     (or lows) and never broken by a confirmed close. A close beyond the level
 *     is only a break when the next candle also closes beyond it (second-candle
 *     rule: a single close past it that reverses is treated as a stop hunt).
 */
import { emaSeries, smaSeries, type Maybe } from './ta';

export interface WBar {
  /** Unix seconds, candle open. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type DivKind = 'bull' | 'bear' | 'hidden_bull' | 'hidden_bear';
export type StochState = DivKind | 'cross_bull' | 'cross_bear' | 'neutral';
export type MaState = 'YES' | 'NO' | 'CLOSE';

export interface Divergence {
  kind: DivKind;
  /** Bar indexes of the two pivots. */
  i1: number;
  i2: number;
  /** Price extreme at each pivot (high for bear kinds, low for bull kinds). */
  p1: number;
  p2: number;
  /** Slow %K at each pivot. */
  k1: number;
  k2: number;
  /** Bar where %K crossed %D and confirmed it. */
  confirmedAt: number;
}

export interface SrLevel {
  kind: 'support' | 'resistance';
  price: number;
  touches: number;
  /** Bar index of the first and last touch. */
  first: number;
  last: number;
}

export interface MaCheck {
  value: number;
  /** Close vs the average, percent. */
  distPct: number;
  state: MaState;
}

export interface WeeklyTech {
  close: number;
  asOf: number;
  stoch: {
    k: number;
    d: number;
    state: StochState;
    /** The divergence behind `state`, when it is one. */
    divergence: Divergence | null;
  };
  ema13: MaCheck;
  ema21: MaCheck;
  ma50: MaCheck;
  ma200: MaCheck;
  goldenCross: boolean;
  sr: {
    on: boolean;
    /** The level price is sitting on, when `on`. */
    level: SrLevel | null;
    /** Nearest unbroken level below and above the close. */
    support: SrLevel | null;
    resistance: SrLevel | null;
  };
}

/** Within this percent of an average reads as "CLOSE". */
export const CLOSE_BAND_PCT = 1.5;
/** Within this percent of a major level reads as "on" it. */
export const SR_ON_PCT = 3;
/** Swing highs / lows within this percent of each other touch the same level. */
export const SR_TOUCH_PCT = 2;
/** A divergence is "current" when its second pivot is at most this many bars old. */
export const DIV_FRESH_BARS = 6;
/** A plain %K/%D cross is "current" for this many bars. */
export const CROSS_FRESH_BARS = 2;

/** Stochastic slow %K and %D. */
export function stochSeries(bars: readonly WBar[], kLen = 5, kSmooth = 3, dLen = 3): { k: Maybe[]; d: Maybe[] } {
  const raw: Maybe[] = bars.map((_, i) => {
    if (i < kLen - 1) return null;
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kLen + 1; j <= i; j += 1) {
      hh = Math.max(hh, bars[j].high);
      ll = Math.min(ll, bars[j].low);
    }
    return hh === ll ? 50 : ((bars[i].close - ll) / (hh - ll)) * 100;
  });
  const smooth = (v: Maybe[], n: number): Maybe[] => {
    const start = v.findIndex((x) => x !== null);
    const out: Maybe[] = v.map(() => null);
    if (start < 0) return out;
    smaSeries(v.slice(start) as number[], n).forEach((x, i) => (out[start + i] = x));
    return out;
  };
  const k = smooth(raw, kSmooth);
  return { k, d: smooth(k, dLen) };
}

/**
 * Pivots of a series: index i whose value is the strict extreme of the `left`
 * bars before and at least the extreme of the `right` bars after.
 */
function pivots(v: Maybe[], type: 'high' | 'low', left: number, right: number): number[] {
  const out: number[] = [];
  for (let i = left; i < v.length - right; i += 1) {
    const x = v[i];
    if (x === null) continue;
    let ok = true;
    for (let j = i - left; j <= i + right && ok; j += 1) {
      if (j === i) continue;
      const y = v[j];
      if (y === null) ok = false;
      else if (type === 'high' ? (j < i ? y >= x : y > x) : j < i ? y <= x : y < x) ok = false;
    }
    if (ok) out.push(i);
  }
  return out;
}

const priceAt = (bars: readonly WBar[], i: number, type: 'high' | 'low') => {
  let v = type === 'high' ? -Infinity : Infinity;
  for (let j = Math.max(0, i - 2); j <= Math.min(bars.length - 1, i + 1); j += 1) {
    v = type === 'high' ? Math.max(v, bars[j].high) : Math.min(v, bars[j].low);
  }
  return v;
};

/** Every confirmed stochastic divergence in the series, oldest first. */
export function findDivergences(bars: readonly WBar[], k: Maybe[], d: Maybe[]): Divergence[] {
  const out: Divergence[] = [];
  const crossAfter = (from: number, dir: 'up' | 'down', until: number) => {
    for (let i = from; i <= until && i < k.length; i += 1) {
      const a = k[i];
      const b = d[i];
      if (a === null || b === null) continue;
      if (dir === 'down' ? a < b : a > b) return i;
    }
    return -1;
  };
  for (const type of ['high', 'low'] as const) {
    const ps = pivots(k, type, 3, 1);
    for (let n = 1; n < ps.length; n += 1) {
      const i1 = ps[n - 1];
      const i2 = ps[n];
      if (i2 - i1 < 4 || i2 - i1 > 40) continue;
      const k1 = k[i1] as number;
      const k2 = k[i2] as number;
      // Highs must come from the upper half, lows from the lower half, or
      // every wiggle in the middle would count.
      if (type === 'high' && Math.max(k1, k2) < 60) continue;
      if (type === 'low' && Math.min(k1, k2) > 40) continue;
      const p1 = priceAt(bars, i1, type);
      const p2 = priceAt(bars, i2, type);
      let kind: DivKind | null = null;
      if (type === 'high') {
        if (p2 > p1 && k2 < k1) kind = 'bear';
        else if (p2 < p1 && k2 > k1) kind = 'hidden_bear';
      } else if (p2 < p1 && k2 > k1) kind = 'bull';
      else if (p2 > p1 && k2 < k1) kind = 'hidden_bull';
      if (!kind) continue;
      const next = ps[n + 1] ?? k.length - 1;
      const at = crossAfter(i2, type === 'high' ? 'down' : 'up', Math.min(next, i2 + 6));
      if (at < 0) continue;
      out.push({ kind, i1, i2, p1, p2, k1, k2, confirmedAt: at });
    }
  }
  return out.sort((a, b) => a.i2 - b.i2);
}

/** Major support / resistance levels that are still unbroken at the last bar. */
export function findLevels(bars: readonly WBar[], lookback = 260): SrLevel[] {
  const start = Math.max(0, bars.length - lookback);
  const tol = SR_TOUCH_PCT / 100;
  const out: SrLevel[] = [];
  for (const kind of ['resistance', 'support'] as const) {
    const type = kind === 'resistance' ? 'high' : 'low';
    const series: Maybe[] = bars.map((b, i) => (i < start ? null : type === 'high' ? b.high : b.low));
    const ps = pivots(series, type, 2, 2);
    const used = new Set<number>();
    for (const p of ps) {
      if (used.has(p)) continue;
      const anchor = series[p] as number;
      const touch = ps.filter((q) => Math.abs((series[q] as number) / anchor - 1) <= tol);
      if (touch.length < 3) continue;
      const price = touch.reduce((s, q) => s + (series[q] as number), 0) / touch.length;
      const first = touch[0];
      const last = touch[touch.length - 1];
      // Second-candle rule: broken only by two consecutive closes beyond.
      const beyond = (i: number) => (kind === 'resistance' ? bars[i].close > price * (1 + tol / 2) : bars[i].close < price * (1 - tol / 2));
      let broken = false;
      for (let i = first; i < bars.length - 1 && !broken; i += 1) if (beyond(i) && beyond(i + 1)) broken = true;
      if (broken) continue;
      touch.forEach((q) => used.add(q));
      out.push({ kind, price, touches: touch.length, first, last });
    }
  }
  // Merge levels of the same kind closer than the touch band; keep the most touched.
  const merged: SrLevel[] = [];
  for (const l of out.sort((a, b) => b.touches - a.touches)) {
    if (!merged.some((m) => m.kind === l.kind && Math.abs(m.price / l.price - 1) <= tol)) merged.push(l);
  }
  return merged.sort((a, b) => a.price - b.price);
}

function maCheck(close: number, v: Maybe): MaCheck | null {
  if (v === null) return null;
  const distPct = (close / v - 1) * 100;
  return { value: v, distPct, state: Math.abs(distPct) <= CLOSE_BAND_PCT ? 'CLOSE' : distPct > 0 ? 'YES' : 'NO' };
}

/** The full checklist on the latest bar. Needs ~210 weeks for the MA200. */
export function weeklyTech(bars: readonly WBar[]): WeeklyTech | null {
  if (bars.length < 205) return null;
  const closes = bars.map((b) => b.close);
  const last = bars.length - 1;
  const close = closes[last];
  const at = <T,>(s: T[]) => s[last];

  const { k, d } = stochSeries(bars);
  const kNow = at(k);
  const dNow = at(d);
  if (kNow === null || dNow === null) return null;

  const divs = findDivergences(bars, k, d);
  const fresh = divs.filter((x) => last - x.i2 <= DIV_FRESH_BARS).pop() ?? null;
  let state: StochState = 'neutral';
  if (fresh) state = fresh.kind;
  else {
    for (let i = last; i > last - CROSS_FRESH_BARS && i > 0; i -= 1) {
      const a0 = k[i - 1];
      const b0 = d[i - 1];
      const a1 = k[i];
      const b1 = d[i];
      if (a0 === null || b0 === null || a1 === null || b1 === null) continue;
      if (a0 <= b0 && a1 > b1) {
        state = 'cross_bull';
        break;
      }
      if (a0 >= b0 && a1 < b1) {
        state = 'cross_bear';
        break;
      }
    }
  }

  const ma50s = smaSeries(closes, 50);
  const ma200s = smaSeries(closes, 200);
  const ema13 = maCheck(close, at(emaSeries(closes, 13)));
  const ema21 = maCheck(close, at(emaSeries(closes, 21)));
  const ma50 = maCheck(close, at(ma50s));
  const ma200 = maCheck(close, at(ma200s));
  if (!ema13 || !ema21 || !ma50 || !ma200) return null;

  const levels = findLevels(bars);
  const below = levels.filter((l) => l.price <= close);
  const above = levels.filter((l) => l.price > close);
  const support = below.length ? below[below.length - 1] : null;
  const resistance = above.length ? above[0] : null;
  const near = [support, resistance]
    .filter((l): l is SrLevel => l !== null && Math.abs(close / l.price - 1) * 100 <= SR_ON_PCT)
    .sort((a, b) => Math.abs(close / a.price - 1) - Math.abs(close / b.price - 1));

  return {
    close,
    asOf: bars[last].time,
    stoch: { k: kNow, d: dNow, state, divergence: fresh },
    ema13,
    ema21,
    ma50,
    ma200,
    goldenCross: ma50.value > ma200.value,
    sr: { on: near.length > 0, level: near[0] ?? null, support, resistance },
  };
}

export const STOCH_LABEL: Record<StochState, string> = {
  bull: 'Bullish divergence',
  bear: 'Bearish divergence',
  hidden_bull: 'Hidden bullish div.',
  hidden_bear: 'Hidden bearish div.',
  cross_bull: 'Crossing bull',
  cross_bear: 'Crossing bear',
  neutral: 'Netral',
};
