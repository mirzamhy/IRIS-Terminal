import { describe, expect, it } from 'vitest';
import { findDivergences, findLevels, stochSeries, weeklyTech, type WBar } from './weeklyTech';
import { byWeek, weekStart } from '@/lib/sources/weeklyCandles';

const bar = (i: number, c: number, spread = 1): WBar => ({ time: i * 604800, open: c, high: c + spread, low: c - spread, close: c });

describe('weekly technicals', () => {
  it('stochastic is 100 at the top of the range and smooths with SMA3', () => {
    const bars = [1, 2, 3, 4, 5, 6, 7, 8].map((c, i) => ({ ...bar(i, c, 0) }));
    const { k, d } = stochSeries(bars);
    expect(k.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(k[6]).toBeCloseTo(100);
    expect(d[7]).toBeNull();
  });

  it('flags a bearish divergence: price higher high, stoch lower high, confirmed by a cross', () => {
    // Rally closing at the highs, a dip, then a new high made by wicks while
    // closes stay mid-range (momentum fading), then a roll-over.
    const path = [50, 48, 46, 44, 42, 40, 45, 50, 60, 70, 80, 90, 100, 92, 84, 80, 84, 88, 92, 94, 93, 85, 78, 72];
    const bars = path.map((c, i) => bar(i, c, 1));
    [19, 20].forEach((i, n) => (bars[i].high = 103 + n));
    const { k, d } = stochSeries(bars);
    const divs = findDivergences(bars, k, d);
    const bear = divs.find((x) => x.kind === 'bear');
    expect(bear).toBeTruthy();
    expect(bear!.p2).toBeGreaterThan(bear!.p1);
    expect(bear!.k2).toBeLessThan(bear!.k1);
  });

  it('finds a three-touch resistance and drops it after two closes above', () => {
    const wave = (n: number) => Array.from({ length: n }, (_, i) => 90 + 10 * Math.sin((i / 8) * Math.PI * 2));
    const base = wave(40).map((c, i) => bar(i, c, 0.5));
    const lv = findLevels(base);
    expect(lv.some((l) => l.kind === 'resistance' && Math.abs(l.price - 100.5) < 2 && l.touches >= 3)).toBe(true);
    const broken = [...base, bar(40, 104), bar(41, 105)];
    expect(findLevels(broken).some((l) => l.kind === 'resistance' && Math.abs(l.price - 100.5) < 2)).toBe(false);
    // One close above that reverses (a stop hunt) keeps the level.
    const hunt = [...base, bar(40, 104), bar(41, 96)];
    expect(findLevels(hunt).some((l) => l.kind === 'resistance' && Math.abs(l.price - 100.5) < 2)).toBe(true);
  });

  it('needs 205 weeks before it reports', () => {
    expect(weeklyTech(Array.from({ length: 100 }, (_, i) => bar(i, 100 + i)))).toBeNull();
    const t = weeklyTech(Array.from({ length: 260 }, (_, i) => bar(i, 100 + i)))!;
    expect(t.ma200.state).toBe('YES');
    expect(t.goldenCross).toBe(true);
  });

  it('groups Yahoo bars by Monday-open week', () => {
    const mon = Date.UTC(2026, 9, 19) / 1000;
    expect(weekStart(mon + 3 * 86400)).toBe(mon);
    const merged = byWeek([
      { ts: mon, open: 1, high: 5, low: 1, close: 4, volume: 1 },
      { ts: mon + 2 * 86400, open: 4, high: 6, low: 3, close: 5, volume: 1 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ high: 6, close: 5 });
  });
});
