import type { ValuationArgs, ValuationData } from './types';

export function mockValuation(_args: ValuationArgs): ValuationData {
  void _args;
  return {
    mvrv: { now: 1.5, spot: 80000, realizedPrice: 53333, realizedDate: '2026-01-01', history: [] },
    sopr: null,
  };
}
