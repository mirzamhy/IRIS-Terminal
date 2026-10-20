/**
 * US macro calendar from the publishers themselves — no hand-kept dates
 * (IRIS_koreksi_auto_compute.md §4, replacing the standing "FOMC / CPI"
 * markers removed on 2026-10-16):
 *   - CPI and NFP: FRED release dates (`include_release_dates_with_no_data`,
 *     so announced future dates appear before any data does);
 *   - FOMC: the Federal Reserve's calendar page, parsed fail-loud.
 * A source that fails drops its events and is named in `missing`; when every
 * source fails the panel is hidden. Nothing is filled in.
 *
 * `asOf` is the most recent event that already happened (the newest schedule
 * point the sources confirmed); the panel goes STALE if that is months old.
 */
import { getFomcMeetings } from '@/lib/sources/fomc';
import { FRED_RELEASE, getObservations, getReleaseDates } from '@/lib/sources/fred';
import type { MacroCalendarArgs, MacroCalendarData, MacroEvent, MacroEventKind, MacroRelease } from './types';

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * What the last CPI, NFP and FOMC actually printed, against the print before:
 *   - CPI: headline CPI (CPIAUCSL) year on year, the two newest months;
 *   - NFP: payrolls added (PAYEMS month-on-month change, thousands);
 *   - FOMC: the upper bound of the target range (DFEDTARU) after the meeting
 *     against the day before it.
 * Each is independent; one that fails is simply left out.
 */
async function loadRecent(last: Partial<Record<MacroEventKind, string>>): Promise<MacroRelease[]> {
  const jobs: Promise<MacroRelease | null>[] = [
    (async () => {
      if (!last.CPI) return null;
      const o = await getObservations('CPIAUCSL', 3, 'pc1');
      return o.length >= 2 ? { kind: 'CPI', date: last.CPI, period: o[0].date, actual: o[0].value, previous: o[1].value, unit: '%' } : null;
    })(),
    (async () => {
      if (!last.NFP) return null;
      const o = await getObservations('PAYEMS', 4);
      return o.length >= 3 ? { kind: 'NFP', date: last.NFP, period: o[0].date, actual: o[0].value - o[1].value, previous: o[1].value - o[2].value, unit: 'k' } : null;
    })(),
    (async () => {
      if (!last.FOMC) return null;
      const o = await getObservations('DFEDTARU', 120);
      const after = o.find((x) => x.date >= last.FOMC!);
      const before = o.find((x) => x.date < last.FOMC!);
      return after && before ? { kind: 'FOMC', date: last.FOMC, period: after.date, actual: after.value, previous: before.value, unit: '%' } : null;
    })(),
  ];
  const settled = await Promise.allSettled(jobs);
  return settled.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
}

export async function fetchMacroCalendar({ limit = 6 }: MacroCalendarArgs) {
  const now = Date.now();
  const today = isoDay(now);
  // Look back far enough to find the last release of each monthly series.
  const from = isoDay(now - 45 * DAY_MS);

  const sources: { kind: MacroEventKind; load: () => Promise<MacroEvent[]> }[] = [
    { kind: 'FOMC', load: async () => (await getFomcMeetings()).map((m) => ({ kind: 'FOMC' as const, date: m.date, sep: m.sep })) },
    { kind: 'CPI', load: async () => (await getReleaseDates(FRED_RELEASE.CPI, from)).map((date) => ({ kind: 'CPI' as const, date })) },
    { kind: 'NFP', load: async () => (await getReleaseDates(FRED_RELEASE.NFP, from)).map((date) => ({ kind: 'NFP' as const, date })) },
  ];
  const settled = await Promise.allSettled(sources.map((s) => s.load()));
  const events: MacroEvent[] = [];
  const missing: MacroEventKind[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') events.push(...r.value);
    else {
      missing.push(sources[i].kind);
      console.warn(`[macroCalendar] ${sources[i].kind}:`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });
  if (missing.length === sources.length) return null;

  events.sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = events.filter((e) => e.date >= today).slice(0, limit);
  const past = events.filter((e) => e.date < today);
  if (upcoming.length === 0) return null;

  const lastOf = (k: MacroEventKind) => [...past].reverse().find((e) => e.kind === k)?.date;
  const recent = await loadRecent({ CPI: lastOf('CPI'), NFP: lastOf('NFP'), FOMC: lastOf('FOMC') });

  const data: MacroCalendarData = { upcoming, today, missing, recent };
  const lastPast = past[past.length - 1];
  return { data, asOf: lastPast ? `${lastPast.date}T00:00:00Z` : null, synthetic: false };
}
