import { defineFeature } from '@/lib/defineFeature';
import { MAX_AGE_SEC } from '@/lib/maxAge';
import { fetchValuation } from './live';
import { mockValuation } from './mock';
import type { ValuationArgs, ValuationData } from './types';

export const getValuation = defineFeature<ValuationArgs, ValuationData>({
  key: 'valuation',
  source: 'coinmetrics',
  live: fetchValuation,
  mock: mockValuation,
  maxAgeSec: MAX_AGE_SEC.spot,
});

export type { ValuationArgs, ValuationData };
