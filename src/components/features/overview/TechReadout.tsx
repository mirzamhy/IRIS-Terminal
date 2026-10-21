import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import { ExpandCard } from '@/components/charts/ChartStudio';
import type { Envelope } from '@/lib/envelope';
import type { WeeklyTechData } from '@/lib/features/weeklyTech';
import { CLOSE_BAND_PCT, SR_ON_PCT, STOCH_LABEL, type MaCheck, type StochState } from '@/lib/quant/weeklyTech';

/**
 * Weekly technical checklist: one line per rule, each a plain verdict.
 * Always weekly candles, whatever timeframe pill is active. Click the card to
 * open the weekly chart with every indicator below it switched on.
 */

type Tone = 'up' | 'down' | 'mid';

const TONE: Record<Tone, { fg: string; bg: string }> = {
  up: { fg: 'var(--accent-ink)', bg: 'var(--up)' },
  down: { fg: 'var(--txt)', bg: '#3a2b20' },
  mid: { fg: 'var(--txt)', bg: '#5a4130' },
};

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;

const stochTone = (s: StochState): Tone =>
  s === 'bull' || s === 'hidden_bull' || s === 'cross_bull' ? 'up' : s === 'neutral' ? 'mid' : 'down';

const maTone = (m: MaCheck): Tone => (m.state === 'YES' ? 'up' : m.state === 'NO' ? 'down' : 'mid');

function Chip({ text, tone }: { text: string; tone: Tone }) {
  return (
    <span
      style={{
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        color: TONE[tone].fg,
        background: TONE[tone].bg,
      }}
    >
      {text}
    </span>
  );
}

export function TechReadout({ tech }: { tech: Envelope<WeeklyTechData> }) {
  const t = tech.data;
  const st = t.stoch;
  const dv = st.divergence;

  const rows: { label: string; chip: string; tone: Tone; note: string }[] = [
    {
      label: 'Stochastic 5,3,3',
      chip: STOCH_LABEL[st.state],
      tone: stochTone(st.state),
      note: dv
        ? `${dv.kind.includes('bear') ? 'High' : 'Low'} ${usd(dv.p1)} → ${usd(dv.p2)} · %K ${dv.k1.toFixed(0)} → ${dv.k2.toFixed(0)}`
        : `%K ${st.k.toFixed(0)} · %D ${st.d.toFixed(0)}${st.k > 80 ? ' · overbought' : st.k < 20 ? ' · oversold' : ''}`,
    },
    ...(
      [
        ['Above EMA 13', t.ema13],
        ['Above EMA 21', t.ema21],
        ['Above MA 50', t.ma50],
        ['Above MA 200', t.ma200],
      ] as const
    ).map(([label, m]) => ({ label, chip: m.state, tone: maTone(m), note: `${usd(m.value)} · ${pct(m.distPct)}` })),
    {
      label: 'Golden cross (MA50 > MA200)',
      chip: t.goldenCross ? 'YES' : 'NO',
      tone: t.goldenCross ? 'up' : 'down',
      note: `MA50 ${usd(t.ma50.value)} · MA200 ${usd(t.ma200.value)}`,
    },
    {
      label: 'On support / resistance',
      chip: t.sr.on ? 'YES' : 'NO',
      tone: t.sr.on ? (t.sr.level?.kind === 'support' ? 'up' : 'down') : 'mid',
      note: t.sr.level
        ? `${t.sr.level.kind === 'support' ? 'Support' : 'Resistance'} ${usd(t.sr.level.price)} · ${t.sr.level.touches}× disentuh`
        : [t.sr.support ? `S ${usd(t.sr.support.price)}` : null, t.sr.resistance ? `R ${usd(t.sr.resistance.price)}` : null].filter(Boolean).join(' · ') ||
          'Belum ada level mayor',
    },
  ];

  return (
    <ExpandCard
      title="BTC weekly · teknikal"
      source={{ kind: 'btc', interval: '1w' }}
      preset={['ema13', 'ema21', 'ma50', 'ma200', 'stoch']}
    >
      <Panel style={{ height: '100%' }}>
        <PanelHeader title="Technical readout" note="weekly candles · klik untuk chart" right={<MockBadge env={tech} />} />
        <div style={{ position: 'relative', zIndex: 4, padding: '0 14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((r) => (
            <div
              key={r.label}
              className="ember-row"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 12px' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 14.5, color: '#e9ddd2' }}>{r.label}</span>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{r.note}</span>
              </span>
              <Chip text={r.chip} tone={r.tone} />
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', zIndex: 4, padding: '0 26px 6px', fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
          CLOSE = dalam ±{CLOSE_BAND_PCT}% dari garis. Level mayor = ≥3 sentuhan, tak ditembus 2 close beruntun; “on” = dalam {SR_ON_PCT}%.
        </div>
        <SourceFootnote env={tech} />
      </Panel>
    </ExpandCard>
  );
}
