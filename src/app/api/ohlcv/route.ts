/**
 * BTC candles for the chart studio (the expandable chart). Returns the
 * envelope as-is so the client can tell a placeholder from live data.
 */
import { NextResponse } from 'next/server';
import { getOhlcv } from '@/lib/features/ohlcv';

const INTERVALS = new Set(['15m', '1h', '4h', '6h', '1d', '1w']);

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const interval = INTERVALS.has(q.get('interval') ?? '') ? (q.get('interval') as string) : '1d';
  const raw = Number(q.get('limit'));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 720) : 300;
  const env = await getOhlcv({ symbol: 'BTC-USD', interval, limit });
  return NextResponse.json(env, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
}
