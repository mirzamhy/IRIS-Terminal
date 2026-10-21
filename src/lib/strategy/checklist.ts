/**
 * The strategy checklist: every signal the terminal already computes, each
 * reduced to one verdict (bull / bear / neutral) by a written rule, so the
 * tally "N of M bullish" can be traced back line by line. The rules are
 * reading conventions, not fitted thresholds; each item carries the rule text
 * so the page (and the assistant) can say why it landed where it did.
 *
 * Pure functions over the features' data: no fetching here (see `load.ts`).
 */
import type { WeeklyForecastData } from '@/lib/features/weeklyForecast/types';
import type { MonthlyForecastData } from '@/lib/features/monthlyForecast/types';
import type { SentimentData } from '@/lib/features/sentiment/types';
import type { SocialSentimentData } from '@/lib/features/socialSentiment/types';
import type { FearGreedData } from '@/lib/features/fearGreed/types';
import type { WeeklyTechData } from '@/lib/features/weeklyTech/types';
import type { ValuationData } from '@/lib/features/valuation/types';
import { STOCH_LABEL } from '@/lib/quant/weeklyTech';
import type { MacroMetric } from '@/lib/features/macroCountry/types';
import type { MacroMarketsData } from '@/lib/features/macroMarkets/types';
import type { EtfFlowsData } from '@/lib/features/etfFlows/types';
import type { ChainFlowsData } from '@/lib/features/chainFlows/types';
import type { PositioningData } from '@/lib/features/positioning/types';
import type { PowerLawData } from '@/lib/features/powerLawCorridor/types';
import type { HalvingCycleData } from '@/lib/features/halvingCycle/types';
import type { SeasonalityCell } from '@/lib/features/seasonality/types';
import { monthlySummary } from '@/lib/features/seasonality/stats';

export type Verdict = 'bull' | 'bear' | 'neutral';
export type Group = 'Model' | 'Sentimen' | 'Teknikal' | 'Makro' | 'On-chain' | 'Quant';

export interface CheckItem {
  key: string;
  group: Group;
  label: string;
  /** The reading in a few words, e.g. "Bullish · 61%". */
  reading: string;
  verdict: Verdict;
  /** The rule that turned the reading into the verdict. */
  rule: string;
  /** Where the evidence lives in the terminal. */
  href: string;
}

export interface Tally {
  bull: number;
  bear: number;
  neutral: number;
  total: number;
  /** bull ÷ (bull + bear), 0–100; 50 when nothing leans. */
  bullShare: number;
  lean: Verdict;
}

const pct = (v: number, d = 1) => {
  const r = Number(v.toFixed(d));
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}%`;
};
const by = (v: number, up: number, down: number): Verdict => (v >= up ? 'bull' : v <= down ? 'bear' : 'neutral');

export function weeklyItem(d: WeeklyForecastData): CheckItem {
  const verdict: Verdict = d.label === 'BULLISH' ? 'bull' : d.label === 'BEARISH' ? 'bear' : 'neutral';
  return {
    key: 'weekly',
    group: 'Model',
    label: 'Prakiraan mingguan',
    reading: `${d.label === 'BULLISH' ? 'Bullish' : d.label === 'BEARISH' ? 'Bearish' : 'Netral'}${d.classifier?.track ? ` · winrate ${(d.classifier.track.precision * 100).toFixed(0)}%` : ''} · kisaran $${(d.range.min / 1000).toFixed(1)}k–$${(d.range.max / 1000).toFixed(1)}k`,
    verdict,
    rule: 'Mengikuti label model mingguan.',
    href: '/forecast/weekly',
  };
}

export function monthlyItem(d: MonthlyForecastData): CheckItem | null {
  const end = d.bands[d.bands.length - 1];
  if (!end || !d.spot) return null;
  const chg = (end.p50 / d.spot - 1) * 100;
  return {
    key: 'monthly',
    group: 'Model',
    label: 'Prakiraan 30 hari',
    reading: `Median ${pct(chg)}`,
    verdict: by(chg, 2, -2),
    rule: 'Median simulasi 30 hari ≥ +2% bull, ≤ −2% bear.',
    href: '/forecast/30d',
  };
}

export function newsItem(d: SentimentData): CheckItem {
  const net = d.positivePct - d.negativePct;
  return {
    key: 'news',
    group: 'Sentimen',
    label: 'Sentimen berita',
    reading: `Positif ${d.positivePct.toFixed(0)}% · negatif ${d.negativePct.toFixed(0)}%`,
    verdict: by(net, 10, -10),
    rule: 'Positif − negatif ≥ 10 poin bull, ≤ −10 bear.',
    href: '/sentiment',
  };
}

export function socialItem(d: SocialSentimentData): CheckItem {
  const tilt = (d.latest.positive - d.latest.negative) * 100;
  return {
    key: 'social',
    group: 'Sentimen',
    label: 'Sentimen sosial',
    reading: `Tilt ${tilt >= 0 ? '+' : '−'}${Math.abs(tilt).toFixed(1)}`,
    verdict: by(tilt, 2, -2),
    rule: 'Tilt (positif − negatif) ≥ +2 bull, ≤ −2 bear.',
    href: '/sentiment',
  };
}

export function fearGreedItem(d: FearGreedData): CheckItem {
  return {
    key: 'feargreed',
    group: 'Sentimen',
    label: 'Fear & Greed',
    reading: `${d.value} · ${d.classification}`,
    verdict: by(d.value, 55, 45),
    rule: 'Indeks ≥ 55 (pasar berani) bull, ≤ 45 (takut) bear.',
    href: '/overview',
  };
}

const usdK = (v: number) => `$${(v / 1000).toFixed(1)}k`;

/** Weekly technicals (the Overview card): one item per rule group. */
export function weeklyTechItems(t: WeeklyTechData): CheckItem[] {
  const st = t.stoch.state;
  const stochVerdict: Verdict = st === 'bull' || st === 'hidden_bull' || st === 'cross_bull' ? 'bull' : st === 'neutral' ? 'neutral' : 'bear';
  const mas = [t.ema13, t.ema21, t.ma50, t.ma200];
  const above = mas.filter((m) => m.state === 'YES').length;
  const below = mas.filter((m) => m.state === 'NO').length;
  const close = 4 - above - below;
  const sr = t.sr.level;
  const levels = [t.sr.support ? `S ${usdK(t.sr.support.price)}` : null, t.sr.resistance ? `R ${usdK(t.sr.resistance.price)}` : null].filter(Boolean).join(' · ');
  return [
    {
      key: 'stoch_w',
      group: 'Teknikal',
      label: 'Stochastic 5,3,3 weekly',
      reading: `${STOCH_LABEL[st]} · %K ${t.stoch.k.toFixed(0)}`,
      verdict: stochVerdict,
      rule: 'Divergence / hidden divergence bullish atau crossing bull = bull; versi bearish = bear; tanpa sinyal baru = netral.',
      href: '/overview',
    },
    {
      key: 'ma_w',
      group: 'Teknikal',
      label: 'Di atas EMA13/21 & MA50/200 weekly',
      reading: `${above} dari 4 di atas${close ? ` · ${close} dekat (CLOSE)` : ''}`,
      verdict: above >= 3 ? 'bull' : below >= 3 ? 'bear' : 'neutral',
      rule: 'Close di atas ≥3 garis bull, di bawah ≥3 garis bear, sisanya netral.',
      href: '/overview',
    },
    {
      key: 'golden_w',
      group: 'Teknikal',
      label: 'Golden cross weekly',
      reading: `MA50 ${usdK(t.ma50.value)} ${t.goldenCross ? '>' : '<'} MA200 ${usdK(t.ma200.value)}`,
      verdict: t.goldenCross ? 'bull' : 'bear',
      rule: 'MA50 di atas MA200 bull (golden cross), di bawah bear (death cross).',
      href: '/overview',
    },
    {
      key: 'sr_w',
      group: 'Teknikal',
      label: 'Support / resistance mayor',
      reading: sr ? `Di ${sr.kind} ${usdK(sr.price)} (${sr.touches}× disentuh)` : `Tidak di level mayor${levels ? ` · ${levels}` : ''}`,
      verdict: !sr ? 'neutral' : sr.kind === 'support' ? 'bull' : 'bear',
      rule: 'Dalam 3% dari support mayor bull (pantulan), dari resistance mayor bear (penolakan), selain itu netral.',
      href: '/overview',
    },
  ];
}

export function mvrvItem(d: ValuationData): CheckItem {
  const v = d.mvrv.now;
  return {
    key: 'mvrv',
    group: 'On-chain',
    label: 'MVRV',
    reading: `${v.toFixed(2)} · harga realisasi ${usdK(d.mvrv.realizedPrice)}`,
    verdict: v < 1.2 ? 'bull' : v > 3 ? 'bear' : 'neutral',
    rule: 'MVRV < 1.2 (dekat harga realisasi, historis murah) bull, > 3 (zona puncak) bear, di antaranya netral.',
    href: '/chain',
  };
}

export function soprItem(d: ValuationData): CheckItem | null {
  const s = d.sopr;
  if (!s) return null;
  return {
    key: 'sopr',
    group: 'On-chain',
    label: 'SOPR (1 minggu)',
    reading: `${s.avg7.toFixed(3)} · data ${s.date}`,
    verdict: by(s.avg7, 1.01, 0.99),
    rule: 'SOPR ≥ 1.01 (koin dijual untung) bull, ≤ 0.99 (dijual rugi) bear. Live dari Bitview (tertunda 7 hari bila jatuh ke cadangan).',
    href: '/chain',
  };
}

/** US CPI inflation direction (same series as the macro release card). */
export function inflationItem(m: MacroMetric): CheckItem | null {
  const cpi = m.indicators?.find((x) => x.key === 'cpi');
  if (!cpi || cpi.previous === null) return null;
  const d = cpi.latest - cpi.previous;
  return {
    key: 'cpi',
    group: 'Makro',
    label: 'Inflasi CPI AS',
    reading: `${cpi.latest.toFixed(2)}% (sebelumnya ${cpi.previous.toFixed(2)}%)`,
    verdict: by(-d, 0.1, -0.1),
    rule: 'Inflasi turun ≥ 0.1 poin bull (ruang The Fed melonggar), naik ≥ 0.1 poin bear.',
    href: '/macro/data',
  };
}

/** NFP: a cooling labour market is read as easing ahead. */
export function nfpItem(m: MacroMetric): CheckItem | null {
  const n = m.indicators?.find((x) => x.key === 'nfp');
  if (!n) return null;
  return {
    key: 'nfp',
    group: 'Makro',
    label: 'NFP AS',
    reading: `${n.latest >= 0 ? '+' : '−'}${Math.abs(n.latest).toFixed(0)}k kerja baru`,
    verdict: n.latest < 50 ? 'bull' : n.latest > 250 ? 'bear' : 'neutral',
    rule: 'NFP < 50k (pasar kerja mendingin, peluang suku bunga turun) bull, > 250k (panas) bear, di antaranya netral.',
    href: '/macro/data',
  };
}

export function regimeItem(m: MacroMetric): CheckItem {
  const g = m.zScores.growth;
  const i = m.zScores.inflation;
  const name = g >= 0 ? (i < 0 ? 'Goldilocks' : 'Reflation') : i >= 0 ? 'Stagflation' : 'Deflation';
  const near = Math.abs(g) < 1 && Math.abs(i) < 1;
  return {
    key: 'regime',
    group: 'Makro',
    label: 'Fase ekonomi AS',
    reading: near ? `Normal, condong ${name}` : name,
    verdict: near ? 'neutral' : name === 'Goldilocks' ? 'bull' : name === 'Stagflation' ? 'bear' : 'neutral',
    rule: 'Goldilocks bull, Stagflation bear, lainnya atau dekat normal netral.',
    href: '/macro/regime',
  };
}

export function dollarItem(d: MacroMarketsData): CheckItem | null {
  const dxy = d.series.find((s) => s.key === 'dxy');
  if (!dxy) return null;
  return {
    key: 'dollar',
    group: 'Makro',
    label: 'Dolar AS (30 hari)',
    reading: `DXY ${pct(dxy.change30dPct)}`,
    verdict: by(-dxy.change30dPct, 1, -1),
    rule: 'Dolar turun ≥ 1% bull (aset berisiko lega), naik ≥ 1% bear.',
    href: '/macro/markets',
  };
}

export function stocksItem(d: MacroMarketsData): CheckItem | null {
  const spx = d.series.find((s) => s.key === 'spx');
  if (!spx) return null;
  return {
    key: 'stocks',
    group: 'Makro',
    label: 'Saham AS (30 hari)',
    reading: `S&P 500 ${pct(spx.change30dPct)}`,
    verdict: by(spx.change30dPct, 2, -2),
    rule: 'S&P 500 ≥ +2% bull (selera risiko), ≤ −2% bear.',
    href: '/macro/markets',
  };
}

export function etfItem(d: EtfFlowsData): CheckItem {
  const b = Math.abs(d.windowNetUsdM) >= 1000 ? `$${(Math.abs(d.windowNetUsdM) / 1000).toFixed(2)}B` : `$${Math.abs(d.windowNetUsdM).toFixed(0)}M`;
  return {
    key: 'etf',
    group: 'On-chain',
    label: 'Arus ETF spot',
    reading: `${d.windowNetUsdM >= 0 ? '+' : '−'}${b} dalam ${d.sessions.length} sesi`,
    verdict: d.windowNetUsdM > 0 ? 'bull' : d.windowNetUsdM < 0 ? 'bear' : 'neutral',
    rule: 'Arus bersih jendela positif bull, negatif bear.',
    href: '/chain/etf',
  };
}

export function exchangeItem(d: ChainFlowsData): CheckItem {
  const v = d.netflowBtc;
  return {
    key: 'exchange',
    group: 'On-chain',
    label: 'Arus bursa',
    reading: `${v <= 0 ? 'Keluar' : 'Masuk'} ${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })} BTC · 7 hari`,
    verdict: v < 0 ? 'bull' : v > 0 ? 'bear' : 'neutral',
    rule: 'BTC keluar bursa (disimpan) bull, masuk bursa (siap dijual) bear.',
    href: '/chain/wallets',
  };
}

export function positioningItem(d: PositioningData): CheckItem {
  return {
    key: 'positioning',
    group: 'On-chain',
    label: 'Posisi futures',
    reading: `L/S ${d.retailRatio.toFixed(2)} (${d.retailRatio >= 1 ? 'lebih banyak long' : 'lebih banyak short'}) · top trader ${d.topTraderRatio.toFixed(2)}`,
    verdict: d.bias === 'bullish' ? 'bull' : d.bias === 'bearish' ? 'bear' : 'neutral',
    rule: `Mengikuti bacaan posisi (akun besar vs keramaian retail): ${d.biasReason}`,
    href: '/chain/long-short',
  };
}

export function powerLawItem(d: PowerLawData): CheckItem {
  const z = d.today.zone;
  return {
    key: 'powerlaw',
    group: 'Quant',
    label: 'Koridor power-law',
    reading: `Persentil ${Math.round(d.today.pct)} · ${z}`,
    verdict: z === 'Sangat murah' || z === 'Murah' ? 'bull' : z === 'Mahal' || z === 'Sangat mahal' ? 'bear' : 'neutral',
    rule: 'Zona murah bull (ruang naik), mahal bear, wajar netral.',
    href: '/quant/corridor',
  };
}

export function cycleItem(d: HalvingCycleData): CheckItem | null {
  const c = d.analysis.current;
  if (!c) return null;
  const days = Math.round((Date.parse(`${d.lastDate}T00:00:00Z`) - Date.parse(`${c.halving}T00:00:00Z`)) / 86_400_000);
  const verdict: Verdict = c.bottomConfirmed ? 'bull' : c.top ? 'bear' : 'bull';
  const phase = c.bottomConfirmed ? 'setelah dasar' : c.top ? `setelah puncak${c.top.kind === 'final' ? ' (final)' : ''}` : 'menuju puncak';
  return {
    key: 'cycle',
    group: 'Quant',
    label: 'Siklus halving',
    reading: `Hari ke-${days.toLocaleString('en-US')} · ${phase}`,
    verdict,
    rule: 'Menuju puncak atau setelah dasar terkonfirmasi bull, setelah puncak (belum ada dasar) bear.',
    href: '/quant/cycle',
  };
}

const MONTH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function seasonalityItem(cells: SeasonalityCell[]): CheckItem | null {
  const running = cells.find((c) => c.partial);
  if (!running) return null;
  const s = monthlySummary(cells)[running.month - 1];
  if (s.pctUp === null) return null;
  return {
    key: 'season',
    group: 'Quant',
    label: `Musiman ${MONTH[running.month - 1]}`,
    reading: `Naik ${s.up} dari ${s.n} tahun`,
    verdict: by(s.pctUp, 60, 40),
    rule: 'Bulan ini naik di ≥ 60% tahun bull, ≤ 40% bear.',
    href: '/quant/seasonality',
  };
}

export function tally(items: CheckItem[]): Tally {
  const bull = items.filter((i) => i.verdict === 'bull').length;
  const bear = items.filter((i) => i.verdict === 'bear').length;
  const neutral = items.length - bull - bear;
  const bullShare = bull + bear ? (bull / (bull + bear)) * 100 : 50;
  return { bull, bear, neutral, total: items.length, bullShare, lean: bullShare >= 60 ? 'bull' : bullShare <= 40 ? 'bear' : 'neutral' };
}
