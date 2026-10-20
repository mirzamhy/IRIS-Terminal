'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type SeriesType,
  type UTCTimestamp,
} from 'lightweight-charts';
import { bollingerSeries, emaSeries, macdSeries, rsiSeries, smaSeries, type Maybe } from '@/lib/quant/ta';

/**
 * The chart studio: a card's chart opened full screen, TradingView-style.
 * Drag to pan, wheel or pinch to zoom, switch candles / line / area, a log
 * scale, and indicators (MA, EMA, Bollinger, volume, RSI, MACD). Indicators
 * live in this component's state only: closing the studio resets them.
 *
 * Two sources: BTC candles fetched from `/api/ohlcv` by timeframe, or any
 * series a card already has (`points`); a series opened as candles is grouped
 * into buckets (open = first, high/low = extremes, close = last of the bucket).
 */

export type StudioSource =
  | { kind: 'btc'; interval?: BtcInterval }
  | { kind: 'series'; points: { t: number; v: number }[]; unit?: '$' | '%' | ''; digits?: number };

type BtcInterval = '15m' | '1h' | '4h' | '1d' | '1w';
type Bar = { time: UTCTimestamp; open: number; high: number; low: number; close: number; volume?: number };
type Kind = 'candle' | 'line' | 'area';
type Ind = 'ma20' | 'ma50' | 'ema200' | 'bb' | 'vol' | 'rsi' | 'macd';

const BTC_TF: { k: BtcInterval; label: string; limit: number }[] = [
  { k: '15m', label: '15m', limit: 300 },
  { k: '1h', label: '1J', limit: 300 },
  { k: '4h', label: '4J', limit: 720 },
  { k: '1d', label: '1H', limit: 720 },
  { k: '1w', label: '1M', limit: 720 },
];
const IND: { k: Ind; label: string; color: string; btcOnly?: boolean }[] = [
  { k: 'ma20', label: 'MA 20', color: '#ffd2ae' },
  { k: 'ma50', label: 'MA 50', color: '#b8663a' },
  { k: 'ema200', label: 'EMA 200', color: '#c9b8aa' },
  { k: 'bb', label: 'Bollinger', color: '#8a5e40' },
  { k: 'vol', label: 'Volume', color: '#6b4a35', btcOnly: true },
  { k: 'rsi', label: 'RSI 14', color: '#ffb27a' },
  { k: 'macd', label: 'MACD', color: '#ffb27a' },
];

const C = { bg: '#130e0a', grid: '#1f1712', line: '#241a13', text: '#9a887a', accent: '#ff6b1f', down: '#6b4a35', downWick: '#8a5e40' };

const DAY = 86_400;

/** Group a point series into OHLC buckets of `sec` seconds. */
function bucket(points: { t: number; v: number }[], sec: number): Bar[] {
  const out: Bar[] = [];
  for (const p of points) {
    const t = Math.floor(p.t / 1000 / sec) * sec;
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, p.v);
      last.low = Math.min(last.low, p.v);
      last.close = p.v;
    } else {
      out.push({ time: t as UTCTimestamp, open: last ? last.close : p.v, high: p.v, low: p.v, close: p.v });
      if (last) {
        out[out.length - 1].high = Math.max(out[out.length - 1].high, last.close);
        out[out.length - 1].low = Math.min(out[out.length - 1].low, last.close);
      }
    }
  }
  return out;
}

/** One bar per point (for line / area), times strictly increasing. */
function raw(points: { t: number; v: number }[]): Bar[] {
  const out: Bar[] = [];
  for (const p of points) {
    const t = Math.floor(p.t / 1000) as UTCTimestamp;
    if (out.length && out[out.length - 1].time >= t) continue;
    out.push({ time: t, open: p.v, high: p.v, low: p.v, close: p.v });
  }
  return out;
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { k: T; label: string }[]; onChange: (k: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.k} type="button" role="tab" aria-selected={value === o.k} className="seg-btn" onClick={() => onChange(o.k)} style={{ border: 0, cursor: 'pointer', padding: '7px 13px', fontSize: 13 }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Studio({ title, source, onClose }: { title: string; source: StudioSource; onClose: () => void }) {
  const isBtc = source.kind === 'btc';
  const [kind, setKind] = useState<Kind>(isBtc ? 'candle' : 'line');
  const [tf, setTf] = useState<BtcInterval>(isBtc ? (source.interval ?? '1d') : '1d');
  const [log, setLog] = useState(false);
  const [inds, setInds] = useState<Set<Ind>>(new Set());
  const [btcBars, setBtcBars] = useState<Bar[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [legend, setLegend] = useState<Bar | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rangeRef = useRef<LogicalRange | null>(null);

  // Series sources: spacing decides which candle buckets make sense.
  const spacing = useMemo(() => {
    if (source.kind !== 'series' || source.points.length < 2) return DAY;
    const p = source.points;
    return Math.max(60, (p[p.length - 1].t - p[0].t) / 1000 / (p.length - 1));
  }, [source]);
  // Candle sizes worth offering: at least three source points per candle.
  const bucketOpts = useMemo(() => {
    const all = [
      { k: String(4 * 3600), label: '4 jam' },
      { k: String(DAY), label: '1 hari' },
      { k: String(7 * DAY), label: '1 minggu' },
      { k: String(30 * DAY), label: '1 bulan' },
      { k: String(91 * DAY), label: '3 bulan' },
    ];
    const ok = all.filter((o) => Number(o.k) >= spacing * 3);
    return (ok.length ? ok : all.slice(-1)).slice(0, 3);
  }, [spacing]);
  const [bucketSec, setBucketSec] = useState<string>(bucketOpts[0].k);

  useEffect(() => {
    if (!isBtc) return;
    let live = true;
    const spec = BTC_TF.find((x) => x.k === tf)!;
    fetch(`/api/ohlcv?interval=${tf}&limit=${spec.limit}`)
      .then((r) => r.json())
      .then((env: { isMock?: boolean; data: { ts: number; open: number; high: number; low: number; close: number; volume: number }[] }) => {
        if (!live) return;
        if (env.isMock || !env.data?.length) {
          setErr('Data candle sedang tidak tersedia.');
          setBtcBars([]);
          return;
        }
        setErr(null);
        const seen = new Set<number>();
        const bars = env.data
          .map((c) => ({ time: Math.floor((c.ts < 1e12 ? c.ts * 1000 : c.ts) / 1000) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }))
          .sort((a, b) => a.time - b.time)
          .filter((b) => (seen.has(b.time) ? false : (seen.add(b.time), true)));
        rangeRef.current = null;
        setBtcBars(bars);
      })
      .catch(() => live && setErr('Gagal memuat candle.'));
    return () => {
      live = false;
    };
  }, [isBtc, tf]);

  const bars: Bar[] = useMemo(() => {
    if (source.kind === 'btc') return btcBars ?? [];
    return kind === 'candle' ? bucket(source.points, Number(bucketSec)) : raw(source.points);
  }, [source, btcBars, kind, bucketSec]);

  const unit = source.kind === 'series' ? (source.unit ?? '') : '$';
  const digits = source.kind === 'series' ? (source.digits ?? 2) : 0;
  const fmt = (v: number) => (unit === '$' ? `$${v.toLocaleString('en-US', { maximumFractionDigits: digits })}` : `${v.toFixed(digits)}${unit}`);

  useEffect(() => {
    const el = box.current;
    if (!el || bars.length === 0) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text, fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 12, panes: { separatorColor: C.line, separatorHoverColor: '#3a2b20' } },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.line, mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
      timeScale: { borderColor: C.line, timeVisible: bars.length > 1 && bars[1].time - bars[0].time < DAY, rightOffset: 6 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#5a4130', labelBackgroundColor: '#261b13' }, horzLine: { color: '#5a4130', labelBackgroundColor: '#261b13' } },
    });
    chartRef.current = chart;
    const closes = bars.map((b) => b.close);
    const times = bars.map((b) => b.time);
    const priceFormat = { type: 'custom' as const, formatter: fmt, minMove: 10 ** -Math.max(digits, 0) };
    const toLine = (vals: Maybe[]) => vals.flatMap((v, i) => (v === null ? [] : [{ time: times[i], value: v }]));

    let main: ISeriesApi<SeriesType>;
    if (kind === 'candle') {
      main = chart.addSeries(CandlestickSeries, { priceFormat, upColor: C.accent, downColor: C.down, borderUpColor: C.accent, borderDownColor: C.downWick, wickUpColor: C.accent, wickDownColor: C.downWick });
      main.setData(bars);
    } else if (kind === 'area') {
      main = chart.addSeries(AreaSeries, { priceFormat, lineColor: C.accent, topColor: 'rgba(255,107,31,0.32)', bottomColor: 'rgba(255,107,31,0.02)', lineWidth: 2 });
      main.setData(bars.map((b) => ({ time: b.time, value: b.close })));
    } else {
      main = chart.addSeries(LineSeries, { priceFormat, color: C.accent, lineWidth: 2 });
      main.setData(bars.map((b) => ({ time: b.time, value: b.close })));
    }

    const overlay = (vals: Maybe[], color: string, width: 1 | 2 = 1) => {
      const s = chart.addSeries(LineSeries, { priceFormat, color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(toLine(vals));
    };
    if (inds.has('ma20')) overlay(smaSeries(closes, 20), '#ffd2ae');
    if (inds.has('ma50')) overlay(smaSeries(closes, 50), '#b8663a');
    if (inds.has('ema200')) overlay(emaSeries(closes, 200), '#c9b8aa');
    if (inds.has('bb')) {
      const b = bollingerSeries(closes, 20, 2);
      overlay(b.upper, '#8a5e40');
      overlay(b.mid, '#5a4130');
      overlay(b.lower, '#8a5e40');
    }
    if (inds.has('vol') && bars.some((b) => b.volume)) {
      const v = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      main.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
      v.setData(bars.map((b) => ({ time: b.time, value: b.volume ?? 0, color: b.close >= b.open ? 'rgba(255,107,31,0.45)' : 'rgba(107,74,53,0.7)' })));
    }
    let pane = 1;
    if (inds.has('rsi')) {
      const r = chart.addSeries(LineSeries, { color: '#ffb27a', lineWidth: 1, priceLineVisible: false }, pane);
      r.setData(toLine(rsiSeries(closes, 14)));
      r.createPriceLine({ price: 70, color: '#3a2b20', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      r.createPriceLine({ price: 30, color: '#3a2b20', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      pane += 1;
    }
    if (inds.has('macd')) {
      const m = macdSeries(closes);
      const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
      h.setData(m.hist.flatMap((v, i) => (v === null ? [] : [{ time: times[i], value: v, color: v >= 0 ? 'rgba(255,107,31,0.55)' : 'rgba(138,94,64,0.8)' }])));
      chart.addSeries(LineSeries, { color: '#ffd2ae', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane).setData(toLine(m.macd));
      chart.addSeries(LineSeries, { color: '#8a5e40', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane).setData(toLine(m.signal));
      pane += 1;
    }
    const panes = chart.panes();
    if (panes.length > 1) {
      panes[0].setStretchFactor(3);
      panes.slice(1).forEach((p) => p.setStretchFactor(1));
    }

    if (rangeRef.current) chart.timeScale().setVisibleLogicalRange(rangeRef.current);
    else if (bars.length > 200) chart.timeScale().setVisibleLogicalRange({ from: bars.length - 160, to: bars.length + 4 });
    else chart.timeScale().fitContent();

    const byTime = new Map(bars.map((b) => [b.time, b]));
    chart.subscribeCrosshairMove((p) => setLegend(p.time ? (byTime.get(p.time as UTCTimestamp) ?? null) : null));
    return () => {
      rangeRef.current = chart.timeScale().getVisibleLogicalRange();
      chart.remove();
      chartRef.current = null;
    };
    // `fmt` is derived from `source`, already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, kind, log, inds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const toggle = (k: Ind) =>
    setInds((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const shown = legend ?? bars[bars.length - 1] ?? null;
  const prev = shown ? bars[bars.findIndex((b) => b.time === shown.time) - 1] : undefined;
  const chg = shown && prev ? (shown.close / prev.close - 1) * 100 : null;
  const when = (t: number) => {
    const d = new Date(t * 1000);
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const intraday = bars.length > 1 && bars[1].time - bars[0].time < DAY;
    return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}${intraday ? ` ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : ''}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(8,5,3,0.78)', backdropFilter: 'blur(6px)', display: 'flex', padding: 'min(3vw, 28px)' }}
    >
      <div className="rise" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, background: C.bg, borderRadius: 28, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,.55), inset 0 0 0 1px #261b13' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="t-title" style={{ margin: 0, fontSize: 22 }}>
              {title}
            </h2>
            {shown ? (
              <span style={{ fontSize: 13, color: 'var(--dim)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>{when(shown.time)}</span>
                {kind === 'candle' ? (
                  <>
                    <span>
                      O <b style={{ color: 'var(--txt)' }}>{fmt(shown.open)}</b>
                    </span>
                    <span>
                      H <b style={{ color: 'var(--txt)' }}>{fmt(shown.high)}</b>
                    </span>
                    <span>
                      L <b style={{ color: 'var(--txt)' }}>{fmt(shown.low)}</b>
                    </span>
                  </>
                ) : null}
                <span>
                  {kind === 'candle' ? 'C ' : ''}
                  <b style={{ color: '#ffb27a' }}>{fmt(shown.close)}</b>
                </span>
                {chg !== null ? <span style={{ color: chg >= 0 ? '#ffb27a' : '#c9b8aa' }}>{`${chg >= 0 ? '+' : '−'}${Math.abs(chg).toFixed(2)}%`}</span> : null}
              </span>
            ) : null}
          </span>
          <button type="button" onClick={onClose} aria-label="Tutup" className="seg-btn" style={{ border: 0, cursor: 'pointer', background: '#1f1712', fontSize: 14 }}>
            Tutup ✕
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Seg
            value={kind}
            onChange={setKind}
            options={[
              { k: 'candle', label: 'Candle' },
              { k: 'line', label: 'Garis' },
              { k: 'area', label: 'Area' },
            ]}
          />
          {isBtc ? <Seg value={tf} onChange={setTf} options={BTC_TF} /> : kind === 'candle' ? <Seg value={bucketSec} onChange={setBucketSec} options={bucketOpts} /> : null}
          <button type="button" className="seg-btn" aria-pressed={log} onClick={() => setLog((x) => !x)} style={{ border: 0, cursor: 'pointer', fontSize: 13, background: log ? '#261b13' : '#140f0b' }}>
            Log
          </button>
          <span style={{ width: 1, height: 22, background: '#261b13' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {IND.filter((i) => !i.btcOnly || isBtc).map((i) => {
              const on = inds.has(i.k);
              return (
                <button
                  key={i.k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(i.k)}
                  className="seg-btn"
                  style={{ border: 0, cursor: 'pointer', fontSize: 13, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 7, background: on ? '#261b13' : '#140f0b' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? i.color : '#3a2b20' }} />
                  {i.label}
                </button>
              );
            })}
          </div>
          {inds.size ? (
            <button type="button" className="seg-btn" onClick={() => setInds(new Set())} style={{ border: 0, cursor: 'pointer', fontSize: 13, color: 'var(--dim)' }}>
              Reset
            </button>
          ) : null}
          <button
            type="button"
            className="seg-btn"
            onClick={() => {
              rangeRef.current = null;
              chartRef.current?.timeScale().fitContent();
            }}
            style={{ border: 0, cursor: 'pointer', fontSize: 13, marginLeft: 'auto' }}
          >
            Lihat semua
          </button>
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 320, borderRadius: 18, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px #1f1712' }}>
          <div ref={box} style={{ position: 'absolute', inset: 0 }} />
          {bars.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--dim)' }}>{err ?? 'Memuat…'}</div>
          ) : null}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Geser untuk menggulir, scroll / cubit untuk zoom. Indikator kembali kosong saat ditutup.</span>
      </div>
    </div>
  );
}

/** The "open full screen" control on a card; mounts the studio on demand. */
export function ExpandChart({ title, source, label = 'Perbesar' }: { title: string; source: StudioSource; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tip={'Buka chart penuh\ncandle, zoom, indikator'}
        style={{
          border: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 12px',
          borderRadius: 999,
          background: '#1c140e',
          color: '#ffb27a',
          fontSize: 12.5,
          fontWeight: 600,
          font: "600 12.5px 'Inter Tight', system-ui, sans-serif",
        }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        {label}
      </button>
      {open ? createPortal(<Studio title={title} source={source} onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}
