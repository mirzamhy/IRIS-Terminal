'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CandlestickSeries, ColorType, CrosshairMode, createChart, type UTCTimestamp } from 'lightweight-charts';

/**
 * The weekly call as a card that flips. Front: the call. Back: BTC weekly
 * candles with the forecast week drawn as a ghost candle — open at the close
 * the forecast is anchored on, body to the middle of the half of the range the
 * call points to, wicks to the range's low and high.
 */

export interface FlipForecast {
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  min: number;
  max: number;
  anchor: number;
  /** YYYY-MM-DD, the last closed daily candle behind the signal. */
  dataAsOf: string;
}

const WEEK = 7 * 86_400;
const MONDAY0 = 4 * 86_400;
const weekStart = (ts: number) => Math.floor((ts - MONDAY0) / WEEK) * WEEK + MONDAY0;

export function ghostCandle(f: FlipForecast) {
  const target = f.label === 'BULLISH' ? (f.anchor + f.max) / 2 : f.label === 'BEARISH' ? (f.anchor + f.min) / 2 : f.anchor;
  // The forecast week is the Monday-open week right after the data date.
  const asOf = Date.parse(`${f.dataAsOf}T00:00:00Z`) / 1000;
  const time = weekStart(asOf + 86_400) as UTCTimestamp;
  return { time, open: f.anchor, close: target, high: Math.max(f.max, f.anchor, target), low: Math.min(f.min, f.anchor, target) };
}

function BackChart({ f }: { f: FlipForecast }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let chart: ReturnType<typeof createChart> | null = null;
    let live = true;
    fetch('/api/ohlcv?interval=1w&limit=40')
      .then((r) => r.json())
      .then((env: { isMock?: boolean; data: { ts: number; open: number; high: number; low: number; close: number }[] }) => {
        if (!live) return;
        if (env.isMock || !env.data?.length) return setErr('Candle weekly belum tersedia.');
        chart = createChart(el, {
          autoSize: true,
          layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9a887a', fontSize: 11 },
          grid: { vertLines: { color: '#1f1712' }, horzLines: { color: '#1f1712' } },
          rightPriceScale: { borderColor: '#241a13' },
          timeScale: { borderColor: '#241a13', rightOffset: 3 },
          crosshair: { mode: CrosshairMode.Normal },
          localization: { priceFormatter: (p: number) => `$${Math.round(p).toLocaleString('en-US')}` },
          handleScroll: false,
          handleScale: false,
        });
        const ghost = ghostCandle(f);
        const bars = env.data
          .map((c) => ({ time: Math.floor(c.ts / 1000) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
          .filter((b) => b.time < ghost.time);
        const s = chart.addSeries(CandlestickSeries, {
          upColor: '#ff6b1f',
          downColor: '#6b4a35',
          borderUpColor: '#ff6b1f',
          borderDownColor: '#8a5e40',
          wickUpColor: '#ff6b1f',
          wickDownColor: '#8a5e40',
          priceLineVisible: false,
        });
        s.setData(bars);
        const up = ghost.close >= ghost.open;
        const g = chart.addSeries(CandlestickSeries, {
          upColor: 'rgba(61,220,132,0.28)',
          downColor: 'rgba(255,90,90,0.28)',
          borderUpColor: '#3ddc84',
          borderDownColor: '#ff5a5a',
          wickUpColor: up ? '#3ddc84' : '#ff5a5a',
          wickDownColor: up ? '#3ddc84' : '#ff5a5a',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        g.setData([ghost]);
        const line = (price: number, title: string, color: string) =>
          g.createPriceLine({ price, title, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
        line(f.max, 'Atas', '#8a5e40');
        line(ghost.close, 'Target', up ? '#3ddc84' : '#ff5a5a');
        line(f.min, 'Bawah', '#8a5e40');
        chart.timeScale().fitContent();
      })
      .catch(() => live && setErr('Gagal memuat candle.'));
    return () => {
      live = false;
      chart?.remove();
    };
  }, [f]);
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 260 }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {err ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--dim)', fontSize: 14 }}>{err}</div> : null}
    </div>
  );
}

export function ForecastFlip({ front, forecast }: { front: ReactNode; forecast: FlipForecast | null }) {
  const [flipped, setFlipped] = useState(false);
  if (!forecast) return <>{front}</>;
  const face = { backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const };
  return (
    <div style={{ perspective: 1600, height: '100%' }}>
      <div
        style={{
          position: 'relative',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.7s var(--ease)',
          transform: flipped ? 'rotateY(180deg)' : 'none',
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Balik kartu: lihat candle weekly"
          onClick={() => setFlipped(true)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped(true))}
          style={{ ...face, cursor: 'pointer', height: '100%' }}
        >
          {front}
        </div>
        <div
          className="iris-card iris-panel still"
          style={{
            ...face,
            position: 'absolute',
            inset: 0,
            transform: 'rotateY(180deg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 24,
            borderRadius: 'var(--r-lg)',
            background: 'var(--panel)',
            boxShadow: 'inset 0 0 0 1px var(--stroke)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, color: 'var(--mut)' }}>
              BTC weekly · candle bayangan = minggu yang diprediksi ({forecast.label === 'BULLISH' ? 'bull' : forecast.label === 'BEARISH' ? 'bear' : 'netral'})
            </span>
            <button type="button" onClick={() => setFlipped(false)} className="seg-btn" style={{ border: 0, cursor: 'pointer', fontSize: 13 }}>
              ↺ Balik
            </button>
          </div>
          {flipped ? <BackChart f={forecast} /> : <div style={{ flex: 1 }} />}
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
            Buka di close {forecast.anchor.toLocaleString('en-US', { maximumFractionDigits: 0 })} (data {forecast.dataAsOf}); badan sampai tengah separuh kisaran
            searah sinyal; sumbu sampai batas bawah / atas.
          </span>
        </div>
      </div>
    </div>
  );
}
