/**
 * Indicator series for the chart studio: one output per input, `null` until the
 * window has filled (so the line starts where the indicator is defined, rather
 * than at a made-up value). Plain textbook definitions:
 *   - SMA: mean of the last n;
 *   - EMA: α = 2/(n+1), seeded with the SMA of the first n;
 *   - Bollinger: SMA ± k·σ (population σ of the same window);
 *   - RSI: Wilder's smoothing of gains and losses;
 *   - MACD: EMA12 − EMA26, signal EMA9 of that, histogram the difference.
 */

export type Maybe = number | null;

export function smaSeries(v: readonly number[], n: number): Maybe[] {
  const out: Maybe[] = [];
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) {
    sum += v[i];
    if (i >= n) sum -= v[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

export function emaSeries(v: readonly number[], n: number): Maybe[] {
  const out: Maybe[] = [];
  const a = 2 / (n + 1);
  let prev: number | null = null;
  let seed = 0;
  for (let i = 0; i < v.length; i += 1) {
    if (prev === null) {
      seed += v[i];
      if (i === n - 1) prev = seed / n;
      out.push(prev);
    } else {
      prev = v[i] * a + prev * (1 - a);
      out.push(prev);
    }
  }
  return out;
}

export function bollingerSeries(v: readonly number[], n = 20, k = 2): { mid: Maybe[]; upper: Maybe[]; lower: Maybe[] } {
  const mid = smaSeries(v, n);
  const upper: Maybe[] = [];
  const lower: Maybe[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const m = mid[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - n + 1; j <= i; j += 1) s += (v[j] - m) ** 2;
    const sd = Math.sqrt(s / n);
    upper.push(m + k * sd);
    lower.push(m - k * sd);
  }
  return { mid, upper, lower };
}

export function rsiSeries(v: readonly number[], n = 14): Maybe[] {
  const out: Maybe[] = v.map(() => null);
  if (v.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i += 1) {
    const d = v[i] - v[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < v.length; i += 1) {
    const d = v[i] - v[i - 1];
    gain = (gain * (n - 1) + Math.max(0, d)) / n;
    loss = (loss * (n - 1) + Math.max(0, -d)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macdSeries(v: readonly number[], fast = 12, slow = 26, signal = 9): { macd: Maybe[]; signal: Maybe[]; hist: Maybe[] } {
  const f = emaSeries(v, fast);
  const s = emaSeries(v, slow);
  const line: Maybe[] = v.map((_, i) => (f[i] !== null && s[i] !== null ? (f[i] as number) - (s[i] as number) : null));
  const start = line.findIndex((x) => x !== null);
  const sig: Maybe[] = v.map(() => null);
  if (start >= 0) {
    const tail = emaSeries(line.slice(start) as number[], signal);
    tail.forEach((x, i) => (sig[start + i] = x));
  }
  const hist: Maybe[] = v.map((_, i) => (line[i] !== null && sig[i] !== null ? (line[i] as number) - (sig[i] as number) : null));
  return { macd: line, signal: sig, hist };
}
