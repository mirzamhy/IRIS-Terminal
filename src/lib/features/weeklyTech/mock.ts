import { seeded } from '@/lib/rng';
import type { WeeklyTechArgs, WeeklyTechData } from './types';

export function mockWeeklyTech({ symbol = 'BTC' }: WeeklyTechArgs): WeeklyTechData {
  const r = seeded(`weeklyTech_${symbol}`);
  const close = 80000 + r() * 20000;
  const ma = (f: number) => {
    const value = close * f;
    const distPct = (close / value - 1) * 100;
    return { value, distPct, state: (Math.abs(distPct) <= 1.5 ? 'CLOSE' : distPct > 0 ? 'YES' : 'NO') as 'YES' | 'NO' | 'CLOSE' };
  };
  return {
    close,
    asOf: 0,
    stoch: { k: 50, d: 50, state: 'neutral', divergence: null },
    ema13: ma(0.97),
    ema21: ma(0.95),
    ma50: ma(0.9),
    ma200: ma(0.8),
    goldenCross: true,
    sr: { on: false, level: null, support: null, resistance: null },
  };
}
