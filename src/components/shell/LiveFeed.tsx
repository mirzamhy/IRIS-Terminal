'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const ago = (sec: number) => (sec < 60 ? `${sec} dtk lalu` : `${Math.floor(sec / 60)} mnt lalu`);

/**
 * A "this feed is live" pill: a pulsing dot, and how long ago the page last
 * re-read the source. `renderedAt` is stamped by the server on each render, so
 * the counter resets every time AutoRefresh brings new rows.
 */
export function LivePill({ renderedAt, every = 30 }: { renderedAt: number | null; every?: number }) {
  const [clock, setClock] = useState<{ now: number; mounted: number } | null>(null);
  useEffect(() => {
    const tick = () => setClock((c) => ({ now: Date.now(), mounted: c?.mounted ?? Date.now() }));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const now = clock?.now ?? null;
  const from = renderedAt ?? clock?.mounted ?? 0;
  const sec = now === null ? 0 : Math.max(0, Math.round((now - from) / 1000));
  return (
    <span
      data-tip={`Diperbarui otomatis tiap ${every} detik\nselama tab ini terbuka`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        background: '#1c140e',
        fontSize: 12.5,
        fontWeight: 600,
        color: '#ffb27a',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="iris-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
      Live
      <span style={{ fontWeight: 400, color: 'var(--dim)' }}>· {now === null ? 'baru saja' : ago(sec)}</span>
    </span>
  );
}

/**
 * Wraps a list whose rows carry `data-row={id}`. When a refresh brings ids
 * that were not there before, those rows get a warm flash (`.ember-flash`).
 * The first render flashes nothing.
 */
export function FreshRows({ ids, children, style }: { ids: string[]; children: ReactNode; style?: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    const prev = seen.current;
    seen.current = new Set(ids);
    if (!prev || !box.current) return;
    const fresh = ids.filter((id) => !prev.has(id));
    const els = fresh
      .map((id) => box.current!.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`))
      .filter((el): el is HTMLElement => el !== null);
    els.forEach((el) => {
      el.classList.remove('ember-flash');
      void el.offsetWidth;
      el.classList.add('ember-flash');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div ref={box} style={style}>
      {children}
    </div>
  );
}
