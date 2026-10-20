export type MacroEventKind = 'FOMC' | 'CPI' | 'NFP';

export interface MacroEvent {
  kind: MacroEventKind;
  /** UTC date of the release / rate decision. */
  date: string;
  /** FOMC meeting with a Summary of Economic Projections. */
  sep?: boolean;
}

/** The outcome of the latest past event of one kind, read from FRED. */
export interface MacroRelease {
  kind: MacroEventKind;
  /** Release / decision day (UTC). */
  date: string;
  /** Period the figure describes, e.g. `2026-09-01` for September's CPI. */
  period: string;
  actual: number;
  previous: number;
  /** `%` = a rate (CPI year on year, Fed upper target); `k` = thousands of jobs added. */
  unit: '%' | 'k';
}

export interface MacroCalendarData {
  /** Latest outcome per kind; missing when FRED could not be read. */
  recent?: MacroRelease[];
  /** Next scheduled events, soonest first. */
  upcoming: MacroEvent[];
  /** Server "today" (UTC), for the countdowns. */
  today: string;
  /** Sources that failed this render (their events are missing, not invented). */
  missing: MacroEventKind[];
}

export type MacroCalendarArgs = { limit?: number };
