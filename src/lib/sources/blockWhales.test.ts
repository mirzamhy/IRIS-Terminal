import { describe, expect, it } from 'vitest';
import { blockTxToWhale } from './blockWhales';
import { EXCHANGE_ADDRESSES } from '@/lib/onchain/exchangeRegistry';

const ex = EXCHANGE_ADDRESSES[0].address;

describe('block whale scan', () => {
  it('keeps transfers ≥ the floor and drops the change output', () => {
    const w = blockTxToWhale({ hash: 'ab', inputs: [{ prev_out: { addr: 'A', value: 300e8 } }], out: [{ addr: 'B', value: 150e8 }, { addr: 'A', value: 149e8 }] }, 100, 80_000)!;
    expect(w.amount).toBe(150);
    expect(w.amountUsd).toBe(150 * 80_000);
    expect(w.kind).toBe('WALLET_TRANSFER');
    expect(w.id).toBe('btc-ab');
  });

  it('drops small transfers and coinbase', () => {
    expect(blockTxToWhale({ hash: 'x', inputs: [{ prev_out: { addr: 'A' } }], out: [{ addr: 'B', value: 5e8 }] }, 1, 1)).toBeNull();
    expect(blockTxToWhale({ hash: 'c', inputs: [{}], out: [{ addr: 'B', value: 500e8 }] }, 1, 1)).toBeNull();
  });

  it('labels a deposit into a tracked exchange as an inflow', () => {
    const w = blockTxToWhale({ hash: 'd', inputs: [{ prev_out: { addr: 'A' } }], out: [{ addr: ex, value: 200e8 }] }, 1, 1)!;
    expect(w.kind).toBe('EXCHANGE_INFLOW');
    expect(w.bias).toBe('bearish');
    expect(w.toLabel).toBe(EXCHANGE_ADDRESSES[0].label);
  });
});
