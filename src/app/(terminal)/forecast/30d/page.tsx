import { LiveOnly } from '@/components/primitives';
import { getMonthlyForecast } from '@/lib/features/monthlyForecast';
import { MonthlyFan } from '@/components/features/monthly/MonthlyFan';
import { MonthlyRange } from '@/components/features/monthly/MonthlyRange';
import { MonthlyAccuracy } from '@/components/features/monthly/MonthlyAccuracy';

/**
 * Timothy's 30-day Monte Carlo (motmots/iris-monthly-forecast). Nothing is
 * computed on request: the worker writes one run a week; the 30 s revalidate
 * (the layout's value) only picks a new run up promptly. Forward validation
 * lives on the weekly tab only (2026-10-21).
 */
export const revalidate = 30;

export default async function MonthlyForecastPage() {
  const fc = await getMonthlyForecast({});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <LiveOnly env={fc} title="PRAKIRAAN 30 HARI">
        <div className="rise" style={{ ['--i' as string]: 2 }}>
          <MonthlyFan fc={fc} />
        </div>
        <section className="ember-split" aria-label="Range and accuracy">
          <div className="main rise" style={{ ['--i' as string]: 3 }}>
            <MonthlyRange fc={fc} />
          </div>
          <div className="side rise" style={{ ['--i' as string]: 4 }}>
            <MonthlyAccuracy fc={fc} />
          </div>
        </section>
      </LiveOnly>
    </div>
  );
}
