import { loadStrategy } from '@/lib/strategy/load';
import { QUESTIONS } from '@/lib/strategy/assistant';
import { StrategyChecklist, StrategyScore } from '@/components/features/strategy/StrategyCards';
import { Assistant } from '@/components/features/strategy/Assistant';

export const revalidate = 60;

/** Strategy: every signal scored on one checklist, and an assistant that explains it. */
export default async function StrategyPage() {
  const s = await loadStrategy();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      <section className="ember-split" aria-label="Score and assistant">
        <div className="main rise" style={{ ['--i' as string]: 2 }}>
          <StrategyScore s={s} />
        </div>
        <div className="side rise" style={{ ['--i' as string]: 3 }}>
          <Assistant questions={QUESTIONS} />
        </div>
      </section>
      <div className="rise" style={{ ['--i' as string]: 4 }}>
        <StrategyChecklist s={s} />
      </div>
    </div>
  );
}
