import Link from 'next/link';
import { Panel } from '@/components/primitives';
import type { CheckItem, Group, Verdict } from '@/lib/strategy/checklist';
import type { StrategyState } from '@/lib/strategy/load';

const POS = '#ffb27a';
const LEAN_WORD: Record<Verdict, string> = { bull: 'Condong bullish', bear: 'Condong bearish', neutral: 'Campuran' };
const VERDICT_WORD: Record<Verdict, string> = { bull: 'Bull', bear: 'Bear', neutral: 'Netral' };
const GROUPS: Group[] = ['Model', 'Sentimen', 'Teknikal', 'Makro', 'On-chain', 'Quant'];

function Mark({ v }: { v: Verdict }) {
  const style = {
    bull: { bg: 'var(--accent)', fg: '#1a110b', d: 'M5 12.5l4.5 4.5L19 7.5', glow: '0 0 14px color-mix(in srgb, var(--accent) 55%, transparent)' },
    bear: { bg: '#3a2b20', fg: '#e8d5c4', d: 'M7 7l10 10M17 7L7 17', glow: undefined },
    neutral: { bg: 'var(--raise)', fg: '#9a887a', d: 'M6 12h12', glow: undefined },
  }[v];
  return (
    <span style={{ flex: '0 0 auto', width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: style.bg, boxShadow: style.glow }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={style.fg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={style.d} />
      </svg>
    </span>
  );
}

/** The score: N of M bullish set large, the bull / neutral / bear split, and each group as a small bar. */
export function StrategyScore({ s }: { s: StrategyState }) {
  const t = s.tally;
  const lit = t.lean === 'bull';
  return (
    <Panel style={{ height: '100%' }}>
      <div className="ember-halo" aria-hidden="true" style={{ top: -300, left: -220 }} />
      <div style={{ position: 'relative', zIndex: 4, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--mut)' }}>Sinyal bullish hari ini</h2>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span className={`t-display${lit ? ' t-accent' : ''}`} style={{ fontSize: 'clamp(64px, 8vw, 96px)', color: lit ? 'var(--accent)' : 'var(--txt)' }}>
                {t.bull}
              </span>
              <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--dim)' }}>/ {t.total}</span>
            </span>
            <span style={{ fontSize: 17, color: '#e9ddd2' }}>
              {LEAN_WORD[t.lean]} · {Math.round(t.bullShare)}% dari sinyal yang condong memilih naik
            </span>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            {(
              [
                ['Bull', t.bull, POS],
                ['Netral', t.neutral, 'var(--mut)'],
                ['Bear', t.bear, 'var(--txt)'],
              ] as const
            ).map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{k}</span>
                <span className="t-title" style={{ fontSize: 26, color: c }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', height: 16, gap: 3 }}>
          {t.bull ? (
            <div
              className="ember-grow"
              data-tip={`Bull\n${s.items.filter((i) => i.verdict === 'bull').map((i) => i.label).join('\n')}`}
              style={{ flex: t.bull, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 18px color-mix(in srgb, var(--accent) 45%, transparent)' }}
            />
          ) : null}
          {t.neutral ? (
            <div data-tip={`Netral\n${s.items.filter((i) => i.verdict === 'neutral').map((i) => i.label).join('\n')}`} style={{ flex: t.neutral, borderRadius: 999, background: '#3a2b20' }} />
          ) : null}
          {t.bear ? (
            <div data-tip={`Bear\n${s.items.filter((i) => i.verdict === 'bear').map((i) => i.label).join('\n')}`} style={{ flex: t.bear, borderRadius: 999, background: '#6b4a35' }} />
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {GROUPS.map((g) => {
            const xs = s.items.filter((i) => i.group === g);
            if (!xs.length) return null;
            const b = xs.filter((i) => i.verdict === 'bull').length;
            const r = xs.filter((i) => i.verdict === 'bear').length;
            const on = b > r;
            return (
              <div
                key={g}
                className="iris-inset"
                data-tip={`${g}\n${xs.map((i) => `${VERDICT_WORD[i.verdict]} · ${i.label}`).join('\n')}`}
                style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--sunk))' : undefined }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: on ? '#e9c4a6' : 'var(--dim)' }}>
                  <span>{g}</span>
                  <b style={{ color: on ? POS : 'var(--txt)' }}>
                    {b}/{xs.length}
                  </b>
                </span>
                <span style={{ display: 'flex', gap: 3, height: 6 }}>
                  {xs.map((i) => (
                    <span key={i.key} style={{ flex: 1, borderRadius: 999, background: i.verdict === 'bull' ? 'var(--accent)' : i.verdict === 'bear' ? '#6b4a35' : '#3a2b20' }} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Row({ i }: { i: CheckItem }) {
  return (
    <Link
      href={i.href}
      className="ember-row"
      data-tip={`${i.label}\nAturan: ${i.rule}`}
      style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1.2fr) minmax(0, 1.4fr) 76px', gap: 14, alignItems: 'center', padding: '11px 12px', textDecoration: 'none', color: 'var(--txt)' }}
    >
      <Mark v={i.verdict} />
      <span style={{ fontSize: 15 }}>{i.label}</span>
      <span style={{ fontSize: 14, color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.reading}</span>
      <span
        style={{
          justifySelf: 'end',
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 600,
          background: i.verdict === 'bull' ? 'var(--accent-soft)' : 'var(--sunk)',
          color: i.verdict === 'bull' ? POS : i.verdict === 'bear' ? '#e8d5c4' : 'var(--dim)',
        }}
      >
        {VERDICT_WORD[i.verdict]}
      </span>
    </Link>
  );
}

/** Every signal as one row under its group: the verdict mark, the reading, and the rule on hover; each row opens its tab. */
export function StrategyChecklist({ s }: { s: StrategyState }) {
  return (
    <Panel>
      <div style={{ position: 'relative', zIndex: 4, padding: '24px 26px 6px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 className="t-title" style={{ margin: 0, fontSize: 22 }}>
          Checklist
        </h2>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>Arahkan kursor untuk aturan tiap sinyal · klik untuk buka tabnya</span>
      </div>
      <div style={{ position: 'relative', zIndex: 4, padding: '6px 14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: '6px 28px' }}>
        {GROUPS.map((g) => {
          const xs = s.items.filter((i) => i.group === g);
          if (!xs.length) return null;
          return (
            <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ padding: '12px 12px 4px', fontSize: 14, fontWeight: 600, color: 'var(--mut)' }}>{g}</span>
              {xs.map((i) => (
                <Row key={i.key} i={i} />
              ))}
            </div>
          );
        })}
      </div>
      {s.missing.length ? (
        <p style={{ position: 'relative', zIndex: 4, margin: 0, padding: '0 26px 20px', fontSize: 13, color: 'var(--amber)' }}>Tidak dihitung karena sumbernya sedang tidak tersedia: {s.missing.join(', ')}.</p>
      ) : null}
      <p style={{ position: 'relative', zIndex: 4, margin: 0, padding: '0 26px 22px', fontSize: 13, color: 'var(--dim)' }}>
        Hitungan ini menimbang tiap sinyal sama rata dan memakai aturan baca sederhana, bukan model terlatih. Untuk riset, bukan saran keuangan.
      </p>
    </Panel>
  );
}
