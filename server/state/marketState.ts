/**
 * marketState.ts
 * Central in-memory store for live quotes, events, baselines, and feed status.
 * All simulation tick updates and route handlers read/write through this module.
 */

import {
  StockQuote,
  WatchlistRecord,
  MemoryBaselineSnapshot,
  MarketEvent,
} from "../../src/types/market.ts";
import { STOCK_UNIVERSE } from "../data/stockUniverse.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

// ---------------------------------------------------------------------------
// Live Quotes Map — keyed by symbol
// ---------------------------------------------------------------------------
export const liveQuotes: Map<string, StockQuote> = new Map();

// ---------------------------------------------------------------------------
// In-memory Watchlist — keyed by symbol (mirrors the DB for fast reads)
// ---------------------------------------------------------------------------
export const userWatchlist: Map<string, WatchlistRecord> = new Map();

// ---------------------------------------------------------------------------
// Active Baseline Snapshot
// ---------------------------------------------------------------------------
export let activeBaseline: MemoryBaselineSnapshot;
export function setActiveBaseline(snap: MemoryBaselineSnapshot) {
  activeBaseline = snap;
}

// ---------------------------------------------------------------------------
// Saved Snapshots (ring buffer, max 10)
// ---------------------------------------------------------------------------
export const savedSnapshots: MemoryBaselineSnapshot[] = [];

// ---------------------------------------------------------------------------
// Market Events
// ---------------------------------------------------------------------------
export const activeEvents: Map<string, MarketEvent> = new Map();

// ---------------------------------------------------------------------------
// Feed health state
// ---------------------------------------------------------------------------
export let conflictsResolvedCounter = 12;
export let feedStatus: "LIVE" | "DELAYED" | "STALE" | "CONFLICT_RESOLVED" = "LIVE";
export let feedLatency = 24; // ms

export function setFeedStatus(s: typeof feedStatus, latency: number) {
  feedStatus = s;
  feedLatency = latency;
}
export function incrementConflicts(n: number) {
  conflictsResolvedCounter += n;
}

// ---------------------------------------------------------------------------
// Initialise in-memory state from STOCK_UNIVERSE seed data
// ---------------------------------------------------------------------------
export function initializeMarketState() {
  const now = Date.now();

  // 1. Setup live quotes
  STOCK_UNIVERSE.forEach((seed) => {
    const spread = Math.random() * 0.04 - 0.02;
    const currentPrice = Number((seed.basePrice * (1 + spread)).toFixed(2));
    const dayChange = Number((currentPrice - seed.basePrice).toFixed(2));
    const dayChangePct = Number(((dayChange / seed.basePrice) * 100).toFixed(2));
    const volumeMultiplier = 0.8 + Math.random() * 0.7;
    const volume = Math.round(seed.avgVolume * volumeMultiplier);
    const volatility = Number((18 + Math.random() * 20 * seed.beta).toFixed(1));

    const ticks: Array<{ time: string; price: number; volume: number }> = [];
    let p = seed.basePrice;
    for (let i = 9; i >= 0; i--) {
      p += (Math.random() - 0.49) * (seed.basePrice * 0.008);
      ticks.push({
        time: new Date(now - i * 3 * 60 * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        price: Number(p.toFixed(2)),
        volume: Math.round((volume / 10) * (0.8 + Math.random() * 0.4)),
      });
    }

    const currency = seed.currency || "USD";
    const priceINR =
      currency === "INR"
        ? currentPrice
        : Number((currentPrice * USD_INR_EXCHANGE_RATE).toFixed(2));

    liveQuotes.set(seed.symbol, {
      symbol: seed.symbol,
      name: seed.name,
      sector: seed.sector,
      price: currentPrice,
      currency,
      priceINR,
      change: dayChange,
      changePct: dayChangePct,
      volume,
      avgVolume: seed.avgVolume,
      volatility,
      dayHigh: Number((Math.max(currentPrice, seed.basePrice) * 1.01).toFixed(2)),
      dayLow: Number((Math.min(currentPrice, seed.basePrice) * 0.99).toFixed(2)),
      high52: Number((seed.basePrice * 1.35).toFixed(2)),
      low52: Number((seed.basePrice * 0.75).toFixed(2)),
      lastUpdated: now,
      ticks,
    });
  });

  // 2. Default Watchlist
  const defaultSymbols = ["NVDA", "TSLA", "AAPL", "MSFT", "AMD", "COIN", "XOM", "JPM"];
  defaultSymbols.forEach((sym) => {
    const customThresholds: Record<string, unknown> = {
      priceChangePct: sym === "NVDA" || sym === "TSLA" ? 3.0 : 2.0,
      volumeMultiplier: sym === "COIN" ? 2.0 : 1.5,
      volatilityJumpPct: 20,
    };

    if (sym === "NVDA") {
      customThresholds.targetBuyPrice = 11200;
      customThresholds.targetBuyCurrency = "INR";
      customThresholds.targetBuyActive = true;
      customThresholds.targetBuyTriggered = true;
      customThresholds.targetBuyTriggeredAt = now - 18 * 60 * 1000;
      customThresholds.targetBuyNote = "Dip Buy Target: Alert when price is below ₹11,200";
    } else if (sym === "AAPL") {
      customThresholds.targetBuyPrice = 18500;
      customThresholds.targetBuyCurrency = "INR";
      customThresholds.targetBuyActive = true;
      customThresholds.targetBuyTriggered = false;
      customThresholds.targetBuyNote = "Dip Alert: Notify when price falls to ₹18,500 target";
    }

    userWatchlist.set(sym, {
      symbol: sym,
      addedAt: now - 86400000 * 7,
      customThresholds,
      tags: sym === "NVDA" || sym === "AMD" ? ["AI_CORE", "SEMIS"] : ["CORE"],
    });
  });

  // 3. Initial Memory Baseline (~3h 15m ago)
  const baselineTimestamp = now - (3 * 3600 * 1000 + 15 * 60 * 1000);
  const baselineQuotes: Record<
    string,
    { price: number; volume: number; volatility: number; timestamp: number }
  > = {};

  liveQuotes.forEach((quote, sym) => {
    let baselinePrice = quote.price;
    let baselineVol = Math.round(quote.volume * 0.45);
    let baselineVolatility = quote.volatility;

    if (sym === "NVDA") {
      baselinePrice = Number((quote.price / 1.048).toFixed(2));
      baselineVol = Math.round(quote.avgVolume * 0.35);
      baselineVolatility = quote.volatility - 8.5;
    } else if (sym === "TSLA") {
      baselinePrice = Number((quote.price * 1.032).toFixed(2));
      baselineVol = Math.round(quote.avgVolume * 0.4);
    } else if (sym === "AMD") {
      baselinePrice = Number((quote.price / 1.031).toFixed(2));
    } else if (sym === "COIN") {
      baselineVolatility = quote.volatility - 14;
    }

    baselineQuotes[sym] = {
      price: baselinePrice,
      volume: baselineVol,
      volatility: baselineVolatility,
      timestamp: baselineTimestamp,
    };
  });

  activeBaseline = {
    id: "snap_auto_last_session",
    timestamp: baselineTimestamp,
    label: "Previous Visit (3h 15m ago)",
    description: "Automatic snapshot from your previous active trading terminal session.",
    quotes: baselineQuotes,
  };
  savedSnapshots.push(activeBaseline);
}
