import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { HalvingCycleData } from '@/lib/features/halvingCycle';
import type { Interval } from '@/lib/quant/cycle';
import { toDay } from '@/lib/quant/daily';
import { fmtDay } from '@/lib/dates';

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
const mult = (m: number) => (m >= 10 ? `×${m.toFixed(0)}` : `×${m.toFixed(1)}`);

/** The weekly close nearest a date: the halving-day price the rise is measured from. */
function priceNear(history: HalvingCycleData['history'], iso: string): number | null {
  const day = toDay(iso);
  let best: { d: number; p: number } | null = null;
  for (const h of history) {
    const d = Math.abs(toDay(h.date) - day);
    if (!best || d < best.d) best = { d, p: h.price };
  }
  return best && best.d <= 10 ? best.p : null;
}

/**
 * Each cycle as one row: the halving, days to the peak and the rise to it, days
 * from the peak to the floor and the drawdown. The running cycle is lit and its
 * open numbers read "sejauh ini". Below: the average and 80% range of each phase.
 */
export function CycleDurations({ cycle }: { cycle: Envelope<HalvingCycleData> }) {
  const d = cycle.data;
  const a = d.analysis;
  const cols = 'minmax(64px, 0.7fr) minmax(110px, 1.1fr) repeat(4, minmax(90px, 1fr))';
  const rows = [...a.cycles].reverse().map((c) => {
    const current = c.index === a.current?.index;
    const top = c.top ?? (current ? c.athPending : null);
    const base = priceNear(d.history, c.halving);
    const toTop = top ? toDay(top.date) - toDay(c.halving) : null;
    const bottom = c.bottom && top && toDay(c.bottom.date) > toDay(top.date) ? c.bottom : null;
    const lowSince = current && top && !bottom ? d.priceNow : null;
    const floor = bottom?.price ?? lowSince;
    return {
      key: c.index,
      label: c.halving.slice(0, 4),
      halving: fmtDay(c.halving),
      current,
      toTop,
      provisional: !c.top || c.top.kind !== 'final',
      rise: top && base ? top.price / base : null,
      fall: bottom && top ? toDay(bottom.date) - toDay(top.date) : current && top ? toDay(d.lastDate) - toDay(top.date) : null,
      dd: floor && top ? floor / top.price - 1 : null,
      openFloor: !c.bottomConfirmed,
    };
  });
  const phases: { k: string; iv: Interval | null }[] = [
    { k: 'Halving → puncak', iv: a.intervals.halvingToTop },
    { k: 'Puncak → dasar', iv: a.intervals.topToBottom },
    { k: 'Puncak → puncak', iv: a.intervals.topToTop },
  ];

  return (
    <Panel>
      <PanelHeader title="Berapa lama tiap fase" note="hari sejak halving · harga penutupan" right={<MockBadge env={cycle} />} />
      <div style={{ position: 'relative', zIndex: 4, padding: '0 14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 720, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '0 12px 8px', fontSize: 13, color: 'var(--dim)' }}>
              <span>Siklus</span>
              <span>Halving</span>
              <span style={{ textAlign: 'right' }}>Hari ke puncak</span>
              <span style={{ textAlign: 'right' }}>Naik</span>
              <span style={{ textAlign: 'right' }}>Puncak ke dasar</span>
              <span style={{ textAlign: 'right' }}>Turun</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.key}
                className="ember-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: cols,
                  gap: 14,
                  alignItems: 'center',
                  padding: '13px 12px',
                  fontSize: 15,
                  background: r.current ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : undefined,
                }}
              >
                <span style={{ fontWeight: 600, color: r.current ? '#ffb27a' : 'var(--txt)' }}>{r.label}</span>
                <span style={{ color: '#e9ddd2' }}>{r.halving}</span>
                <span style={{ textAlign: 'right' }} data-tip={r.provisional && r.toTop !== null ? 'Puncak belum final\nbisa bergeser kalau harga naik lagi' : undefined}>
                  {r.toTop === null ? '—' : n0(r.toTop)}
                  {r.provisional && r.toTop !== null ? <span style={{ color: 'var(--dim)' }}>*</span> : null}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{r.rise === null ? '—' : mult(r.rise)}</span>
                <span style={{ textAlign: 'right' }}>
                  {r.fall === null ? '—' : n0(r.fall)}
                  {r.fall !== null && r.openFloor ? <span style={{ fontSize: 13, color: 'var(--dim)' }}> sejauh ini</span> : null}
                </span>
                <span style={{ textAlign: 'right', color: '#e9ddd2' }}>
                  {r.dd === null ? '—' : `−${Math.abs(r.dd * 100).toFixed(0)}%`}
                  {r.dd !== null && r.openFloor ? <span style={{ fontSize: 13, color: 'var(--dim)' }}> sejauh ini</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, padding: '0 12px' }}>
          {phases.map((p) => (
            <div
              key={p.k}
              className="iris-inset"
              style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}
              data-tip={p.iv ? `${p.k}\nRata-rata ${n0(p.iv.mean)} hari\n8 dari 10 kemungkinan: ${n0(p.iv.p80[0])}–${n0(p.iv.p80[1])} hari\nDari ${p.iv.n} siklus` : undefined}
            >
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>{p.k}</span>
              <span className="t-title" style={{ fontSize: 22 }}>
                {p.iv ? `${n0(p.iv.mean)} hari` : '—'}
              </span>
              {p.iv ? (
                <span style={{ fontSize: 13, color: 'var(--mut)' }}>
                  rentang 80% {n0(p.iv.p80[0])}–{n0(p.iv.p80[1])}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <SourceFootnote env={cycle} />
    </Panel>
  );
}
