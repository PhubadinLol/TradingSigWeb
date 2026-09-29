# SignalDesk — Trading Signal Dashboard

An educational trading-analysis dashboard. It analyses OHLCV market data with technical indicators and price action, and produces **explainable BUY / SELL / NEUTRAL signals** from a weighted scoring model. It also includes multi-timeframe analysis, walk-forward backtesting, performance analytics and a position-size calculator.

> **Disclaimer.** Trading involves risk. Signals are generated from technical analysis and are provided for educational and informational purposes only. They are not financial advice and do not guarantee profits.

## Quick start

Requires **Node.js 18.18+** (Node 20 or newer recommended).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. With no configuration, the app runs on **synthetic demo data** and shows a *"Demo Data — Connect a market data provider for live prices."* banner.

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript strict-mode check |

## Connecting live market data (where the API key goes)

The data provider is chosen **on the server**, so API keys never reach the browser.

1. Copy `.env.example` to `.env.local`. `.env.local` is git-ignored.
2. Choose a provider:

   ```ini
   # Crypto only, no key needed (Binance public REST API)
   MARKET_DATA_PROVIDER=binance
   # BINANCE_BASE_URL=https://api.binance.us   # if api.binance.com is unavailable in your region
   ```

   or

   ```ini
   # Forex, metals and crypto (requires a key from https://twelvedata.com)
   MARKET_DATA_PROVIDER=twelvedata
   TWELVE_DATA_API_KEY=your_key_here
   ```

3. Restart `npm run dev`. The top bar then shows **Live · \<provider\>**, and the demo banner disappears.

Notes:

- **Symbol support:** Binance supports only the crypto symbols; forex and metals show as "not supported" in that mode. Twelve Data maps `BTC/USDT` → `BTC/USD` (the source ticker appears in API responses as `meta.sourceSymbol`).
- **Missing key:** if `twelvedata` is selected without a key, the server falls back to demo data and shows a warning. It never labels demo data as live.
- **Rate limits:** candles are cached in memory for 15–60 s. On the free Twelve Data tier, the multi-timeframe and history views can still hit the per-minute rate limit.

### Adding another provider

Implement `MarketDataProvider` (`src/lib/data/provider.ts`) and register it in `createProvider()` in `src/lib/data/index.ts`. The rest of the app does not need to change.

## How signals are generated

All of the engine code lives in `src/lib`. The algorithm is documented in detail at the top of `src/lib/signals/index.ts`.

No single indicator produces a signal. Each side (buy / sell) collects points from independent evidence:

| Factor | BUY (+) | SELL (+) | Default weight |
| --- | --- | --- | --- |
| EMA alignment | EMA 20 > 50 > 200 | EMA 20 < 50 < 200 | 20 |
| Long-term trend | close > EMA 200 | close < EMA 200 | 15 |
| RSI 14 | > 50 | < 50 | 10 |
| MACD (12,26,9) | line > signal | line < signal | 15 |
| Breakout | close holds above 20-bar high | close holds below 20-bar low | 20 |
| Volume | > 1.5× average on a bullish bar | > 1.5× average on a bearish bar | 10 |
| S/R reaction | support bounce | resistance rejection | 10 |

`signalScore = buyScore − sellScore` (from −100 to +100). It is classified with configurable thresholds:

| Score | Signal |
| --- | --- |
| ≥ +60 | STRONG BUY |
| +30 … +59 | BUY |
| −29 … +29 | NEUTRAL |
| −59 … −30 | SELL |
| ≤ −60 | STRONG SELL |

- **Signal strength** = |score|. It measures how much of the weighted evidence agrees. It is **not** a probability of profit.
- **Closed candles only:** signals are computed on closed candles, so they don't repaint while a bar is still forming.
- **Trade levels:**
  - The entry zone is the close ± 0.25 ATR.
  - The stop sits just beyond the nearest support/resistance level when that level is 0.5–3 ATR away; otherwise it is 1.5 ATR from the close.
  - TP1 and TP2 are 1.5R and 3R.
- **Explanations:** every signal carries a plain-English explanation and the list of factors that fired for and against it.
- **Other indicators:** Stochastic RSI, ATR, Bollinger Bands, market structure (HH/HL/LH/LL) and volume spikes are also computed and shown in the indicator summary.

**Configuring thresholds and settings:**

- **Per user:** the Settings page (stored in the browser). Changes are sent as validated query parameters.
- **Server-wide:** thresholds via `SIGNAL_THRESHOLDS=60,30,-30,-60` in `.env.local`.
- **In code:** all other defaults, including the scoring weights and timeframe weights, are in `src/lib/config.ts`.

## Backtesting

`src/lib/backtest` replays the same engine bar by bar:

- Indicators are causal, and swing pivots are only used once confirmed, so there is no look-ahead.
- Entries fill at the **next bar's open**.
- If the stop and the target are both touched in the same bar, the **stop is assumed first**.
- Trades close as *Expired* after N bars. A trade still open at the end of the data is *Active*.
- Only one trade per market is open at a time.
- **No fees or slippage are modelled.**

The Signal History table and the Performance page are built from these replays and are clearly labelled as historical/simulated. Live performance tracking would need persistent storage and is shown as "not tracked".

## REST API

All inputs are validated with zod. Errors return `{ "error": "..." }` with a 4xx/5xx status.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/market/:symbol?timeframe=1h&limit=300` | Raw OHLCV candles |
| GET | `/api/analysis/:symbol?timeframe=1h&limit=400` | Candles, indicator series, S/R levels, signal markers |
| GET | `/api/signal/:symbol?timeframe=1h` | Latest explainable signal with trade levels |
| GET | `/api/mtf/:symbol` | Signal per timeframe and a weighted overall bias |
| GET | `/api/markets?timeframe=1h&all=1` | Price, 24h change and signal for each market |
| GET | `/api/signals/history?symbol=&timeframe=&signal=&from=YYYY-MM-DD&to=YYYY-MM-DD` | Historical signal replay |
| POST | `/api/backtest` | Body: `{ symbols: string[], timeframe, bars?, target?: "tp1"\|"tp2", minStrength?, maxBarsInTrade?, overrides? }` |
| GET | `/api/symbols?q=eth` | Symbol search |
| GET | `/api/status` | Active provider and server engine defaults |

Timeframes are `1m 5m 15m 30m 1h 4h 1d`. Symbols are ids such as `BTCUSDT`, `EURUSD` and `XAUUSD`; `btc-usdt` and `BTC/USDT` (URL-encoded) are accepted too. The GET routes that run the engine also accept overrides as query parameters: `emaFast`, `emaMid`, `emaSlow`, `rsiPeriod`, `atrPeriod`, `bbPeriod`, `bbStdDev`, `volumeConfirmMultiplier`, `strongBuy`, `buy`, `sell`, `strongSell`, `atrStopMultiplier`, `tp1R` and `tp2R`.

## Project structure

```
src/
  app/                  Next.js App Router pages + API routes (app/api/*)
  components/           UI (layout, dashboard widgets, charts, tables)
  hooks/                Client data-fetching hooks
  lib/
    indicators/         EMA, SMA, RSI, MACD, Stochastic RSI, ATR, Bollinger
    analysis/           Indicator bundle, pivots, support/resistance, price action, trend
    signals/            Weighted scoring engine, classification, explanations, trade levels
    risk/               Position sizing
    backtest/           Walk-forward backtester + metrics
    data/               MarketDataProvider interface, mock / Binance / Twelve Data providers, cache
    config.ts           All engine defaults
    validation.ts       API input validation
    service.ts          Glue used by API routes
```

## Alerts

Browser notifications are optional and off by default. You can enable them and add up to 5 rules (symbol, timeframe and minimum strength) under **Settings → Notification settings**. To avoid noise, an alert fires only when:

- a signal **changes** to a new BUY/SELL,
- no more than once per rule per cooldown, and
- only while a tab is open.
