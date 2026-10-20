import { describe, expect, it } from 'vitest';
import { bollingerSeries, emaSeries, macdSeries, rsiSeries, smaSeries } from './ta';

describe('indicator series', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('SMA is null until the window fills, then the window mean', () => {
    expect(smaSeries(v, 3)).toEqual([null, null, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('EMA seeds with the SMA and then smooths', () => {
    const e = emaSeries(v, 3);
    expect(e.slice(0, 3)).toEqual([null, null, 2]);
    expect(e[3]).toBeCloseTo(4 * 0.5 + 2 * 0.5);
  });

  it('Bollinger is symmetric around the SMA', () => {
    const b = bollingerSeries([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
    expect(b.mid[7]).toBe(5);
    expect(b.upper[7]).toBeCloseTo(9);
    expect(b.lower[7]).toBeCloseTo(1);
  });

  it('RSI is 100 on a straight climb and starts after n changes', () => {
    const r = rsiSeries(v, 5);
    expect(r[4]).toBeNull();
    expect(r[5]).toBe(100);
    expect(r[9]).toBe(100);
  });

  it('MACD histogram is the line minus its signal', () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10);
    const m = macdSeries(series);
    const i = 59;
    expect(m.hist[i]).toBeCloseTo((m.macd[i] as number) - (m.signal[i] as number));
    expect(m.macd[24]).toBeNull();
  });
});
