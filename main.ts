// Bounce Bot v2 for btc-race-24h-20261115-0828: "Race a BTC trading bot live
// for 24 hours" (cbBTC/USDC 1-minute bars, Orca Whirlpool, $1,000 paper money,
// long only).
//
// What this window's data says (dev window 2026-11-14 08:28 -> 2026-11-15
// 08:28 UTC, 1,440 bars, BTC -4.0% over the day, max drawdown 7.9%):
// the market grinds down in waves and then snaps back. A 120-minute slide is
// usually followed within minutes by a short V-bounce, and the bounce's first
// leg is the reliable part: take-profit at +0.8% catches it, while +0.9% and
// above already miss it and ride the fade back down (grid-searched on this
// window: TP 0.8% -> +$16.86, TP 0.9% -> -$25.43). Trend-following whipsaws
// here — the kit's EMA-cross baseline lost money on the previous race's
// window — so this bot never chases: it sits in cash through declines and
// buys only the first sign of a reversal after a deep drop.
//
//   Entry (flat only): the 120-minute return is at or below -1.6% AND the
//     10-minute return is at or above +0.10% (the bounce has started), at
//     least 30 bars after the last exit, full cash.
//   Exit (whole position): +0.8% above the entry close, or -3.0% below it
//     (a wide safety stop; it never triggers on the dev window), or 600
//     bars after entry, whichever comes first.
//
//   Fallback, so a quiet window still trades (the race requires at least one
//     filled trade): if no buy has filled by bar 1200, take one trend entry
//     instead — 60-minute return at or above +0.2%, exit at +0.8% / -1.0% /
//     180 bars. It never fires on the dev window (the bounce trades happen
//     first), so it changes nothing there; it only keeps a race window with
//     no deep slide from ending with zero trades.
//
// Cross-window check (same parameters on the previous race's dev window):
// +$9.29, 2/2 round trips won. The previous race's parameters (10-minute
// reversal +0.15%, take-profit +1.05%) lose -$16.38 on THIS window, so the
// thresholds were re-derived here, not carried over.
//
// Deterministic: pure float64 arithmetic on the closes the harness sends, no
// clock, no randomness, no network, no files. One order per reply at most,
// max slippage 100 bps (1%) past the close the order was decided on.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
const DROP_WINDOW = 120; // bars of the slide that sets the bounce up
const DROP_LIMIT = -0.016; // 120-minute return at or below -1.6%
const REVERSAL_WINDOW = 10; // bars of the reversal that confirms the bounce
const REVERSAL_MIN = 0.001; // 10-minute return at or above +0.10%
const TAKE_PROFIT = 0.008; // exit at +0.8% over the entry close
const STOP_LOSS = 0.03; // safety exit at -3.0% under the entry close
const MAX_HOLD_BARS = 600; // exit after 600 bars whatever the price
const COOLDOWN_BARS = 30; // bars after an exit before the next entry
const MAX_SLIPPAGE_BPS = 100;
const FALLBACK_BAR = 1200; // no filled buy by here: take one trend entry
const FALLBACK_WINDOW = 60; // bars of the trend that arms the fallback
const FALLBACK_MIN = 0.002; // 60-minute return at or above +0.2%
const FALLBACK_TAKE_PROFIT = 0.008; // fallback exit at +0.8%
const FALLBACK_STOP_LOSS = 0.01; // fallback exit at -1.0%
const FALLBACK_HOLD_BARS = 180; // fallback exit after 180 bars

const closes: number[] = [];
let entryClose: number | null = null;
let entrySeq = -1;
let entryTakeProfit = TAKE_PROFIT;
let entryStopLoss = STOP_LOSS;
let entryHoldBars = MAX_HOLD_BARS;
let lastExitSeq = -1_000_000;
let everBought = false;

// Return of the close `win` bars ago against the latest close, or null while
// the window is still filling.
function windowReturn(win: number): number | null {
  const n = closes.length;
  if (n <= win) return null;
  const now = closes[n - 1];
  const then = closes[n - 1 - win];
  if (then === 0) return null;
  return now / then - 1;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    let sawBar = false;
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      closes.push(Number(bar.c));
      sawBar = true;
    }
    for (const fill of batch.fills) {
      if (fill.symbol === SYMBOL && fill.side === "buy" && fill.status === "filled") everBought = true;
    }
    if (!sawBar || state.warmingUp) return [];
    const closeRaw = state.close(SYMBOL);
    if (closeRaw === null) return [];
    const close = Number(closeRaw);
    const held = state.positions.get(SYMBOL);
    const seq = state.seq;

    if (held !== undefined) {
      // Holding: exit on take-profit, stop-loss, or the hold limit. The
      // exit levels are the ones set when this position was opened, so a
      // fallback entry exits on its own tighter levels.
      const hitTarget = close >= entryClose! * (1 + entryTakeProfit);
      const hitStop = close <= entryClose! * (1 - entryStopLoss);
      const tooOld = seq - entrySeq >= entryHoldBars;
      if (hitTarget || hitStop || tooOld) {
        lastExitSeq = seq;
        entryClose = null;
        const sell: SellInput = { side: "sell", symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: enter only after a deep slide plus a fresh reversal, past the
    // cooldown after the previous exit.
    if (seq - lastExitSeq < COOLDOWN_BARS) return [];
    const slide = windowReturn(DROP_WINDOW);
    if (slide !== null && slide <= DROP_LIMIT) {
      const reversal = windowReturn(REVERSAL_WINDOW);
      if (reversal !== null && reversal >= REVERSAL_MIN) {
        const cash = state.cash;
        if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
        entryClose = close;
        entrySeq = seq;
        entryTakeProfit = TAKE_PROFIT;
        entryStopLoss = STOP_LOSS;
        entryHoldBars = MAX_HOLD_BARS;
        const buy: BuyInput = { side: "buy", symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [buy];
      }
    }

    // Fallback: no filled buy yet and the window is nearly over — take one
    // trend entry so the run still trades, with a tighter exit.
    if (!everBought && seq >= FALLBACK_BAR) {
      const trend = windowReturn(FALLBACK_WINDOW);
      if (trend !== null && trend >= FALLBACK_MIN) {
        const cash = state.cash;
        if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
        entryClose = close;
        entrySeq = seq;
        entryTakeProfit = FALLBACK_TAKE_PROFIT;
        entryStopLoss = FALLBACK_STOP_LOSS;
        entryHoldBars = FALLBACK_HOLD_BARS;
        const buy: BuyInput = { side: "buy", symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [buy];
      }
    }
    return [];
  },
});
