/**
 * Free whale feed for Bitcoin: scan the newest blocks ourselves (2026-10-21).
 *
 * Whale Alert's free tier became a 7-day trial, so the wire would die without
 * a paid key. Every confirmed BTC transfer is public, so the same job can be
 * done keyless: list the latest blocks (mempool.space), pull each one whole
 * (blockchain.info `rawblock`, ~2,500 transactions, ~6 MB) and keep the
 * transfers that move at least `MIN_BTC`.
 *
 * Amount = outputs that do not go back to an input address (the usual change
 * heuristic). Labels come from the tracked exchange registry; everything else
 * is "Unknown wallet" — a signal, never a measurement, like `classifyFlow`.
 *
 * Docs: https://mempool.space/docs/api/rest · https://www.blockchain.com/explorer/api/blockchain_api
 */
import { lookupAddress, type ExchangeAddress } from '@/lib/onchain/exchangeRegistry';
import { BIAS_BY_FLOW_KIND, type FlowKind } from '@/lib/onchain/classifyFlow';
import { fetchJson } from './http';
import type { WhaleTx } from './whaleAlert';

/** Smallest transfer kept, in BTC (about $8M at $80k). */
export const MIN_BTC = 100;
/** Only blocks this recent are scanned; the 5-minute cron overlaps by design. */
const LOOKBACK_SEC = 40 * 60;
const MAX_BLOCKS = 4;

interface RawOut {
  addr?: string;
  value?: number;
}
interface RawIn {
  prev_out?: RawOut;
}
export interface RawBlockTx {
  hash: string;
  inputs: RawIn[];
  out: RawOut[];
}
interface RawBlock {
  time: number;
  tx: RawBlockTx[];
}

const sat = (v: number | undefined) => (v ?? 0) / 1e8;

function side(addrs: string[]): ExchangeAddress | undefined {
  for (const a of addrs) {
    const hit = lookupAddress(a);
    if (hit) return hit;
  }
  return undefined;
}

/** One block transaction -> whale transfer, or null when small / coinbase. Exported for tests. */
export function blockTxToWhale(tx: RawBlockTx, time: number, priceUsd: number, minBtc = MIN_BTC): WhaleTx | null {
  const ins = tx.inputs.map((i) => i.prev_out?.addr).filter((a): a is string => !!a);
  if (ins.length === 0) return null; // coinbase
  const inSet = new Set(ins);
  const sent = tx.out.filter((o) => !(o.addr && inSet.has(o.addr)));
  const amount = sent.reduce((s, o) => s + sat(o.value), 0);
  if (amount < minBtc) return null;

  const from = side(ins);
  // The largest destination names the receiver.
  const main = [...sent].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const to = side(main.map((o) => o.addr).filter((a): a is string => !!a));

  let kind: FlowKind = 'WALLET_TRANSFER';
  if (from && to) {
    if (from.exchange === to.exchange) kind = from.kind === 'cold' && to.kind !== 'cold' ? 'HOT_LOADING' : to.kind === 'cold' ? 'COLD_STORING' : 'INTER_EXCHANGE';
    else kind = 'INTER_EXCHANGE';
  } else if (to) kind = 'EXCHANGE_INFLOW';
  else if (from) kind = 'EXCHANGE_OUTFLOW';

  return {
    id: `btc-${tx.hash}`,
    ts: time,
    blockchain: 'bitcoin',
    symbol: 'BTC',
    amount,
    amountUsd: amount * priceUsd,
    fromLabel: from?.label ?? 'Unknown wallet',
    toLabel: to?.label ?? 'Unknown wallet',
    kind,
    bias: BIAS_BY_FLOW_KIND[kind],
    txUrl: `https://mempool.space/tx/${tx.hash}`,
  };
}

async function rawBlock(hash: string): Promise<RawBlock> {
  // Too large for Next's data cache (2 MB); always a fresh read.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30_000);
  try {
    const res = await fetch(`https://blockchain.info/rawblock/${hash}`, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok) throw new Error(`blockchain.info rawblock ${res.status}`);
    return (await res.json()) as RawBlock;
  } finally {
    clearTimeout(timer);
  }
}

/** Large BTC transfers in the blocks of the last ~40 minutes, newest first. */
export async function getBlockWhales(priceUsd: number, now = Date.now()): Promise<WhaleTx[]> {
  const blocks = await fetchJson<{ id: string; timestamp: number }[]>('https://mempool.space/api/blocks', { revalidate: 60 });
  if (!Array.isArray(blocks)) throw new Error('mempool.space: blocks is not an array');
  const recent = blocks.filter((b) => b.timestamp >= now / 1000 - LOOKBACK_SEC).slice(0, MAX_BLOCKS);
  const out: WhaleTx[] = [];
  for (const b of recent) {
    const raw = await rawBlock(b.id);
    for (const tx of raw.tx) {
      const w = blockTxToWhale(tx, raw.time, priceUsd);
      if (w) out.push(w);
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}
