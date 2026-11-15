# btc-race-24h-20261115-0828

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/xenopatijaya/btc-race-24h-20261115-0828/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/xenopatijaya/btc-race-24h-20261115-0828/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

Bounce Bot v2: a bot that trades cbBTC/USDC 1-minute bars (Orca Whirlpool, Solana) with $1,000 paper money, long only, for the make.fun "Race a BTC trading bot live for 24 hours" competition. It sits in cash through declines and buys only the first sign of a reversal after a deep drop.

## Strategy

1-minute returns on this pool are mean-reverting at short horizons, while sharp multi-hour drops are followed by V-shaped bounces. Trend-following whipsaws here (the kit's EMA-cross baseline lost money on the previous race's dev window), so this bot does the opposite of chasing:

- **Entry:** 120-minute return ≤ -1.6% **and** 10-minute return ≥ +0.10%, at least 30 bars after the last exit, full cash.
- **Exit (whole position):** +0.8% over the entry close, or -3.0% under it (safety stop), or 600 bars after entry.
- **Fallback:** if no buy has filled by bar 1200, take one trend entry instead (60-minute return ≥ +0.2%, exit +0.8% / -1.0% / 180 bars) so a quiet window still trades. It never fires on the dev window.

## Dev-window result (official `grade-local`, `--driver process`)

| | |
|---|---|
| Net PnL | **+$16.85** |
| Max drawdown | 1.4% |
| Trades | 10 (5 round trips, 5/5 won) |
| Fees | $4.04 |
| Net PnL at 2x fees | +$12.83 (still profitable) |
| Baselines (same window) | buy-and-hold -$43.12, hold-cash $0.00 |

Cross-window check: the same parameters score +$9.29 (2/2 round trips won) on the previous race's dev window, while the previous race's parameters lose -$16.38 on this window — so the thresholds were re-derived here, not carried over.

## Run it

```sh
node /bot/main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=fmkt9ms6&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>
