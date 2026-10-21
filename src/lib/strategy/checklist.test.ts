import { describe, expect, it } from 'vitest';
import { exchangeItem, fearGreedItem, regimeItem, tally, weeklyTechItems, type CheckItem } from './checklist';
import type { WeeklyTechData } from '@/lib/features/weeklyTech/types';
import type { ChainFlowsData } from '@/lib/features/chainFlows/types';

const item = (verdict: CheckItem['verdict']): CheckItem => ({ key: verdict + Math.random(), group: 'Model', label: '', reading: '', verdict, rule: '', href: '/' });

describe('strategy checklist', () => {
  it('tally counts each verdict and leans by the share of leaning signals', () => {
    const t = tally([item('bull'), item('bull'), item('bull'), item('bear'), item('neutral')]);
    expect(t).toMatchObject({ bull: 3, bear: 1, neutral: 1, total: 5, bullShare: 75, lean: 'bull' });
    expect(tally([item('neutral')]).lean).toBe('neutral');
    expect(tally([item('bear'), item('bear'), item('bull')]).lean).toBe('bear');
  });

  it('fear & greed reads 55 and up as bull, 45 and down as bear', () => {
    expect(fearGreedItem({ value: 55, classification: 'Greed', changePct: 0 }).verdict).toBe('bull');
    expect(fearGreedItem({ value: 50, classification: 'Neutral', changePct: 0 }).verdict).toBe('neutral');
    expect(fearGreedItem({ value: 45, classification: 'Fear', changePct: 0 }).verdict).toBe('bear');
  });

  it('weekly technicals: stoch state, MAs (3 of 4), golden cross, S/R', () => {
    const ma = (state: 'YES' | 'NO' | 'CLOSE', value = 1) => ({ value, distPct: 0, state });
    const t: WeeklyTechData = {
      close: 100,
      asOf: 0,
      stoch: { k: 30, d: 20, state: 'hidden_bull', divergence: null },
      ema13: ma('YES'),
      ema21: ma('YES'),
      ma50: ma('YES', 90),
      ma200: ma('CLOSE', 80),
      goldenCross: true,
      sr: { on: true, level: { kind: 'resistance', price: 101, touches: 3, first: 0, last: 1 }, support: null, resistance: null },
    };
    const [stoch, mas, golden, sr] = weeklyTechItems(t);
    expect(stoch.verdict).toBe('bull');
    expect(mas.verdict).toBe('bull');
    expect(golden.verdict).toBe('bull');
    expect(sr.verdict).toBe('bear');
    const bear = weeklyTechItems({ ...t, stoch: { ...t.stoch, state: 'bear' }, ema13: ma('NO'), ema21: ma('NO'), ma50: ma('NO'), goldenCross: false });
    expect(bear.map((i) => i.verdict).slice(0, 3)).toEqual(['bear', 'bear', 'bear']);
  });

  it('coins leaving exchanges count as bull', () => {
    expect(exchangeItem({ netflowBtc: -500 } as ChainFlowsData).verdict).toBe('bull');
    expect(exchangeItem({ netflowBtc: 500 } as ChainFlowsData).verdict).toBe('bear');
  });

  it('macro: Goldilocks bull, Stagflation bear, near-normal neutral', () => {
    const m = (growth: number, inflation: number) => ({ country: 'US', cpi: 0, rate: 0, growth: 0, inflation: 0, zScores: { cpi: 0, rate: 0, growth, inflation } });
    expect(regimeItem(m(1.5, -1.2)).verdict).toBe('bull');
    expect(regimeItem(m(-1.5, 1.2)).verdict).toBe('bear');
    expect(regimeItem(m(0.4, -0.3)).verdict).toBe('neutral');
  });
});
