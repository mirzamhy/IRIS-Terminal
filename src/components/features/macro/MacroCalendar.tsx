import { Panel, PanelHeader, MockBadge, SourceFootnote } from '@/components/primitives';
import type { Envelope } from '@/lib/envelope';
import type { MacroCalendarData, MacroEventKind, MacroRelease } from '@/lib/features/macroCalendar';

const WHAT: Record<MacroEventKind, { name: string; plain: string }> = {
  FOMC: { name: 'Keputusan suku bunga Fed', plain: 'FOMC' },
  CPI: { name: 'Inflasi AS', plain: 'CPI' },
  NFP: { name: 'Data tenaga kerja AS', plain: 'NFP' },
};
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const fmtVal = (r: MacroRelease, v: number) => (r.unit === 'k' ? `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v))}rb` : `${v.toFixed(2)}%`);
const PERIOD_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** One released figure: the day, what it was, the print, and which way it moved against the print before. */
function ReleaseRow({ r }: { r: MacroRelease }) {
  const diff = r.actual - r.previous;
  const flat = Math.abs(diff) < (r.unit === 'k' ? 0.5 : 0.005);
  const dir = flat ? 'tetap' : diff > 0 ? 'naik' : 'turun';
  const dt = new Date(`${r.date}T00:00:00Z`);
  const period = r.kind === 'FOMC' ? 'batas atas suku bunga' : `data ${PERIOD_MONTHS[Number(r.period.slice(5, 7)) - 1]}`;
  return (
    <div
      className="ember-row"
      data-tip={`${WHAT[r.kind].name} · ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}\nAktual ${fmtVal(r, r.actual)}\nSebelumnya ${fmtVal(r, r.previous)}\n${flat ? 'Tidak berubah' : `${dir === 'naik' ? 'Naik' : 'Turun'} ${r.unit === 'k' ? `${Math.round(Math.abs(diff))}rb` : `${Math.abs(diff).toFixed(2)} poin`}`}`}
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, margin: '0 -12px' }}
    >
      <span style={{ flex: '0 0 auto', width: 56, height: 56, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--sunk)', boxShadow: 'inset 0 0 0 1px #2a2019' }}>
        <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 700, color: 'var(--mut)' }}>{dt.getUTCDate()}</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{MONTHS[dt.getUTCMonth()]}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 15 }}>{WHAT[r.kind].name}</span>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
          {WHAT[r.kind].plain} · {period} · sebelumnya {fmtVal(r, r.previous)}
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{fmtVal(r, r.actual)}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            background: dir === 'naik' ? 'var(--accent-soft)' : 'var(--sunk)',
            color: dir === 'naik' ? '#ffb27a' : dir === 'turun' ? '#c9b8aa' : 'var(--dim)',
          }}
        >
          {dir === 'naik' ? '▲' : dir === 'turun' ? '▼' : '='} {dir}
        </span>
      </span>
    </div>
  );
}

/** The latest US macro outcomes (actual vs previous) above the next scheduled events, from FRED and the Fed's calendar. */
export function MacroCalendar({ cal, limit = 4 }: { cal: Envelope<MacroCalendarData>; limit?: number }) {
  const d = cal.data;
  const recent = [...(d.recent ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Panel style={{ height: '100%' }}>
      <PanelHeader title={recent.length ? 'Rilis makro AS' : 'Segera rilis'} note="FRED · federalreserve.gov" right={<MockBadge env={cal} />} />
      {recent.length ? (
        <div style={{ position: 'relative', zIndex: 4, padding: '0 26px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mut)', paddingBottom: 2 }}>Baru rilis</span>
          {recent.map((r) => (
            <ReleaseRow key={r.kind} r={r} />
          ))}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mut)', padding: '10px 0 2px' }}>Segera rilis</span>
        </div>
      ) : null}
      <div style={{ position: 'relative', zIndex: 4, padding: '0 26px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.upcoming.slice(0, recent.length ? Math.min(limit, 3) : limit).map((e) => {
          const n = daysUntil(d.today, e.date);
          const soon = n <= 7;
          const dt = new Date(`${e.date}T00:00:00Z`);
          return (
            <div key={`${e.kind}-${e.date}`} className="ember-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, margin: '0 -12px' }}>
              <span
                style={{
                  flex: '0 0 auto',
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: soon ? 'color-mix(in srgb, var(--accent) 20%, var(--sunk))' : 'var(--sunk)',
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 700, color: soon ? '#ffd2ae' : 'var(--txt)' }}>{dt.getUTCDate()}</span>
                <span style={{ fontSize: 12, color: soon ? '#e9c4a6' : 'var(--dim)' }}>{MONTHS[dt.getUTCMonth()]}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 15 }}>{WHAT[e.kind].name}</span>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                  {DOW[dt.getUTCDay()]} · {WHAT[e.kind].plain}
                  {e.sep ? ' · + proyeksi ekonomi' : ''}
                </span>
              </span>
              <span
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: soon ? 'var(--accent-soft)' : 'var(--sunk)',
                  color: soon ? '#ffb27a' : 'var(--mut)',
                }}
              >
                {n === 0 ? 'Hari ini' : `${n} hari`}
              </span>
            </div>
          );
        })}
        {d.missing.length ? <span style={{ fontSize: 12.5, color: 'var(--amber)', paddingTop: 6 }}>Tidak tersedia: {d.missing.join(', ')} (sumbernya gagal dibaca)</span> : null}
      </div>
      <SourceFootnote env={cal} />
    </Panel>
  );
}
