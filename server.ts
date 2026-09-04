import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { UserProfile, EmailDispatchRecord } from "./src/types/auth.ts";
import {
  StockQuote,
  WatchlistRecord,
  MemoryBaselineSnapshot,
  MarketEvent,
  AttentionScoreData,
  MarketSignal,
  ExplainableRationale,
  AttentionCategory,
  CompressedInsight,
  DynamicGroup,
  SectorMovement,
  DataFeedHealth,
  MarketOverviewResponse,
  EventLifecycleState,
  EventScope,
  SignalType,
  PortfolioDiversificationData,
  BuyReminderAlert,
  SectorAllocation,
  DiversificationRecommendation,
  TopKStockPick
} from "./src/types/market.ts";

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json());

// Initialize Gemini Client lazily if GEMINI_API_KEY is valid
let geminiClient: GoogleGenAI | null = null;
let geminiAuthFailed = false;
let geminiRetryAfter = 0;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  const now = Date.now();
  if (geminiAuthFailed && now < geminiRetryAfter) {
    return null;
  }
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.warn("Failed to initialize GoogleGenAI client:", e);
      return null;
    }
  }
  return geminiClient;
}

// ==========================================
// SECTOR & UNIVERSE DEFINITIONS
// ==========================================
interface StockSeed {
  symbol: string;
  name: string;
  sector: string;
  basePrice: number;
  avgVolume: number;
  beta: number;
  currency?: 'INR' | 'USD';
  marketCapTier?: 'MEGA' | 'LARGE' | 'MID';
  peRatio?: number;
  whyPick?: string;
}

const USD_INR_EXCHANGE_RATE = 85.20;

const STOCK_UNIVERSE: StockSeed[] = [
  // --- Semiconductors & Hardware ---
  { symbol: "NVDA", name: "NVIDIA Corp", sector: "Semiconductors", basePrice: 128.50, avgVolume: 52_000_000, beta: 1.85, currency: "USD", marketCapTier: "MEGA", peRatio: 48.2, whyPick: "Dominant AI accelerator platform with 88% data center GPU market share." },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors", basePrice: 154.60, avgVolume: 38_000_000, beta: 1.75, currency: "USD", marketCapTier: "LARGE", peRatio: 42.1, whyPick: "High-growth MI300 architecture challenging enterprise cloud space." },
  { symbol: "TSM", name: "Taiwan Semiconductor", sector: "Semiconductors", basePrice: 172.40, avgVolume: 22_000_000, beta: 1.25, currency: "USD", marketCapTier: "MEGA", peRatio: 26.4, whyPick: "Global foundry leader manufacturing 90% of advanced sub-5nm chips." },

  // --- Cloud & Enterprise Software ---
  { symbol: "MSFT", name: "Microsoft Corp", sector: "Cloud/Software", basePrice: 442.80, avgVolume: 21_000_000, beta: 1.12, currency: "USD", marketCapTier: "MEGA", peRatio: 35.8, whyPick: "Azure cloud compounding revenue with OpenAI Copilot integration." },
  { symbol: "PLTR", name: "Palantir Tech", sector: "Cloud/Software", basePrice: 31.25, avgVolume: 42_000_000, beta: 2.05, currency: "USD", marketCapTier: "LARGE", peRatio: 88.0, whyPick: "AIP commercial adoption expanding institutional enterprise contracts." },
  { symbol: "INFY", name: "Infosys Ltd", sector: "Cloud/Software", basePrice: 1820.00, avgVolume: 8_500_000, beta: 0.82, currency: "INR", marketCapTier: "LARGE", peRatio: 26.5, whyPick: "Tier-1 Indian IT services leader with steady dividend payout and enterprise cloud digital transformation." },

  // --- Consumer Tech & Digital Media ---
  { symbol: "AAPL", name: "Apple Inc", sector: "Consumer Tech", basePrice: 224.20, avgVolume: 48_000_000, beta: 1.05, currency: "USD", marketCapTier: "MEGA", peRatio: 33.5, whyPick: "Unrivaled global ecosystem with 2.2B active hardware devices generating high-margin services." },
  { symbol: "AMZN", name: "Amazon.com Inc", sector: "Consumer Tech", basePrice: 186.30, avgVolume: 31_000_000, beta: 1.25, currency: "USD", marketCapTier: "MEGA", peRatio: 41.2, whyPick: "AWS cloud reacceleration and high-margin retail advertising engine." },
  { symbol: "GOOGL", name: "Alphabet Inc", sector: "Digital Media", basePrice: 178.10, avgVolume: 24_000_000, beta: 1.15, currency: "USD", marketCapTier: "MEGA", peRatio: 24.1, whyPick: "Search monopoly economics paired with Gemini multi-modal infrastructure growth." },
  { symbol: "META", name: "Meta Platforms", sector: "Digital Media", basePrice: 512.00, avgVolume: 16_000_000, beta: 1.35, currency: "USD", marketCapTier: "MEGA", peRatio: 27.6, whyPick: "Unmatched social attention monetization and open-source Llama AI ecosystem." },

  // --- Automotive / Clean EV ---
  { symbol: "TSLA", name: "Tesla Inc", sector: "Automotive/EV", basePrice: 218.40, avgVolume: 65_000_000, beta: 2.10, currency: "USD", marketCapTier: "MEGA", peRatio: 64.0, whyPick: "Market leader in autonomous robotaxi compute, energy storage, and EV manufacturing scale." },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automotive/EV", basePrice: 1045.00, avgVolume: 14_000_000, beta: 1.18, currency: "INR", marketCapTier: "LARGE", peRatio: 16.8, whyPick: "India's #1 passenger EV brand plus high-margin JLR luxury international turnaround." },

  // --- Financials & Banking (Defensive / Cashflow) ---
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", basePrice: 1642.00, avgVolume: 18_000_000, beta: 0.76, currency: "INR", marketCapTier: "MEGA", peRatio: 18.2, whyPick: "India's premier private banking powerhouse; ideal defensive stabilizer with low credit delinquency." },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", basePrice: 214.90, avgVolume: 11_000_000, beta: 0.95, currency: "USD", marketCapTier: "MEGA", peRatio: 12.4, whyPick: "Fortress balance sheet, $4T assets, and dominant global net interest margin leader." },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", basePrice: 1228.00, avgVolume: 15_000_000, beta: 0.85, currency: "INR", marketCapTier: "LARGE", peRatio: 17.5, whyPick: "Best-in-class return on assets (RoA > 2.3%) and strong retail underwriting franchise." },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", basePrice: 39.40, avgVolume: 35_000_000, beta: 1.10, currency: "USD", marketCapTier: "LARGE", peRatio: 13.8, whyPick: "Massive consumer deposit base benefiting from durable interest rate environments." },

  // --- Healthcare & Pharmaceuticals (Non-Cyclical Defensive) ---
  { symbol: "LLY", name: "Eli Lilly & Co", sector: "Healthcare", basePrice: 948.00, avgVolume: 3_200_000, beta: 0.78, currency: "USD", marketCapTier: "MEGA", peRatio: 65.0, whyPick: "Revolutionary GLP-1 metabolic health portfolio with high defensive patent protection." },
  { symbol: "SUNPHARMA", name: "Sun Pharma", sector: "Healthcare", basePrice: 1785.00, avgVolume: 4_500_000, beta: 0.62, currency: "INR", marketCapTier: "LARGE", peRatio: 34.0, whyPick: "Top Indian pharma multinational with high specialty dermatology & oncology margins." },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", basePrice: 564.50, avgVolume: 3_800_000, beta: 0.65, currency: "USD", marketCapTier: "MEGA", peRatio: 22.8, whyPick: "Healthcare provider with non-correlated premium cash flows and consistent dividend growth." },

  // --- Energy & Natural Resources (Inflation Hedge) ---
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", basePrice: 2980.00, avgVolume: 9_200_000, beta: 0.88, currency: "INR", marketCapTier: "MEGA", peRatio: 27.2, whyPick: "India's highest-valued conglomerate uniting oil-to-chemicals, Jio 5G telecom, and retail." },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", basePrice: 116.80, avgVolume: 14_000_000, beta: 0.85, currency: "USD", marketCapTier: "MEGA", peRatio: 14.1, whyPick: "Low break-even barrels in Permian/Guyana with aggressive shareholder buybacks." },
  { symbol: "CVX", name: "Chevron Corp", sector: "Energy", basePrice: 148.20, avgVolume: 8_500_000, beta: 0.88, currency: "USD", marketCapTier: "LARGE", peRatio: 13.9, whyPick: "Capital-efficient upstream portfolio yielding 4.2% dividend yield." },

  // --- Consumer Staples & FMCG ---
  { symbol: "ITC", name: "ITC Limited", sector: "Consumer Staples", basePrice: 492.00, avgVolume: 16_000_000, beta: 0.55, currency: "INR", marketCapTier: "LARGE", peRatio: 27.8, whyPick: "Tremendous cash machine with 3.8% dividend yield and ultra-low beta (0.55) downside buffer." },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", basePrice: 168.50, avgVolume: 6_200_000, beta: 0.54, currency: "USD", marketCapTier: "MEGA", peRatio: 26.2, whyPick: "Essential household consumer brand with 67 consecutive years of dividend increases." },

  // --- Crypto / Fintech ---
  { symbol: "COIN", name: "Coinbase Global", sector: "Crypto/Fintech", basePrice: 228.70, avgVolume: 12_000_000, beta: 2.60, currency: "USD", marketCapTier: "LARGE", peRatio: 38.0, whyPick: "Pure-play institutional crypto exchange with Ethereum L2 Base transaction growth." }
];

// In-Memory Live State
const liveQuotes: Map<string, StockQuote> = new Map();
const userWatchlist: Map<string, WatchlistRecord> = new Map();
let activeBaseline: MemoryBaselineSnapshot;
const savedSnapshots: MemoryBaselineSnapshot[] = [];
let activeEvents: Map<string, MarketEvent> = new Map();
let conflictsResolvedCounter = 12;
let feedStatus: 'LIVE' | 'DELAYED' | 'STALE' | 'CONFLICT_RESOLVED' = 'LIVE';
let feedLatency = 24; // ms

// Initialize Quotes & Initial Watchlist
function initializeDatabase() {
  const now = Date.now();
  // 1. Setup Quotes
  STOCK_UNIVERSE.forEach(seed => {
    const spread = (Math.random() * 0.04) - 0.02; // -2% to +2%
    const currentPrice = Number((seed.basePrice * (1 + spread)).toFixed(2));
    const dayChange = Number((currentPrice - seed.basePrice).toFixed(2));
    const dayChangePct = Number(((dayChange / seed.basePrice) * 100).toFixed(2));
    const volumeMultiplier = 0.8 + Math.random() * 0.7; // 0.8x to 1.5x
    const volume = Math.round(seed.avgVolume * volumeMultiplier);
    const volatility = Number((18 + Math.random() * 20 * seed.beta).toFixed(1));

    // Initial 10 tick sparkline
    const ticks: Array<{ time: string; price: number; volume: number }> = [];
    let p = seed.basePrice;
    for (let i = 9; i >= 0; i--) {
      p += (Math.random() - 0.49) * (seed.basePrice * 0.008);
      const tickTime = new Date(now - i * 3 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ticks.push({
        time: tickTime,
        price: Number(p.toFixed(2)),
        volume: Math.round(volume / 10 * (0.8 + Math.random() * 0.4))
      });
    }

    const currency = seed.currency || "USD";
    const priceINR = currency === "INR" ? currentPrice : Number((currentPrice * USD_INR_EXCHANGE_RATE).toFixed(2));

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
      ticks
    });
  });

  // 2. Setup Default Watchlist with active buy reminders
  const defaultSymbols = ["NVDA", "TSLA", "AAPL", "MSFT", "AMD", "COIN", "XOM", "JPM"];
  defaultSymbols.forEach(sym => {
    let customThresholds: any = {
      priceChangePct: sym === "NVDA" || sym === "TSLA" ? 3.0 : 2.0,
      volumeMultiplier: sym === "COIN" ? 2.0 : 1.5,
      volatilityJumpPct: 20
    };

    // Pre-arm buy target reminder in Rupees (₹) for demonstration
    if (sym === "NVDA") {
      // NVDA current is ~$128.50 * 85.20 ≈ ₹10,948. User set target ₹11,200 (Reached!)
      customThresholds.targetBuyPrice = 11200;
      customThresholds.targetBuyCurrency = "INR";
      customThresholds.targetBuyActive = true;
      customThresholds.targetBuyTriggered = true;
      customThresholds.targetBuyTriggeredAt = now - 18 * 60 * 1000;
      customThresholds.targetBuyNote = "Dip Buy Target: Alert when price is below ₹11,200";
    } else if (sym === "AAPL") {
      // AAPL current is ~$224.20 * 85.20 ≈ ₹19,101. Target is ₹18,500 (Pending ~3.1% away)
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
      tags: sym === "NVDA" || sym === "AMD" ? ["AI_CORE", "SEMIS"] : ["CORE"]
    });
  });

  // 3. Setup Initial Memory Baseline ("Last Session: 3h 15m ago")
  const baselineTimestamp = now - (3 * 3600 * 1000 + 15 * 60 * 1000);
  const baselineQuotes: Record<string, { price: number; volume: number; volatility: number; timestamp: number }> = {};

  // Give some stocks specific historical baseline values so changes immediately appear meaningful!
  liveQuotes.forEach((quote, sym) => {
    let baselinePrice = quote.price;
    let baselineVol = Math.round(quote.volume * 0.45); // earlier in the day
    let baselineVolatility = quote.volatility;

    if (sym === "NVDA") {
      // NVDA spiked +4.8% since last checked!
      baselinePrice = Number((quote.price / 1.048).toFixed(2));
      baselineVol = Math.round(quote.avgVolume * 0.35);
      baselineVolatility = quote.volatility - 8.5;
    } else if (sym === "TSLA") {
      // TSLA dropped -3.2% earlier, currently recovering
      baselinePrice = Number((quote.price * 1.032).toFixed(2));
      baselineVol = Math.round(quote.avgVolume * 0.4);
    } else if (sym === "AMD") {
      // AMD moved with NVDA (+3.1%)
      baselinePrice = Number((quote.price / 1.031).toFixed(2));
    } else if (sym === "COIN") {
      // COIN had a volatility surge
      baselineVolatility = quote.volatility - 14;
    }

    baselineQuotes[sym] = {
      price: baselinePrice,
      volume: baselineVol,
      volatility: baselineVolatility,
      timestamp: baselineTimestamp
    };
  });

  activeBaseline = {
    id: "snap_auto_last_session",
    timestamp: baselineTimestamp,
    label: "Previous Visit (3h 15m ago)",
    description: "Automatic snapshot from your previous active trading terminal session.",
    quotes: baselineQuotes
  };

  savedSnapshots.push(activeBaseline);

  // Setup Initial Seed Events
  seedInitialEvents(baselineTimestamp, now);
}

function seedInitialEvents(baselineTs: number, now: number) {
  // NVDA Breakout Event (Escalated)
  const nvdaEvent: MarketEvent = {
    id: "evt_nvda_surge_01",
    symbol: "NVDA",
    sector: "Semiconductors",
    scope: "STOCK_SPECIFIC",
    title: "AI Chip Demand Acceleration Breakout",
    summary: "NVDA surged +4.8% on heavy volume (2.4x standard velocity) breaking above the $126 resistance level.",
    currentState: "ESCALATED",
    severity: "HIGH",
    detectedAt: baselineTs + 45 * 60 * 1000,
    lastTransitionAt: now - 20 * 60 * 1000,
    peakDeviationPct: 5.2,
    currentDeviationPct: 4.8,
    volumeMultiple: 2.4,
    signalsInvolved: ["PRICE_MOVE", "VOLUME_SPIKE", "THRESHOLD_BREACH"],
    stateHistory: [
      { state: "DEVELOPING", timestamp: baselineTs + 45 * 60 * 1000, metricSummary: "+1.8% at 1.3x vol", reason: "Unusual morning block buyer detected" },
      { state: "ESCALATED", timestamp: now - 20 * 60 * 1000, metricSummary: "+5.2% peak at 2.4x vol", reason: "Breached user defined 3.0% threshold and $126 resistance" }
    ]
  };

  // Semiconductors Sector-wide Event (Developing)
  const semiEvent: MarketEvent = {
    id: "evt_sector_semis_01",
    symbol: "SEMIS_INDEX",
    sector: "Semiconductors",
    scope: "SECTOR_WIDE",
    title: "Semiconductor Sector Coordinated Outperformance",
    summary: "Broad-based rally across chipmakers: NVDA (+4.8%) and AMD (+3.1%) moving synchronously with 82% correlation coefficient.",
    currentState: "DEVELOPING",
    severity: "MEDIUM",
    detectedAt: baselineTs + 90 * 60 * 1000,
    lastTransitionAt: now - 35 * 60 * 1000,
    peakDeviationPct: 4.0,
    currentDeviationPct: 3.9,
    volumeMultiple: 1.9,
    signalsInvolved: ["SECTOR_CORRELATION", "PRICE_MOVE"],
    stateHistory: [
      { state: "DEVELOPING", timestamp: baselineTs + 90 * 60 * 1000, metricSummary: "Avg sector delta +2.8%", reason: "7 of 8 tracked hardware names advancing in tandem" }
    ]
  };

  // TSLA Dip & Recovery Event (Recovering)
  const tslaEvent: MarketEvent = {
    id: "evt_tsla_recovery_01",
    symbol: "TSLA",
    sector: "Automotive/EV",
    scope: "STOCK_SPECIFIC",
    title: "Intraday Liquidity Dip Mean Reversion",
    summary: "TSLA dropped -3.2% early session to $212 support, currently rebounding back to $218 with normalizing order flow.",
    currentState: "RECOVERING",
    severity: "MEDIUM",
    detectedAt: baselineTs + 30 * 60 * 1000,
    lastTransitionAt: now - 15 * 60 * 1000,
    peakDeviationPct: -3.6,
    currentDeviationPct: -1.2,
    volumeMultiple: 1.6,
    signalsInvolved: ["VOLATILITY_EXPANSION", "PRICE_MOVE"],
    stateHistory: [
      { state: "DEVELOPING", timestamp: baselineTs + 30 * 60 * 1000, metricSummary: "-1.5% opening drift", reason: "Broad market futures opening weakness" },
      { state: "ESCALATED", timestamp: baselineTs + 75 * 60 * 1000, metricSummary: "-3.6% intraday low at $211.50", reason: "Options gamma rebalancing selloff" },
      { state: "RECOVERING", timestamp: now - 15 * 60 * 1000, metricSummary: "-1.2% rebounding to $218.40", reason: "Dip buyers absorbing liquidity at 200 EMA" }
    ]
  };

  activeEvents.set(nvdaEvent.id, nvdaEvent);
  activeEvents.set(semiEvent.id, semiEvent);
  activeEvents.set(tslaEvent.id, tslaEvent);
}

// ==========================================
// CORE INTELLIGENCE PIPELINE ENGINES
// ==========================================

// 1. Sector Movement Analysis
function calculateSectorMovements(): SectorMovement[] {
  const sectorsMap = new Map<string, { totalPct: number; advancers: number; decliners: number; count: number; totalVolRatio: number }>();

  liveQuotes.forEach(quote => {
    const s = quote.sector;
    if (!sectorsMap.has(s)) {
      sectorsMap.set(s, { totalPct: 0, advancers: 0, decliners: 0, count: 0, totalVolRatio: 0 });
    }
    const data = sectorsMap.get(s)!;
    data.totalPct += quote.changePct;
    data.count += 1;
    data.totalVolRatio += (quote.volume / quote.avgVolume);
    if (quote.changePct > 0.3) data.advancers += 1;
    else if (quote.changePct < -0.3) data.decliners += 1;
  });

  const movements: SectorMovement[] = [];
  sectorsMap.forEach((v, sector) => {
    const avgChangePct = Number((v.totalPct / v.count).toFixed(2));
    const volumeMultiplier = Number((v.totalVolRatio / v.count).toFixed(2));
    const correlationScore = Number((Math.max(v.advancers, v.decliners) / v.count).toFixed(2));
    const isCorrelatedSurge = avgChangePct >= 2.0 && correlationScore >= 0.75;
    const isCorrelatedDrop = avgChangePct <= -2.0 && correlationScore >= 0.75;

    movements.push({
      sector,
      avgChangePct,
      advancersCount: v.advancers,
      declinersCount: v.decliners,
      totalStocks: v.count,
      volumeMultiplier,
      isCorrelatedSurge,
      isCorrelatedDrop,
      correlationScore
    });
  });

  return movements.sort((a, b) => Math.abs(b.avgChangePct) - Math.abs(a.avgChangePct));
}

// 2. Multi-Signal Detection & Explainable Attention Score Calculation
function calculateAttentionScore(symbol: string, sectorMovements: SectorMovement[]): AttentionScoreData {
  const quote = liveQuotes.get(symbol);
  if (!quote) {
    return {
      symbol,
      totalScore: 0,
      category: "NO_MEANINGFUL_CHANGE",
      urgencyRank: 99,
      signals: [],
      rationales: [],
      primaryDriver: "No quote data available"
    };
  }

  const baseline = activeBaseline.quotes[symbol] || {
    price: quote.price,
    volume: quote.avgVolume * 0.5,
    volatility: quote.volatility,
    timestamp: activeBaseline.timestamp
  };

  const watchlistEntry = userWatchlist.get(symbol);
  const thresholds = watchlistEntry?.customThresholds || {};
  const userPriceThreshold = thresholds.priceChangePct ?? 2.5;
  const userVolThreshold = thresholds.volumeMultiplier ?? 1.6;
  const userVolatThreshold = thresholds.volatilityJumpPct ?? 20;

  const signals: MarketSignal[] = [];
  const rationales: ExplainableRationale[] = [];

  // --- Signal A: Price Movement since Baseline ---
  const deltaPricePct = Number((((quote.price - baseline.price) / baseline.price) * 100).toFixed(2));
  const absDeltaPrice = Math.abs(deltaPricePct);
  // Max 40 points for price move
  const pricePoints = Math.min(40, Math.round((absDeltaPrice / userPriceThreshold) * 22));
  if (pricePoints > 5) {
    signals.push({
      type: "PRICE_MOVE",
      label: "Price Delta vs Baseline",
      points: pricePoints,
      maxPoints: 40,
      description: `Shifted ${deltaPricePct >= 0 ? '+' : ''}${deltaPricePct}% from baseline ($${baseline.price.toFixed(2)} → $${quote.price.toFixed(2)})`,
      currentValue: quote.price,
      baselineValue: baseline.price,
      deltaPct: deltaPricePct,
      severity: absDeltaPrice >= userPriceThreshold ? "CRIT" : absDeltaPrice >= userPriceThreshold * 0.6 ? "WARN" : "INFO"
    });

    rationales.push({
      signalType: "PRICE_MOVE",
      headline: `Price Delta: ${deltaPricePct >= 0 ? '+' : ''}${deltaPricePct}% since last check`,
      detail: `Asset shifted from $${baseline.price.toFixed(2)} to $${quote.price.toFixed(2)}, representing a ${absDeltaPrice >= userPriceThreshold ? 'critical threshold breach' : 'moderate movement'}.`,
      impactScore: pricePoints,
      isCustomAlert: absDeltaPrice >= userPriceThreshold
    });
  }

  // --- Signal B: Volume Spike vs 20-Day Average ---
  const volumeMultiplier = Number((quote.volume / quote.avgVolume).toFixed(2));
  // Max 25 points
  let volPoints = 0;
  if (volumeMultiplier >= 1.2) {
    volPoints = Math.min(25, Math.round((volumeMultiplier - 1.0) * 16));
    signals.push({
      type: "VOLUME_SPIKE",
      label: "Unusual Trading Velocity",
      points: volPoints,
      maxPoints: 25,
      description: `Trading at ${volumeMultiplier}x 20-day expected volume pace (${(quote.volume / 1_000_000).toFixed(1)}M shares)`,
      currentValue: quote.volume,
      baselineValue: quote.avgVolume,
      deltaPct: Number(((volumeMultiplier - 1) * 100).toFixed(1)),
      severity: volumeMultiplier >= userVolThreshold ? "CRIT" : "WARN"
    });

    rationales.push({
      signalType: "VOLUME_SPIKE",
      headline: `Volume Spike: ${volumeMultiplier}x normal pace`,
      detail: `Turnover rate is tracking significantly higher than typical session distribution, indicating institutional block participation.`,
      impactScore: volPoints,
      isCustomAlert: volumeMultiplier >= userVolThreshold
    });
  }

  // --- Signal C: Volatility Range Expansion ---
  const baselineVolat = baseline.volatility || 20;
  const volatExpansionPct = Number((((quote.volatility - baselineVolat) / baselineVolat) * 100).toFixed(1));
  let volatPoints = 0;
  if (volatExpansionPct >= 15) {
    volatPoints = Math.min(20, Math.round((volatExpansionPct / userVolatThreshold) * 12));
    signals.push({
      type: "VOLATILITY_EXPANSION",
      label: "Volatility Regime Expansion",
      points: volatPoints,
      maxPoints: 20,
      description: `Intraday annualized ATR expanded +${volatExpansionPct}% (now ${quote.volatility.toFixed(1)}%)`,
      currentValue: quote.volatility,
      baselineValue: baselineVolat,
      deltaPct: volatExpansionPct,
      severity: volatExpansionPct >= userVolatThreshold ? "CRIT" : "WARN"
    });

    rationales.push({
      signalType: "VOLATILITY_EXPANSION",
      headline: `Volatility Jump: +${volatExpansionPct}% range expansion`,
      detail: `Intraday high-low spread ($${quote.dayLow.toFixed(2)} - $${quote.dayHigh.toFixed(2)}) widened beyond standard variance bounds.`,
      impactScore: volatPoints,
      isCustomAlert: volatExpansionPct >= userVolatThreshold
    });
  }

  // --- Signal D: User-Defined Threshold Crossings ---
  let thresholdPoints = 0;
  const breachedPriceThreshold = absDeltaPrice >= userPriceThreshold;
  const breachedVolThreshold = volumeMultiplier >= userVolThreshold;
  if (breachedPriceThreshold || breachedVolThreshold) {
    thresholdPoints = (breachedPriceThreshold ? 12 : 0) + (breachedVolThreshold ? 8 : 0);
    signals.push({
      type: "THRESHOLD_BREACH",
      label: "User Alert Rule Triggered",
      points: thresholdPoints,
      maxPoints: 20,
      description: `Breached custom rule(s): ${breachedPriceThreshold ? `ΔPrice >= ±${userPriceThreshold}%` : ''}${breachedPriceThreshold && breachedVolThreshold ? ' & ' : ''}${breachedVolThreshold ? `Volume >= ${userVolThreshold}x` : ''}`,
      currentValue: breachedPriceThreshold ? absDeltaPrice : volumeMultiplier,
      baselineValue: breachedPriceThreshold ? userPriceThreshold : userVolThreshold,
      deltaPct: 100,
      severity: "CRIT"
    });

    rationales.push({
      signalType: "THRESHOLD_BREACH",
      headline: `Rule Breached: User threshold active`,
      detail: `Your custom monitoring configuration signaled an immediate trigger for ${symbol}.`,
      impactScore: thresholdPoints,
      isCustomAlert: true
    });
  }

  // --- Signal E: Sector Correlation Movement ---
  const sectorData = sectorMovements.find(s => s.sector === quote.sector);
  let sectorPoints = 0;
  if (sectorData && (sectorData.isCorrelatedSurge || sectorData.isCorrelatedDrop)) {
    sectorPoints = 15;
    signals.push({
      type: "SECTOR_CORRELATION",
      label: "Correlated Sector Move",
      points: sectorPoints,
      maxPoints: 15,
      description: `${quote.sector} sector exhibiting ${sectorData.avgChangePct > 0 ? 'bullish rally' : 'bearish pullback'} (${sectorData.avgChangePct >= 0 ? '+' : ''}${sectorData.avgChangePct}% avg)`,
      currentValue: sectorData.avgChangePct,
      baselineValue: 0,
      deltaPct: sectorData.avgChangePct,
      severity: "WARN"
    });

    rationales.push({
      signalType: "SECTOR_CORRELATION",
      headline: `Sector Momentum: ${quote.sector} (${sectorData.avgChangePct >= 0 ? '+' : ''}${sectorData.avgChangePct}%)`,
      detail: `High sector co-movement (${Math.round(sectorData.correlationScore * 100)}% co-directional advancers/decliners).`,
      impactScore: sectorPoints,
      isCustomAlert: false
    });
  }

  // --- Signal F: Target Buy Price Reached (Rupees or USD) ---
  let buyTargetPoints = 0;
  let reachedBuyTarget = false;
  if (thresholds.targetBuyPrice && thresholds.targetBuyActive !== false) {
    const targetCurrency = thresholds.targetBuyCurrency || (quote.currency === "INR" ? "INR" : "INR");
    const currentPriceInTarget = targetCurrency === "INR"
      ? (quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2)))
      : (quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2)));

    reachedBuyTarget = currentPriceInTarget <= thresholds.targetBuyPrice || Boolean(thresholds.targetBuyTriggered);
    const symSymbol = targetCurrency === "INR" ? "₹" : "$";

    if (reachedBuyTarget) {
      buyTargetPoints = 25;
      signals.push({
        type: "THRESHOLD_BREACH",
        label: "Target Buy Price Reached",
        points: buyTargetPoints,
        maxPoints: 25,
        description: `Target buy alert triggered at ${symSymbol}${currentPriceInTarget.toLocaleString()} (Target: ≤ ${symSymbol}${thresholds.targetBuyPrice.toLocaleString()})`,
        currentValue: currentPriceInTarget,
        baselineValue: thresholds.targetBuyPrice,
        deltaPct: Number((((currentPriceInTarget - thresholds.targetBuyPrice) / thresholds.targetBuyPrice) * 100).toFixed(2)),
        severity: "CRIT"
      });

      rationales.push({
        signalType: "THRESHOLD_BREACH",
        headline: `🎯 BUY REMINDER: Reached ${symSymbol}${thresholds.targetBuyPrice.toLocaleString()}`,
        detail: `${symbol} reached your target purchase level of ${symSymbol}${thresholds.targetBuyPrice.toLocaleString()} (Current: ${symSymbol}${currentPriceInTarget.toLocaleString()}). Ready for trade entry.`,
        impactScore: buyTargetPoints,
        isCustomAlert: true
      });
    }
  }

  // Calculate Total Score (capped at 100)
  const rawScore = pricePoints + volPoints + volatPoints + thresholdPoints + sectorPoints + buyTargetPoints;
  const totalScore = Math.min(100, Math.max(0, rawScore));

  // Determine Category
  let category: AttentionCategory = "NO_MEANINGFUL_CHANGE";
  if (totalScore >= 70 || breachedPriceThreshold || reachedBuyTarget) {
    category = "NEEDS_ATTENTION";
  } else if (totalScore >= 35 || volPoints >= 15 || absDeltaPrice >= 1.5) {
    category = "WORTH_KNOWING";
  }

  // Urgency rank (1 = highest urgency)
  const urgencyRank = 100 - totalScore;

  // Primary driver string
  let primaryDriver = "Normal baseline oscillation";
  if (signals.length > 0) {
    const sortedSignals = [...signals].sort((a, b) => b.points - a.points);
    primaryDriver = `${sortedSignals[0].label} (+${sortedSignals[0].points} pts)`;
  }

  return {
    symbol,
    totalScore,
    category,
    urgencyRank,
    signals,
    rationales,
    primaryDriver
  };
}

// 3. Dynamic Groups Generation
function generateDynamicGroups(
  scores: Record<string, AttentionScoreData>,
  quotes: StockQuote[]
): DynamicGroup[] {
  // Most Active: Top volume ratio
  const mostActive = [...quotes]
    .filter(q => (q.volume / q.avgVolume) >= 1.3)
    .sort((a, b) => (b.volume / b.avgVolume) - (a.volume / a.avgVolume))
    .map(q => q.symbol);

  // High Attention: score >= 70
  const highAttention = Object.values(scores)
    .filter(s => s.totalScore >= 70)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map(s => s.symbol);

  // Strong Momentum: |changePct| >= 2.5%
  const strongMomentum = [...quotes]
    .filter(q => Math.abs(q.changePct) >= 2.5)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .map(q => q.symbol);

  // High Volatile: volatility >= 30%
  const highVolatile = [...quotes]
    .filter(q => q.volatility >= 30)
    .sort((a, b) => b.volatility - a.volatility)
    .map(q => q.symbol);

  // Stable: |changePct| < 1.0% and score < 30
  const stable = [...quotes]
    .filter(q => Math.abs(q.changePct) < 1.0 && (scores[q.symbol]?.totalScore || 0) < 30)
    .sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct))
    .map(q => q.symbol);

  return [
    {
      id: "grp_high_attention",
      name: "CRITICAL ATTENTION",
      code: "ATTN_PRIORITY",
      description: "Assets with multiple anomaly signals or custom threshold breaches.",
      symbols: highAttention,
      badgeColor: "red",
      metricHighlight: `${highAttention.length} assets require review`
    },
    {
      id: "grp_most_active",
      name: "ABNORMAL VELOCITY",
      code: "VOLUME_SURGE",
      description: "Trading volume significantly exceeding 20-day baseline distributions.",
      symbols: mostActive,
      badgeColor: "amber",
      metricHighlight: `${mostActive.length} assets with volume spike`
    },
    {
      id: "grp_momentum",
      name: "STRONG MOMENTUM",
      code: "DIRECTIONAL_VELOCITY",
      description: "Aggressive directional price impulse (>2.5% intraday change).",
      symbols: strongMomentum,
      badgeColor: "green",
      metricHighlight: `${strongMomentum.length} trending names`
    },
    {
      id: "grp_volatility",
      name: "HIGH VOLATILITY",
      code: "REGIME_EXPANSION",
      description: "Elevated high-low intraday ATR spreads and gamma movement.",
      symbols: highVolatile,
      badgeColor: "purple",
      metricHighlight: `${highVolatile.length} wide range assets`
    },
    {
      id: "grp_stable",
      name: "STEADY / ANCHORED",
      code: "MEAN_CONVERGENCE",
      description: "Quiet, orderly price discovery with minimal drift from baseline.",
      symbols: stable,
      badgeColor: "blue",
      metricHighlight: `${stable.length} anchored assets`
    }
  ];
}

// 4. Event Lifecycle State Transition Engine
function updateEventLifecycle(now: number) {
  activeEvents.forEach((evt, id) => {
    const quote = liveQuotes.get(evt.symbol);
    if (!quote) return;

    const baseline = activeBaseline.quotes[evt.symbol];
    if (!baseline) return;

    const deltaPct = Number((((quote.price - baseline.price) / baseline.price) * 100).toFixed(2));
    evt.currentDeviationPct = deltaPct;
    if (Math.abs(deltaPct) > Math.abs(evt.peakDeviationPct)) {
      evt.peakDeviationPct = deltaPct;
    }
    evt.volumeMultiple = Number((quote.volume / quote.avgVolume).toFixed(2));

    // Lifecycle State Machine logic
    const timeInCurrentState = now - evt.lastTransitionAt;

    if (evt.currentState === "DEVELOPING") {
      // Escalate if price move grew, or volume exploded > 2.0x
      if (Math.abs(deltaPct) >= 3.0 || evt.volumeMultiple >= 2.0) {
        evt.currentState = "ESCALATED";
        evt.severity = "CRITICAL";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "ESCALATED",
          timestamp: now,
          metricSummary: `Deviation amplified to ${deltaPct > 0 ? '+' : ''}${deltaPct}% at ${evt.volumeMultiple}x volume`,
          reason: "Signal intensity crossed secondary threshold; momentum expanded"
        });
      }
    } else if (evt.currentState === "ESCALATED") {
      // Transition to Recovering if price reverted by >= 35% from peak
      const revertedPct = Math.abs(evt.peakDeviationPct) - Math.abs(deltaPct);
      if (revertedPct >= Math.abs(evt.peakDeviationPct) * 0.35 && timeInCurrentState > 60_000) {
        evt.currentState = "RECOVERING";
        evt.severity = "MEDIUM";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "RECOVERING",
          timestamp: now,
          metricSummary: `Price retraced to ${deltaPct > 0 ? '+' : ''}${deltaPct}% (Peak was ${evt.peakDeviationPct > 0 ? '+' : ''}${evt.peakDeviationPct}%)`,
          reason: "Impulse fading; order flow rebalancing towards median"
        });
      }
    } else if (evt.currentState === "RECOVERING") {
      // Transition to Resolved if delta is within normal noise (e.g. < 0.8%) or stable for a long time
      if (Math.abs(deltaPct) <= 0.8 || timeInCurrentState > 300_000) {
        evt.currentState = "RESOLVED";
        evt.severity = "LOW";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "RESOLVED",
          timestamp: now,
          metricSummary: `Variance compressed to ${deltaPct > 0 ? '+' : ''}${deltaPct}%`,
          reason: "Event normalized; standard liquidity equilibrium restored"
        });
      }
    }
  });
}

// 5. Event Compression Pipeline (Raw -> Deduplicate -> Group -> Compressed Version)
function compressEvents(
  scores: Record<string, AttentionScoreData>,
  sectors: SectorMovement[]
): CompressedInsight[] {
  const insights: CompressedInsight[] = [];

  // Group A: Sector Correlated Movements
  sectors.filter(s => s.isCorrelatedSurge || s.isCorrelatedDrop).forEach(sec => {
    const symbolsInSector = Array.from(userWatchlist.keys()).filter(sym => {
      const q = liveQuotes.get(sym);
      return q?.sector === sec.sector;
    });

    if (symbolsInSector.length > 0) {
      const isBull = sec.avgChangePct > 0;
      insights.push({
        id: `ins_sec_${sec.sector.toLowerCase()}`,
        scope: "SECTOR_WIDE",
        category: "NEEDS_ATTENTION",
        sector: sec.sector,
        symbols: symbolsInSector,
        headline: `${sec.sector.toUpperCase()} MACRO CLUSTER: ${isBull ? 'COORDINATED RALLY' : 'SECTOR SELLOFF'}`,
        deduplicatedCount: symbolsInSector.length * 4,
        executiveSummary: `Aggregated ${symbolsInSector.length} individual symbol alerts into single macro cluster. The entire ${sec.sector} basket is moving synchronously with ${Math.round(sec.correlationScore * 100)}% directional consensus, averaging ${sec.avgChangePct >= 0 ? '+' : ''}${sec.avgChangePct}%.`,
        actionableContext: `Individual stock alerts for ${symbolsInSector.join(", ")} share systemic macro drivers rather than idiosyncratic news. Focus on sector-wide liquidity flows.`,
        signals: ["SECTOR_CORRELATION", "VOLUME_SPIKE"],
        highestScore: 88
      });
    }
  });

  // Group B: High Attention Stock Specific Events
  const highAttentionSymbols = Object.entries(scores)
    .filter(([_, score]) => score.category === "NEEDS_ATTENTION")
    .map(([sym]) => sym);

  highAttentionSymbols.forEach(sym => {
    const scoreData = scores[sym];
    const quote = liveQuotes.get(sym);
    if (!quote) return;

    // Check if symbol already represented in a sector insight
    const inSectorInsight = insights.some(i => i.scope === "SECTOR_WIDE" && i.symbols.includes(sym));
    if (inSectorInsight && scoreData.totalScore < 85) return; // compress into sector insight

    const topSignals = scoreData.signals.map(s => s.label);
    insights.push({
      id: `ins_stock_${sym.toLowerCase()}`,
      scope: "STOCK_SPECIFIC",
      category: scoreData.category,
      symbols: [sym],
      headline: `${sym}: ${scoreData.primaryDriver.toUpperCase()}`,
      deduplicatedCount: 7, // represents multi-tick deduplicated alerts
      executiveSummary: `${sym} triggered an attention score of ${scoreData.totalScore}/100. ${scoreData.rationales.map(r => r.detail).join(" ")}`,
      actionableContext: `Threshold triggers fired at current price $${quote.price.toFixed(2)}. Day range: $${quote.dayLow.toFixed(2)} - $${quote.dayHigh.toFixed(2)}.`,
      signals: topSignals,
      highestScore: scoreData.totalScore
    });
  });

  // Group C: Worth Knowing Digest (Compressed multi-asset brief)
  const worthKnowingSymbols = Object.entries(scores)
    .filter(([_, score]) => score.category === "WORTH_KNOWING")
    .map(([sym]) => sym);

  if (worthKnowingSymbols.length > 0) {
    insights.push({
      id: "ins_worth_knowing_digest",
      scope: "MARKET_WIDE",
      category: "WORTH_KNOWING",
      symbols: worthKnowingSymbols,
      headline: `SECONDARY DRIFT: ${worthKnowingSymbols.length} ASSETS NOTED`,
      deduplicatedCount: worthKnowingSymbols.length * 3,
      executiveSummary: `Compressed secondary events across: ${worthKnowingSymbols.join(", ")}. These assets exhibit moderate price displacement or volume buildup without breaching critical risk bounds.`,
      actionableContext: `No immediate intervention required, but watchlist monitoring should remain active.`,
      signals: ["PRICE_MOVE", "VOLUME_SPIKE"],
      highestScore: 62
    });
  }

  return insights;
}

// Executive Briefing Cache & Non-blocking Generator
let cachedBriefing: string = "";
let lastBriefingTime: number = 0;
let isGeneratingBriefing: boolean = false;

function buildDeterministicBriefing(
  timeElapsedStr: string,
  scores: Record<string, AttentionScoreData>,
  events: MarketEvent[]
): string {
  const needsAttention = Object.values(scores).filter(s => s.category === "NEEDS_ATTENTION");
  const worthKnowing = Object.values(scores).filter(s => s.category === "WORTH_KNOWING");
  const totalTracked = Object.keys(scores).length;

  const escalatedEvents = events.filter(e => e.currentState === "ESCALATED");
  const recoveringEvents = events.filter(e => e.currentState === "RECOVERING");
  const criticalSymbols = needsAttention.map(s => s.symbol);

  let briefing = `>>> EXECUTIVE BRIEFING | BASELINE SNAPSHOT: ${timeElapsedStr.toUpperCase()} AGO\n`;

  if (criticalSymbols.length === 0 && worthKnowing.length === 0) {
    briefing += `MARKET QUIET: All ${totalTracked} tracked assets remain anchored within normal variance envelopes. Zero threshold breaches recorded. No immediate intervention recommended.`;
  } else {
    briefing += `ALERT MATRIX: ${criticalSymbols.length} critical / ${worthKnowing.length} secondary alerts recorded across ${totalTracked} tracked assets. `;
    if (criticalSymbols.length > 0) {
      const topPick = needsAttention[0];
      briefing += `PRIMARY DRIVER: ${topPick.symbol} leads urgency queue (Score ${topPick.totalScore}/100) triggered by ${topPick.primaryDriver.toLowerCase()}. `;
    }
    if (escalatedEvents.length > 0) {
      briefing += `LIFECYCLE STATUS: ${escalatedEvents.map(e => e.symbol).join(", ")} currently in ESCALATED regime with abnormal volume. `;
    }
    if (recoveringEvents.length > 0) {
      briefing += `${recoveringEvents.map(e => e.symbol).join(", ")} undergoing mean-reversion recovery. `;
    }
    briefing += `RECOMMENDATION: Review filtered attention pane and verify customized exit thresholds.`;
  }

  return briefing;
}

// Background Gemini Refresher (Non-blocking)
function triggerGeminiBriefingRefresh(
  timeElapsedStr: string,
  scores: Record<string, AttentionScoreData>,
  events: MarketEvent[]
) {
  if (isGeneratingBriefing) return;
  const ai = getGeminiClient();
  if (!ai) return;

  isGeneratingBriefing = true;
  const needsAttention = Object.values(scores).filter(s => s.category === "NEEDS_ATTENTION");
  const worthKnowing = Object.values(scores).filter(s => s.category === "WORTH_KNOWING");
  const totalTracked = Object.keys(scores).length;

  const prompt = `You are a Wall Street quantitative terminal market memory engine.
Current Context:
- Time elapsed since user last checked: ${timeElapsedStr}
- Total watchlist assets tracked: ${totalTracked}
- Assets needing attention: ${needsAttention.map(s => `${s.symbol} (Score ${s.totalScore}/100: ${s.primaryDriver})`).join("; ") || "None"}
- Worth knowing assets: ${worthKnowing.map(s => s.symbol).join(", ") || "None"}
- Active lifecycle events: ${events.map(e => `${e.symbol} [${e.currentState}]: ${e.summary}`).join("; ")}

Generate a concise, crisp 3-4 sentence terminal executive briefing for the returning trader.
Rules:
- Adopt a disciplined, hacker/quant terminal tone (e.g. "STATUS REPORT", "SINCE LAST CHECK:").
- Strictly highlight what has MEANINGFULLY changed since the user last checked.
- Explicitly cite why certain items demand attention (price breakouts, volume multiples, sector correlation).
- Highlight lifecycle progression (developing vs recovering).
- Keep text monospaced and readable, under 90 words.`;

  ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt
  })
    .then(response => {
      if (response.text) {
        cachedBriefing = response.text.trim();
        lastBriefingTime = Date.now();
      }
    })
    .catch(err => {
      // Check if error is 401 unauthenticated / invalid credentials
      const errMsg = err?.message || String(err);
      const isAuthError =
        errMsg.includes("401") ||
        errMsg.includes("UNAUTHENTICATED") ||
        errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED") ||
        errMsg.includes("invalid authentication credentials");

      if (isAuthError) {
        geminiAuthFailed = true;
        geminiRetryAfter = Date.now() + 15 * 60 * 1000; // 15-minute backoff
        console.warn("Gemini API authentication unavailable; operating in deterministic executive briefing mode.");
      } else {
        console.warn("Gemini briefing generation note:", errMsg);
      }
      // Set timestamp so it doesn't repeatedly loop on every poll
      lastBriefingTime = Date.now();
    })
    .finally(() => {
      isGeneratingBriefing = false;
    });
}

// 6. Personalized Executive Briefing Synthesis (Instant Response)
function synthesizeExecutiveBriefing(
  timeElapsedStr: string,
  scores: Record<string, AttentionScoreData>,
  compressedInsights: CompressedInsight[],
  events: MarketEvent[]
): string {
  const now = Date.now();
  const deterministic = buildDeterministicBriefing(timeElapsedStr, scores, events);

  // If client is available and cache is empty or older than 60 seconds, attempt non-blocking refresh
  const ai = getGeminiClient();
  if (ai && (now - lastBriefingTime > 60_000 || !cachedBriefing)) {
    triggerGeminiBriefingRefresh(timeElapsedStr, scores, events);
  }

  // If we already have a cached briefing and it's reasonably fresh (< 90s), use it
  if (cachedBriefing && now - lastBriefingTime < 90_000) {
    return cachedBriefing;
  }

  // Instant fallback to deterministic engine
  cachedBriefing = deterministic;
  return cachedBriefing;
}

// Helper to format elapsed time
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Portfolio Diversification & Sector Gap Detection Engine
function calculatePortfolioDiversification(
  watchlist: WatchlistRecord[],
  stocks: StockQuote[]
): PortfolioDiversificationData {
  const stockMap = new Map<string, StockQuote>();
  stocks.forEach(s => stockMap.set(s.symbol, s));

  // 1. Calculate sector allocation of active watchlist
  const sectorCountMap: Record<string, { count: number; symbols: string[] }> = {};
  const totalWatchlist = watchlist.length || 1;

  watchlist.forEach(item => {
    const q = stockMap.get(item.symbol);
    const sector = q?.sector || "Other";
    if (!sectorCountMap[sector]) {
      sectorCountMap[sector] = { count: 0, symbols: [] };
    }
    sectorCountMap[sector].count += 1;
    sectorCountMap[sector].symbols.push(item.symbol);
  });

  // Get all unique sectors from STOCK_UNIVERSE
  const allUniverseSectors = Array.from(new Set(STOCK_UNIVERSE.map(s => s.sector)));

  const userSectorDistribution: SectorAllocation[] = allUniverseSectors.map(sector => {
    const userSector = sectorCountMap[sector] || { count: 0, symbols: [] };
    const weightPct = Math.round((userSector.count / totalWatchlist) * 100);
    let status: 'OVERWEIGHT' | 'BALANCED' | 'UNDERWEIGHT' | 'MISSING' = 'MISSING';
    if (userSector.count === 0) status = 'MISSING';
    else if (weightPct >= 35) status = 'OVERWEIGHT';
    else if (weightPct >= 15) status = 'BALANCED';
    else status = 'UNDERWEIGHT';

    return {
      sector,
      count: userSector.count,
      weightPct,
      symbols: userSector.symbols,
      status
    };
  }).sort((a, b) => b.weightPct - a.weightPct);

  // 2. Identify dominant sector & concentration risk
  const dominant = userSectorDistribution[0] || { sector: "None", weightPct: 0 };
  let concentrationRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (dominant.weightPct >= 60) concentrationRisk = 'CRITICAL';
  else if (dominant.weightPct >= 45) concentrationRisk = 'HIGH';
  else if (dominant.weightPct >= 30) concentrationRisk = 'MODERATE';
  else concentrationRisk = 'LOW';

  const missingSectors = userSectorDistribution.filter(s => s.status === 'MISSING').map(s => s.sector);
  const underweightedSectors = userSectorDistribution.filter(s => s.status === 'UNDERWEIGHT').map(s => s.sector);

  const concentrationSummary = concentrationRisk === 'HIGH' || concentrationRisk === 'CRITICAL'
    ? `High sector concentration: ${dominant.weightPct}% of your watchlist is concentrated in ${dominant.sector}. You are heavily exposed to cyclical tech drawdowns. We recommend hedging into ${missingSectors.slice(0, 2).join(" and ")}.`
    : concentrationRisk === 'MODERATE'
    ? `Moderate concentration in ${dominant.sector} (${dominant.weightPct}%). Adding exposure to defensive or non-correlated sectors will smooth drawdown volatility.`
    : `Well-diversified watchlist across multiple market sectors with low single-sector concentration risk.`;

  // 3. Assemble Top-K Stock Picks by Sector (from STOCK_UNIVERSE)
  const watchlistSymbolSet = new Set(watchlist.map(w => w.symbol));
  const allSectorTopPicks: Record<string, TopKStockPick[]> = {};

  allUniverseSectors.forEach(sector => {
    const seedsInSector = STOCK_UNIVERSE.filter(s => s.sector === sector);
    const mappedPicks: TopKStockPick[] = seedsInSector.map(seed => {
      const q = stockMap.get(seed.symbol);
      const currentPrice = q ? q.price : seed.basePrice;
      const priceINR = q?.priceINR || (seed.currency === 'INR' ? currentPrice : Number((currentPrice * USD_INR_EXCHANGE_RATE).toFixed(2)));
      const changePct = q ? q.changePct : 0;
      const volume = q ? q.volume : seed.avgVolume;
      const volatility = q ? q.volatility : 22.0;

      return {
        symbol: seed.symbol,
        name: seed.name,
        sector: seed.sector,
        price: currentPrice,
        currency: seed.currency || 'USD',
        priceINR,
        changePct,
        volume,
        beta: seed.beta,
        volatility,
        rank: 1,
        whyPick: seed.whyPick || "High-quality market leader with strong institutional liquidity.",
        isInWatchlist: watchlistSymbolSet.has(seed.symbol),
        peRatio: seed.peRatio,
        marketCapTier: seed.marketCapTier
      };
    });

    // Rank: Prioritize non-watchlist stocks, lower beta, and positive momentum
    mappedPicks.sort((a, b) => {
      if (a.isInWatchlist !== b.isInWatchlist) {
        return a.isInWatchlist ? 1 : -1; // un-watched first
      }
      const scoreA = (a.changePct * 2) - (a.beta * 3);
      const scoreB = (b.changePct * 2) - (b.beta * 3);
      return scoreB - scoreA;
    });

    mappedPicks.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    allSectorTopPicks[sector] = mappedPicks;
  });

  // 4. Formulate specific cross-sector diversification recommendations (Top K=3)
  const recommendations: DiversificationRecommendation[] = [];
  const candidateSectors = [...missingSectors, ...underweightedSectors].filter(s => s !== dominant.sector);

  candidateSectors.slice(0, 4).forEach((targetSec, idx) => {
    const topKPicks = (allSectorTopPicks[targetSec] || []).slice(0, 3);
    if (topKPicks.length === 0) return;

    let headline = `Add Top-3 ${targetSec} to Hedge ${dominant.sector}`;
    let rationale = `Your portfolio has heavy exposure to ${dominant.sector} (${dominant.weightPct}%). Diversifying into ${targetSec} reduces systemic correlation and adds resilient cashflow.`;
    let benefit = `Non-cyclical cashflow balance`;
    let correlationImpact = `Low correlation (<0.25) vs ${dominant.sector}`;

    if (targetSec === "Healthcare") {
      headline = `Hedge ${dominant.sector} Volatility with Defensive Healthcare`;
      rationale = `Your portfolio has ${dominant.weightPct}% exposure to ${dominant.sector}. Healthcare leaders have an average beta of 0.68, providing stability and steady institutional dividends when growth stocks consolidate.`;
      benefit = "Recession-resilient prescription demand & high free cash flow.";
      correlationImpact = "Dampens total watchlist beta by up to 22%.";
    } else if (targetSec === "Financials") {
      headline = `Capture Credit & Banking Margins in Financials`;
      rationale = `Financial institutions benefit from persistent interest income and credit growth. Adding top private banks like HDFC Bank or JPMorgan balances growth equities with asset-backed earnings.`;
      benefit = "High capital returns, low valuation multiples, and dividend yields.";
      correlationImpact = "0.32 correlation against tech valuations.";
    } else if (targetSec === "Energy") {
      headline = `Macro Inflation Shield: Allocate to Energy Giants`;
      rationale = `Energy conglomerates like Reliance Industries and Exxon Mobil act as natural hedges against commodity inflation and geopolitical supply friction.`;
      benefit = "Direct commodity upside and defensive high shareholder return programs.";
      correlationImpact = "Negative correlation during inflation shocks.";
    } else if (targetSec === "Consumer Staples") {
      headline = `Ultra-Low Beta Buffer: Consumer Staples & FMCG`;
      rationale = `Companies like ITC Limited (beta 0.55) and Procter & Gamble offer essential consumer staples with consistent pricing power across all economic phases.`;
      benefit = "Predictable consumer cash flow and high dividend yields.";
      correlationImpact = "Safeguards against cyclical tech market corrections.";
    }

    recommendations.push({
      id: `rec_div_${targetSec.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx}`,
      targetSector: targetSec,
      sourceOverweightSector: dominant.sector,
      urgency: dominant.weightPct >= 50 ? 'HIGH' : 'MEDIUM',
      headline,
      rationale,
      diversificationBenefit: benefit,
      correlationImpact,
      topKStocks: topKPicks
    });
  });

  return {
    userSectorDistribution,
    dominantSector: dominant.sector,
    concentrationRisk,
    concentrationSummary,
    recommendations,
    allSectorTopPicks
  };
}

// Complete Assembly Helper
async function assembleMarketOverview(): Promise<MarketOverviewResponse> {
  const now = Date.now();
  updateEventLifecycle(now);

  const sectorMovements = calculateSectorMovements();
  const stocks = Array.from(liveQuotes.values());
  const watchlist = Array.from(userWatchlist.values());

  const attentionScores: Record<string, AttentionScoreData> = {};
  watchlist.forEach(item => {
    attentionScores[item.symbol] = calculateAttentionScore(item.symbol, sectorMovements);
  });

  const dynamicGroups = generateDynamicGroups(attentionScores, stocks);
  const events = Array.from(activeEvents.values());
  const compressedInsights = compressEvents(attentionScores, sectorMovements);

  const elapsedMs = now - activeBaseline.timestamp;
  const elapsedFormatted = formatElapsedTime(elapsedMs);

  const personalizedExecutiveBriefing = synthesizeExecutiveBriefing(
    elapsedFormatted,
    attentionScores,
    compressedInsights,
    events
  );

  // Compute portfolio diversification analysis & Top-K cross sector suggestions
  const diversification = calculatePortfolioDiversification(watchlist, stocks);

  // Compute active & triggered buy reminders
  const buyReminders: BuyReminderAlert[] = [];
  watchlist.forEach(item => {
    const q = liveQuotes.get(item.symbol);
    if (!q) return;
    const thresh = item.customThresholds;
    if (thresh && thresh.targetBuyPrice && thresh.targetBuyActive !== false) {
      const targetCurrency = thresh.targetBuyCurrency || (q.currency === 'INR' ? 'INR' : 'INR');
      const currentPriceInTarget = targetCurrency === 'INR'
        ? (q.priceINR || (q.currency === 'INR' ? q.price : Number((q.price * USD_INR_EXCHANGE_RATE).toFixed(2))))
        : (q.currency === 'USD' ? q.price : Number((q.price / USD_INR_EXCHANGE_RATE).toFixed(2)));

      const isTriggered = currentPriceInTarget <= thresh.targetBuyPrice;
      const gapPct = Number((((currentPriceInTarget - thresh.targetBuyPrice) / thresh.targetBuyPrice) * 100).toFixed(2));

      if (isTriggered && !thresh.targetBuyTriggered) {
        thresh.targetBuyTriggered = true;
        thresh.targetBuyTriggeredAt = Date.now();
      }

      buyReminders.push({
        symbol: item.symbol,
        stockName: q.name,
        sector: q.sector,
        targetBuyPrice: thresh.targetBuyPrice,
        targetBuyCurrency: targetCurrency,
        currentPrice: q.price,
        priceInTargetCurrency: currentPriceInTarget,
        gapPct,
        triggered: Boolean(thresh.targetBuyTriggered || isTriggered),
        triggeredAt: thresh.targetBuyTriggeredAt,
        note: thresh.targetBuyNote || `Buy reminder target: ${targetCurrency === 'INR' ? '₹' : '$'}${thresh.targetBuyPrice.toLocaleString()}`
      });
    }
  });

  const needsAttentionCount = Object.values(attentionScores).filter(s => s.category === "NEEDS_ATTENTION").length;
  const worthKnowingCount = Object.values(attentionScores).filter(s => s.category === "WORTH_KNOWING").length;
  const normalCount = Object.values(attentionScores).filter(s => s.category === "NO_MEANINGFUL_CHANGE").length;
  const activeAlertsCount = events.filter(e => e.currentState !== "RESOLVED").length;
  const unusualVolumeCount = stocks.filter(s => (s.volume / s.avgVolume) >= 1.5).length;
  const triggeredBuyAlertsCount = buyReminders.filter(b => b.triggered).length;

  const feedHealth: DataFeedHealth = {
    status: feedStatus,
    latencyMs: feedLatency + Math.floor(Math.random() * 8),
    activeFeed: "DIRECT_EXCHANGE",
    lastTickTimestamp: now,
    conflictsResolvedCount: conflictsResolvedCounter,
    cacheHitRatio: 0.94,
    isSimulated: true
  };

  return {
    feedHealth,
    memory: {
      currentBaseline: activeBaseline,
      availableSnapshots: savedSnapshots.map(s => ({ id: s.id, timestamp: s.timestamp, label: s.label })),
      timeSinceBaselineFormatted: elapsedFormatted,
      elapsedSeconds: Math.floor(elapsedMs / 1000)
    },
    watchlist,
    stocks,
    attentionScores,
    events,
    compressedInsights,
    dynamicGroups,
    sectorMovements,
    personalizedExecutiveBriefing,
    diversification,
    buyReminders,
    systemSummary: {
      totalTracked: watchlist.length,
      needsAttentionCount,
      worthKnowingCount,
      normalCount,
      activeAlertsCount,
      unusualVolumeCount,
      triggeredBuyAlertsCount
    }
  };
}

// Initialize seed data
initializeDatabase();

// Background Tick Simulation Engine (Runs small stochastic micro-updates)
setInterval(() => {
  const now = Date.now();
  liveQuotes.forEach(quote => {
    // 25% chance of tick update per second
    if (Math.random() > 0.3) return;

    const seed = STOCK_UNIVERSE.find(s => s.symbol === quote.symbol);
    const beta = seed?.beta || 1.0;
    const delta = (Math.random() - 0.495) * (quote.price * 0.003 * beta);
    const newPrice = Number((Math.max(1, quote.price + delta)).toFixed(2));
    const newChange = Number((newPrice - (seed?.basePrice || quote.price)).toFixed(2));
    const newChangePct = Number(((newChange / (seed?.basePrice || quote.price)) * 100).toFixed(2));
    const newVolume = quote.volume + Math.floor(Math.random() * 25_000);

    quote.price = newPrice;
    quote.change = newChange;
    quote.changePct = newChangePct;
    quote.volume = newVolume;
    quote.dayHigh = Number(Math.max(quote.dayHigh, newPrice).toFixed(2));
    quote.dayLow = Number(Math.min(quote.dayLow, newPrice).toFixed(2));
    quote.priceINR = quote.currency === "INR" ? newPrice : Number((newPrice * USD_INR_EXCHANGE_RATE).toFixed(2));
    quote.lastUpdated = now;

    // Check buy reminder target trigger
    const watchlistEntry = userWatchlist.get(quote.symbol);
    if (watchlistEntry?.customThresholds?.targetBuyPrice && watchlistEntry.customThresholds.targetBuyActive !== false) {
      const thresh = watchlistEntry.customThresholds;
      const targetCurrency = thresh.targetBuyCurrency || "INR";
      const currentInTarget = targetCurrency === "INR" ? (quote.priceINR || newPrice) : (quote.currency === "USD" ? newPrice : Number((newPrice / USD_INR_EXCHANGE_RATE).toFixed(2)));
      if (currentInTarget <= thresh.targetBuyPrice && !thresh.targetBuyTriggered) {
        thresh.targetBuyTriggered = true;
        thresh.targetBuyTriggeredAt = now;
      }
    }

    // Append to ticks history (maintain max 15 ticks)
    if (Math.random() > 0.5) {
      quote.ticks.push({
        time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: newPrice,
        volume: newVolume
      });
      if (quote.ticks.length > 15) {
        quote.ticks.shift();
      }
    }
  });
}, 3000);

// ==========================================
// API ROUTES
// ==========================================

// 1. Full Market Overview & Intelligence
app.get("/api/market/overview", async (req, res) => {
  try {
    const overview = await assembleMarketOverview();
    res.json(overview);
  } catch (err: any) {
    console.error("Overview error:", err);
    res.status(500).json({ error: "Failed to assemble market intelligence", details: err?.message });
  }
});

// ==========================================
// 1.5 USER AUTHENTICATION, OTP VERIFICATION & PROFILES
// ==========================================
interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordSalt: string;
  passwordHash: string;
  avatarUrl?: string;
  emailVerified: boolean;
  currencyPreference: 'INR' | 'USD';
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  investmentHorizon: 'INTRADAY' | 'SWING' | 'LONG_TERM';
  defaultTargetBuyAlertChannel: 'APP_AND_EMAIL' | 'APP_ONLY';
  growwClientId?: string;
  createdAt: number;
  updatedAt: number;
}

interface PendingOtp {
  email: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}

const usersDb = new Map<string, StoredUser>(); // email (lowercase) -> StoredUser
const activeSessions = new Map<string, string>(); // sessionToken -> userId
const pendingOtps = new Map<string, PendingOtp>(); // email (lowercase) -> PendingOtp
const emailDispatchLogs: EmailDispatchRecord[] = [];

// Helper functions for auth crypto
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

function toUserProfile(user: StoredUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    currencyPreference: user.currencyPreference,
    riskTolerance: user.riskTolerance,
    investmentHorizon: user.investmentHorizon,
    defaultTargetBuyAlertChannel: user.defaultTargetBuyAlertChannel,
    growwClientId: user.growwClientId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

// Helper to get authenticated user from Request
function getSessionUser(req: express.Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (req.headers["x-auth-token"] as string);

  if (!token) return null;
  const userId = activeSessions.get(token);
  if (!userId) return null;

  for (const u of usersDb.values()) {
    if (u.id === userId) return u;
  }
  return null;
}

// Pre-seed a default demo user for frictionless verification
const seedSalt = crypto.randomBytes(16).toString("hex");
const demoUser: StoredUser = {
  id: "usr_demo_1",
  email: "trader@marketradar.io",
  name: "Arjun Mehta",
  passwordSalt: seedSalt,
  passwordHash: hashPassword("password123", seedSalt),
  emailVerified: true,
  currencyPreference: "INR",
  riskTolerance: "MODERATE",
  investmentHorizon: "SWING",
  defaultTargetBuyAlertChannel: "APP_AND_EMAIL",
  growwClientId: "GW_8829104",
  createdAt: Date.now() - 30 * 24 * 3600 * 1000,
  updatedAt: Date.now()
};
usersDb.set(demoUser.email.toLowerCase(), demoUser);

// --- Auth Endpoints ---

// 1. Registration - creates pending user and dispatches 6-digit OTP to email
app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = usersDb.get(normalizedEmail);

  // If already registered and verified
  if (existingUser && existingUser.emailVerified) {
    return res.status(409).json({
      error: "An account with this email already exists. Please log in instead."
    });
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const pwdHash = hashPassword(password, salt);

  const newUser: StoredUser = existingUser || {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalizedEmail,
    name: (name && typeof name === "string" && name.trim()) ? name.trim() : normalizedEmail.split("@")[0],
    passwordSalt: salt,
    passwordHash: pwdHash,
    emailVerified: false,
    currencyPreference: "INR",
    riskTolerance: "MODERATE",
    investmentHorizon: "SWING",
    defaultTargetBuyAlertChannel: "APP_AND_EMAIL",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Update password and details if re-registering unverified account
  newUser.passwordSalt = salt;
  newUser.passwordHash = pwdHash;
  if (name) newUser.name = name.trim();
  newUser.updatedAt = Date.now();
  usersDb.set(normalizedEmail, newUser);

  // Store pending OTP (10 minutes validity)
  pendingOtps.set(normalizedEmail, {
    email: normalizedEmail,
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });

  // Log dispatch to simulated email mailbox
  const dispatchRecord: EmailDispatchRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    subject: "Your Smart Market Watchlist Registration OTP",
    otp,
    sentAt: Date.now(),
    status: "SENT"
  };
  emailDispatchLogs.unshift(dispatchRecord);
  if (emailDispatchLogs.length > 30) emailDispatchLogs.pop();

  console.log(`[AUTH] 📧 Verification OTP [${otp}] dispatched to ${normalizedEmail}`);

  res.json({
    success: true,
    message: `Verification code sent to ${normalizedEmail}. Enter the 6-digit OTP to complete registration.`,
    debugOtp: otp, // For frictionless sandbox testing
    expiresInSeconds: 600
  });
});

// 2. Verify OTP - verifies the 6-digit email code, marks user verified, and logs them in
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and 6-digit OTP are required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingOtps.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({
      error: "No active verification code found for this email. Please request a new OTP."
    });
  }

  if (Date.now() > pending.expiresAt) {
    pendingOtps.delete(normalizedEmail);
    return res.status(400).json({
      error: "Verification code has expired. Please request a new OTP."
    });
  }

  if (pending.otp.trim() !== String(otp).trim()) {
    pending.attempts++;
    if (pending.attempts >= 5) {
      pendingOtps.delete(normalizedEmail);
      return res.status(400).json({
        error: "Too many incorrect attempts. Please request a new OTP code."
      });
    }
    return res.status(400).json({
      error: `Invalid OTP code. Please check the code sent to ${normalizedEmail} and try again.`
    });
  }

  // OTP is valid!
  const user = usersDb.get(normalizedEmail);
  if (!user) {
    return res.status(404).json({ error: "User record not found" });
  }

  user.emailVerified = true;
  user.updatedAt = Date.now();
  pendingOtps.delete(normalizedEmail);

  // Generate authenticated session token
  const sessionToken = crypto.randomBytes(32).toString("hex");
  activeSessions.set(sessionToken, user.id);

  console.log(`[AUTH] ✅ User ${normalizedEmail} verified email with OTP and logged in.`);

  res.json({
    success: true,
    message: "Registration completed successfully! Your email has been verified.",
    token: sessionToken,
    user: toUserProfile(user)
  });
});

// 3. Resend OTP
app.post("/api/auth/resend-otp", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const user = usersDb.get(normalizedEmail);

  if (!user) {
    return res.status(404).json({ error: "No account found with this email. Please register first." });
  }
  if (user.emailVerified) {
    return res.status(400).json({ error: "Your email is already verified. Please log in directly." });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  pendingOtps.set(normalizedEmail, {
    email: normalizedEmail,
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });

  const dispatchRecord: EmailDispatchRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    subject: "Resent: Your Smart Watchlist Verification OTP",
    otp,
    sentAt: Date.now(),
    status: "SENT"
  };
  emailDispatchLogs.unshift(dispatchRecord);

  console.log(`[AUTH] 📧 Resent OTP [${otp}] to ${normalizedEmail}`);

  res.json({
    success: true,
    message: `A fresh 6-digit OTP has been sent to ${normalizedEmail}.`,
    debugOtp: otp,
    expiresInSeconds: 600
  });
});

// 4. Login with Email & Password
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = usersDb.get(normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const computedHash = hashPassword(password, user.passwordSalt);
  if (computedHash !== user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Check email verification
  if (!user.emailVerified) {
    // Generate new OTP so user can finish registration
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingOtps.set(normalizedEmail, {
      email: normalizedEmail,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });
    return res.status(403).json({
      error: "Email verification required. We have dispatched a new 6-digit OTP to your mail.",
      requiresOtp: true,
      email: normalizedEmail,
      debugOtp: otp
    });
  }

  // Create session
  const sessionToken = crypto.randomBytes(32).toString("hex");
  activeSessions.set(sessionToken, user.id);

  console.log(`[AUTH] 🔑 User ${normalizedEmail} logged in successfully.`);

  res.json({
    success: true,
    message: "Logged in successfully",
    token: sessionToken,
    user: toUserProfile(user)
  });
});

// 5. Get Current User Profile (Active Session)
app.get("/api/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated", authenticated: false });
  }
  res.json({
    success: true,
    authenticated: true,
    user: toUserProfile(user)
  });
});

// 6. Update User Profile
app.put("/api/auth/profile", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required to update profile" });
  }

  const {
    name,
    avatarUrl,
    currencyPreference,
    riskTolerance,
    investmentHorizon,
    defaultTargetBuyAlertChannel,
    growwClientId
  } = req.body;

  if (name && typeof name === "string" && name.trim().length > 0) {
    user.name = name.trim();
  }
  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl;
  }
  if (currencyPreference === "INR" || currencyPreference === "USD") {
    user.currencyPreference = currencyPreference;
  }
  if (riskTolerance && ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"].includes(riskTolerance)) {
    user.riskTolerance = riskTolerance;
  }
  if (investmentHorizon && ["INTRADAY", "SWING", "LONG_TERM"].includes(investmentHorizon)) {
    user.investmentHorizon = investmentHorizon;
  }
  if (defaultTargetBuyAlertChannel && ["APP_AND_EMAIL", "APP_ONLY"].includes(defaultTargetBuyAlertChannel)) {
    user.defaultTargetBuyAlertChannel = defaultTargetBuyAlertChannel;
  }
  if (growwClientId !== undefined) {
    user.growwClientId = typeof growwClientId === "string" ? growwClientId.trim() : undefined;
  }

  user.updatedAt = Date.now();

  console.log(`[AUTH] 👤 Updated profile for user ${user.email}`);

  res.json({
    success: true,
    message: "Profile updated successfully",
    user: toUserProfile(user)
  });
});

// 7. Logout
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (req.headers["x-auth-token"] as string);

  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// 8. Debug / Dev Mailbox - List latest dispatched OTPs
app.get("/api/auth/debug/recent-otps", (req, res) => {
  res.json({
    recentDispatches: emailDispatchLogs.slice(0, 10),
    activePendingCount: pendingOtps.size
  });
});

// 2. Watchlist Management
app.get("/api/watchlist", (req, res) => {
  res.json(Array.from(userWatchlist.values()));
});

app.post("/api/watchlist", (req, res) => {
  const { symbol, customThresholds, userNotes, tags } = req.body;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Valid symbol required" });
  }
  const cleanSymbol = symbol.toUpperCase().trim();

  // If not in liveQuotes, create dynamic quote
  if (!liveQuotes.has(cleanSymbol)) {
    const defaultPrice = 100.00;
    liveQuotes.set(cleanSymbol, {
      symbol: cleanSymbol,
      name: `${cleanSymbol} Asset`,
      sector: "General / Other",
      price: defaultPrice,
      change: 0,
      changePct: 0,
      volume: 1_000_000,
      avgVolume: 1_000_000,
      volatility: 22.0,
      dayHigh: defaultPrice,
      dayLow: defaultPrice,
      high52: defaultPrice * 1.3,
      low52: defaultPrice * 0.7,
      lastUpdated: Date.now(),
      ticks: [{ time: "09:30", price: defaultPrice, volume: 100_000 }]
    });

    // Also register in baseline snapshot
    activeBaseline.quotes[cleanSymbol] = {
      price: defaultPrice,
      volume: 500_000,
      volatility: 22.0,
      timestamp: activeBaseline.timestamp
    };
  }

  const record: WatchlistRecord = {
    symbol: cleanSymbol,
    addedAt: Date.now(),
    customThresholds: customThresholds || { priceChangePct: 2.5, volumeMultiplier: 1.6, volatilityJumpPct: 20 },
    userNotes: userNotes || "",
    tags: tags || ["CUSTOM"]
  };

  userWatchlist.set(cleanSymbol, record);
  res.json({ success: true, item: record });
});

app.delete("/api/watchlist/:symbol", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existed = userWatchlist.delete(cleanSymbol);
  res.json({ success: existed, symbol: cleanSymbol });
});

app.put("/api/watchlist/:symbol/threshold", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) {
    return res.status(404).json({ error: "Symbol not in watchlist" });
  }

  existing.customThresholds = {
    ...existing.customThresholds,
    ...req.body
  };
  if (req.body.userNotes !== undefined) existing.userNotes = req.body.userNotes;
  if (req.body.tags !== undefined) existing.tags = req.body.tags;

  res.json({ success: true, item: existing });
});

// Buy Target Reminder Specific Endpoints
app.post("/api/watchlist/:symbol/buy-reminder", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) {
    return res.status(404).json({ error: "Symbol not in watchlist" });
  }

  const { targetBuyPrice, targetBuyCurrency = "INR", targetBuyNote } = req.body;
  if (!targetBuyPrice || isNaN(Number(targetBuyPrice)) || Number(targetBuyPrice) <= 0) {
    return res.status(400).json({ error: "Valid positive targetBuyPrice is required" });
  }

  const quote = liveQuotes.get(cleanSymbol);
  const targetCurrency = targetBuyCurrency === "USD" ? "USD" : "INR";
  const currentInTarget = quote
    ? (targetCurrency === "INR"
        ? (quote.priceINR || (quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2))))
        : (quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2))))
    : Number(targetBuyPrice);

  const isAlreadyTriggered = currentInTarget <= Number(targetBuyPrice);

  existing.customThresholds = {
    ...existing.customThresholds,
    targetBuyPrice: Number(targetBuyPrice),
    targetBuyCurrency: targetCurrency,
    targetBuyActive: true,
    targetBuyTriggered: isAlreadyTriggered,
    targetBuyTriggeredAt: isAlreadyTriggered ? Date.now() : undefined,
    targetBuyNote: targetBuyNote || `Buy reminder target set at ${targetCurrency === "INR" ? "₹" : "$"}${Number(targetBuyPrice).toLocaleString()}`
  };

  res.json({ success: true, item: existing });
});

app.post("/api/watchlist/:symbol/buy-reminder/dismiss", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });

  if (existing.customThresholds) {
    existing.customThresholds.targetBuyTriggered = false;
  }
  res.json({ success: true, item: existing });
});

app.delete("/api/watchlist/:symbol/buy-reminder", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });

  if (existing.customThresholds) {
    delete existing.customThresholds.targetBuyPrice;
    delete existing.customThresholds.targetBuyCurrency;
    delete existing.customThresholds.targetBuyActive;
    delete existing.customThresholds.targetBuyTriggered;
    delete existing.customThresholds.targetBuyTriggeredAt;
    delete existing.customThresholds.targetBuyNote;
  }
  res.json({ success: true, item: existing });
});

// 3. Memory & Snapshot Management
app.post("/api/memory/snapshot", (req, res) => {
  const { label, description } = req.body;
  const now = Date.now();

  const snapshotQuotes: Record<string, { price: number; volume: number; volatility: number; timestamp: number }> = {};
  liveQuotes.forEach((quote, sym) => {
    snapshotQuotes[sym] = {
      price: quote.price,
      volume: quote.volume,
      volatility: quote.volatility,
      timestamp: now
    };
  });

  const newSnapshot: MemoryBaselineSnapshot = {
    id: `snap_${now}`,
    timestamp: now,
    label: label || `Manual Checkpoint (${new Date(now).toLocaleTimeString()})`,
    description: description || "User reviewed market changes and reset the baseline reference point.",
    quotes: snapshotQuotes
  };

  activeBaseline = newSnapshot;
  savedSnapshots.unshift(newSnapshot);
  if (savedSnapshots.length > 10) savedSnapshots.pop();

  res.json({ success: true, snapshot: newSnapshot });
});

// Support both switch-baseline and select-baseline paths
const handleBaselineSelect = (req: express.Request, res: express.Response) => {
  const { snapshotId, offsetHours } = req.body;
  const now = Date.now();

  if (offsetHours !== undefined && typeof offsetHours === "number") {
    // Generate a synthetic past baseline e.g. 1h, 4h, 24h ago
    const simulatedTs = now - (offsetHours * 3600 * 1000);
    const syntheticQuotes: Record<string, { price: number; volume: number; volatility: number; timestamp: number }> = {};

    liveQuotes.forEach((quote, sym) => {
      // Create price variance depending on elapsed time
      const variance = (Math.random() - 0.5) * 0.05 * (offsetHours / 2);
      syntheticQuotes[sym] = {
        price: Number((quote.price * (1 - variance)).toFixed(2)),
        volume: Math.round(quote.volume * Math.max(0.2, 1 - (offsetHours * 0.15))),
        volatility: Number(Math.max(10, quote.volatility - (offsetHours * 2)).toFixed(1)),
        timestamp: simulatedTs
      };
    });

    const newBaseline: MemoryBaselineSnapshot = {
      id: `snap_offset_${offsetHours}h_${now}`,
      timestamp: simulatedTs,
      label: `Simulated: ${offsetHours} Hours Ago`,
      description: `Fast-forward time displacement: see what changed since ${offsetHours} hours ago.`,
      quotes: syntheticQuotes
    };

    activeBaseline = newBaseline;
    savedSnapshots.unshift(newBaseline);
    return res.json({ success: true, baseline: newBaseline });
  }

  if (snapshotId) {
    const found = savedSnapshots.find(s => s.id === snapshotId);
    if (found) {
      activeBaseline = found;
      return res.json({ success: true, baseline: found });
    }
  }

  res.status(400).json({ error: "Invalid snapshot reference or offset" });
};

app.post("/api/memory/switch-baseline", handleBaselineSelect);
app.post("/api/memory/select-baseline", handleBaselineSelect);

// 4. Market Simulation / Scenario Triggers (support both /api/market/simulate and /api/simulation/scenario)
const handleSimulationTrigger = (req: express.Request, res: express.Response) => {
  const { scenario } = req.body;
  const now = Date.now();

  if (scenario === "TECH_SECTOR_RALLY") {
    // Surge semiconductors & cloud
    liveQuotes.forEach(q => {
      if (q.sector === "Semiconductors" || q.sector === "Cloud/Software") {
        const bump = 1 + (0.025 + Math.random() * 0.035);
        q.price = Number((q.price * bump).toFixed(2));
        q.changePct = Number((q.changePct + (bump - 1) * 100).toFixed(2));
        q.volume = Math.round(q.volume * 1.85);
        q.volatility += 6.5;
        q.dayHigh = Math.max(q.dayHigh, q.price);
      }
    });

    const semiEvent: MarketEvent = {
      id: `evt_sim_semi_${now}`,
      symbol: "SEMIS_INDEX",
      sector: "Semiconductors",
      scope: "SECTOR_WIDE",
      title: "Coordinated AI Hardware Supply Shock Rally",
      summary: "Semiconductor basket exploded +4.2% on aggressive institutional sweep orders.",
      currentState: "ESCALATED",
      severity: "CRITICAL",
      detectedAt: now,
      lastTransitionAt: now,
      peakDeviationPct: 4.6,
      currentDeviationPct: 4.2,
      volumeMultiple: 2.3,
      signalsInvolved: ["SECTOR_CORRELATION", "PRICE_MOVE", "VOLUME_SPIKE"],
      stateHistory: [
        { state: "DEVELOPING", timestamp: now - 60000, metricSummary: "+1.9% at 1.4x vol", reason: "Order flow clustering" },
        { state: "ESCALATED", timestamp: now, metricSummary: "+4.6% breakout at 2.3x vol", reason: "Major ETF rebalancing in hardware" }
      ]
    };
    activeEvents.set(semiEvent.id, semiEvent);
  } else if (scenario === "ENERGY_PULLBACK") {
    // Energy drop
    liveQuotes.forEach(q => {
      if (q.sector === "Energy") {
        const drop = 1 - (0.028 + Math.random() * 0.02);
        q.price = Number((q.price * drop).toFixed(2));
        q.changePct = Number((q.changePct - (1 - drop) * 100).toFixed(2));
        q.volume = Math.round(q.volume * 1.5);
        q.dayLow = Math.min(q.dayLow, q.price);
      }
    });
  } else if (scenario === "NVDA_BREAKOUT") {
    const nvda = liveQuotes.get("NVDA");
    if (nvda) {
      nvda.price = Number((nvda.price * 1.058).toFixed(2));
      nvda.changePct += 5.8;
      nvda.volume = Math.round(nvda.avgVolume * 2.8);
      nvda.volatility += 12;
      nvda.dayHigh = Math.max(nvda.dayHigh, nvda.price);
    }
  } else if (scenario === "RESOLVE_EVENTS") {
    activeEvents.forEach(evt => {
      evt.currentState = "RESOLVED";
      evt.lastTransitionAt = now;
      evt.stateHistory.push({
        state: "RESOLVED",
        timestamp: now,
        metricSummary: "Spreads normalized back to median range",
        reason: "Trader initiated manual event resolution cycle"
      });
    });
  } else if (scenario === "FEED_ARBITRAGE_CONFLICT") {
    conflictsResolvedCounter += 4;
    feedStatus = "CONFLICT_RESOLVED";
    feedLatency = 85;
    setTimeout(() => {
      feedStatus = "LIVE";
      feedLatency = 24;
    }, 5000);
  }

  res.json({ success: true, scenarioApplied: scenario, timestamp: now });
};

app.post("/api/market/simulate", handleSimulationTrigger);
app.post("/api/simulation/scenario", handleSimulationTrigger);

// 5. Broker API Connectors (Groww / Indian Brokerage Gateway)
interface BrokerConfig {
  provider: 'groww' | 'zerodha' | 'angelone' | 'upstox';
  connected: boolean;
  accountName?: string;
  clientId?: string;
  mode: 'SANDBOX' | 'LIVE';
  supportedFeatures: string[];
  instructions: string;
}

let brokerState: BrokerConfig = {
  provider: 'groww',
  connected: false,
  mode: 'SANDBOX',
  supportedFeatures: [
    'Real-time NSE/BSE tick feeds',
    'Limit & Market order placement when Buy Target is reached',
    'Watchlist sync with Groww terminal',
    'Sector allocation portfolio import'
  ],
  instructions: 'Groww allows connecting via personal authentication tokens or Webhook alerts. For automated Indian broker execution (NSE/BSE), set GROWW_API_TOKEN or configure Zerodha Kite Connect / Angel One SmartAPI in environment variables.'
};

app.get("/api/broker/groww", (req, res) => {
  res.json({
    ...brokerState,
    activeBuyRemindersCount: Array.from(userWatchlist.values()).filter(w => w.customThresholds?.targetBuyPrice).length,
    timestamp: Date.now()
  });
});

app.post("/api/broker/groww/connect", (req, res) => {
  const { apiKey, clientId, accountName } = req.body;
  brokerState = {
    ...brokerState,
    connected: true,
    clientId: clientId || 'GW_8829104',
    accountName: accountName || 'Primary Trading Account (Groww)',
    mode: apiKey ? 'LIVE' : 'SANDBOX'
  };
  res.json({ success: true, message: 'Connected to Groww Brokerage Bridge', broker: brokerState });
});

// 6. System Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    terminalEngine: "Smart Market Watchlist v2.4",
    uptimeSeconds: Math.floor(process.uptime()),
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY)
  });
});

// Explicit 404 for unhandled API endpoints so they never return HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ==========================================
// VITE MIDDLEWARE / STATIC ASSETS
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TERMINAL] Server initialized on http://0.0.0.0:${PORT}`);
  });
}

startServer();
