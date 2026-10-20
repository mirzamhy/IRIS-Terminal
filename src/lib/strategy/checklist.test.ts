import { describe, expect, it } from 'vitest';
import { exchangeItem, fearGreedItem, regimeItem, tally, technicalItem, type CheckItem } from './checklist';
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

  it('technicals need two of three rising signals for bull', () => {
    const base = { ema5: 0, ema13: 0, bollingerUpper: 0, bollingerMiddle: 0, bollingerLower: 0 };
    expect(technicalItem({ ...base, rsi: 60, macd: 1, macdSignal: 0, ema8: 2, ema21: 1 }).verdict).toBe('bull');
    expect(technicalItem({ ...base, rsi: 40, macd: 1, macdSignal: 0, ema8: 0, ema21: 1 }).verdict).toBe('neutral');
    expect(technicalItem({ ...base, rsi: 40, macd: 0, macdSignal: 1, ema8: 0, ema21: 1 }).verdict).toBe('bear');
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
