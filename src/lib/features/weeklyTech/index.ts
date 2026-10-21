import { defineFeature } from '@/lib/defineFeature';
import { fetchWeeklyTech } from './live';
import { mockWeeklyTech } from './mock';
import type { WeeklyTechArgs, WeeklyTechData } from './types';

export const getWeeklyTech = defineFeature<WeeklyTechArgs, WeeklyTechData>({
  key: 'weeklyTech',
  source: 'internal_quant',
  live: fetchWeeklyTech,
  mock: mockWeeklyTech,
  maxAgeSec: 15 * 60,
});

export type { WeeklyTechArgs, WeeklyTechData };
