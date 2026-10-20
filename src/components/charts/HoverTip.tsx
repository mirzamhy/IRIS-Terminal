'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One tooltip for the whole terminal. Any element with a `data-tip` attribute
 * shows it under the cursor at once (a native `title` waits a second and looks
 * like the OS). Lines are split on `\n`; the first is set in bold, like the
 * crosshair tooltip in `ChartHover`.
 *
 * Mounted once in the terminal layout, so server-rendered bars and tiles get a
 * hover without each becoming a client component.
 */
export function HoverTip() {
  const [tip, setTip] = useState<{ lines: string[]; x: number; y: number } | null>(null);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]') ?? null;
      if (!el) {
        if (current.current) {
          current.current.removeAttribute('data-tip-on');
          current.current = null;
          setTip(null);
        }
        return;
      }
      if (current.current !== el) {
        current.current?.removeAttribute('data-tip-on');
        el.setAttribute('data-tip-on', '');
        current.current = el;
      }
      const text = el.getAttribute('data-tip') ?? '';
      setTip({ lines: text.split('\n'), x: e.clientX, y: e.clientY });
    };
    const clear = () => {
      current.current?.removeAttribute('data-tip-on');
      current.current = null;
      setTip(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', clear, { passive: true, capture: true });
    window.addEventListener('pointerleave', clear);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', clear, { capture: true });
      window.removeEventListener('pointerleave', clear);
    };
  }, []);

  if (!tip) return null;
  const right = typeof window !== 'undefined' && tip.x > window.innerWidth - 260;
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y,
        transform: `translate(${right ? 'calc(-100% - 14px)' : '14px'}, calc(-100% - 10px))`,
        background: '#f6eee7',
        borderRadius: 10,
        padding: '7px 11px',
        fontSize: 12.5,
        lineHeight: 1.5,
        color: '#1a110b',
        maxWidth: 340,
        width: 'max-content',
        pointerEvents: 'none',
        zIndex: 1000,
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
      }}
    >
      {tip.lines.map((l, i) => (
        <div key={i} style={i === 0 ? { fontWeight: 700 } : { color: '#5a4130' }}>
          {l}
        </div>
      ))}
    </div>
  );
}
