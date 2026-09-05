/**
 * watchlistRouter.ts
 * CRUD for /api/watchlist and buy-reminder sub-resources.
 * In-memory userWatchlist is the hot read path; alert rules are persisted to SQLite.
 */

import { Router } from "express";
import { Request } from "express";
import { liveQuotes, userWatchlist, activeBaseline } from "../state/marketState.ts";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";
import { WatchlistRecord } from "../../src/types/market.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

const router = Router();

const getUserId = (req: Request) => req.userId || "usr_demo_1";

// GET /api/watchlist
router.get("/", (_req, res) => {
  res.json(Array.from(userWatchlist.values()));
});

// POST /api/watchlist — add stock
router.post("/", (req, res) => {
  const { symbol, customThresholds, userNotes, tags } = req.body;
  if (!symbol || typeof symbol !== "string") return res.status(400).json({ error: "Valid symbol required" });

  const cleanSymbol = symbol.toUpperCase().trim();

  if (!liveQuotes.has(cleanSymbol)) {
    const defaultPrice = 100.0;
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
      ticks: [{ time: "09:30", price: defaultPrice, volume: 100_000 }],
    });
    if (activeBaseline) {
      activeBaseline.quotes[cleanSymbol] = { price: defaultPrice, volume: 500_000, volatility: 22.0, timestamp: activeBaseline.timestamp };
    }
  }

  const record: WatchlistRecord = {
    symbol: cleanSymbol,
    addedAt: Date.now(),
    customThresholds: customThresholds || { priceChangePct: 2.5, volumeMultiplier: 1.6, volatilityJumpPct: 20 },
    userNotes: userNotes || "",
    tags: tags || ["CUSTOM"],
  };
  userWatchlist.set(cleanSymbol, record);
  res.json({ success: true, item: record });
});

// DELETE /api/watchlist/:symbol
router.delete("/:symbol", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existed = userWatchlist.delete(cleanSymbol);
  res.json({ success: existed, symbol: cleanSymbol });
});

// PUT /api/watchlist/:symbol/threshold — update custom thresholds
router.put("/:symbol/threshold", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });

  const { targetBuyPrice, targetBuyCurrency } = req.body;
  if (targetBuyPrice !== undefined) {
    const numPrice = Number(targetBuyPrice);
    if (isNaN(numPrice) || numPrice <= 0) return res.status(400).json({ error: "Target price must be a valid positive number" });
  }

  let deviationWarning: string | undefined;
  if (targetBuyPrice !== undefined && Number(targetBuyPrice) > 0) {
    const quote = liveQuotes.get(cleanSymbol);
    const targetCurr = targetBuyCurrency || existing.customThresholds.targetBuyCurrency || "INR";
    const currentInTarget = quote
      ? targetCurr === "INR"
        ? quote.priceINR || (quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2)))
        : quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2))
      : Number(targetBuyPrice);
    const distancePct = (Math.abs(currentInTarget - Number(targetBuyPrice)) / (currentInTarget || 1)) * 100;
    if (distancePct > 30) {
      deviationWarning = `Target price is ${distancePct.toFixed(1)}% away from current spot price. Please verify.`;
    }
  }

  existing.customThresholds = { ...existing.customThresholds, ...req.body };
  if (req.body.userNotes !== undefined) existing.userNotes = req.body.userNotes;
  if (req.body.tags !== undefined) existing.tags = req.body.tags;

  res.json({ success: true, item: existing, warning: deviationWarning });
});

// POST /api/watchlist/:symbol/buy-reminder — set buy reminder
router.post("/:symbol/buy-reminder", async (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });

  const { targetBuyPrice, targetBuyCurrency = "INR", targetBuyNote, targetType, hysteresisBufferPct = 0.5, cooldownMinutes = 30 } = req.body;

  if (!targetBuyPrice || isNaN(Number(targetBuyPrice)) || Number(targetBuyPrice) <= 0) {
    return res.status(400).json({ error: "Valid positive targetBuyPrice is required" });
  }

  const quote = liveQuotes.get(cleanSymbol);
  const targetCurrency = targetBuyCurrency === "USD" ? "USD" : "INR";
  const currentInTarget = quote
    ? targetCurrency === "INR"
      ? quote.priceINR || (quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2)))
      : quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2))
    : Number(targetBuyPrice);

  const numTarget = Number(targetBuyPrice);
  const mode: "DIP_BUY" | "BREAKOUT_BUY" = targetType || (numTarget <= currentInTarget ? "DIP_BUY" : "BREAKOUT_BUY");
  const isAlreadyTriggered = mode === "DIP_BUY" ? currentInTarget <= numTarget : currentInTarget >= numTarget;

  const distancePct = (Math.abs(currentInTarget - numTarget) / (currentInTarget || 1)) * 100;
  const deviationWarning = distancePct > 30 ? `Target price is ${distancePct.toFixed(1)}% away from current spot price. Please verify.` : undefined;

  existing.customThresholds = {
    ...existing.customThresholds,
    targetBuyPrice: numTarget,
    targetBuyCurrency: targetCurrency,
    targetType: mode,
    targetBuyActive: true,
    targetBuyTriggered: isAlreadyTriggered,
    targetBuyTriggeredAt: isAlreadyTriggered ? Date.now() : undefined,
    targetBuyNote: targetBuyNote || `${mode === "BREAKOUT_BUY" ? "Breakout" : "Dip buy"} target at ${targetCurrency === "INR" ? "₹" : "$"}${numTarget.toLocaleString()}`,
    hysteresisBufferPct: Number(hysteresisBufferPct) || 0.5,
    cooldownMinutes: Number(cooldownMinutes) || 30,
    lastAlertDispatchedAt: isAlreadyTriggered ? Date.now() : undefined,
    lastAlertPrice: isAlreadyTriggered ? currentInTarget : undefined,
    suppressedOscillationsCount: (existing.customThresholds?.suppressedOscillationsCount as number) || 0,
  };

  const userId = getUserId(req);
  await marketRepository.saveAlertRule({
    id: `rule_${cleanSymbol}_${Date.now()}`,
    userId,
    symbol: cleanSymbol,
    targetBuyPrice: numTarget,
    targetBuyCurrency: targetCurrency as "INR" | "USD",
    targetType: mode,
    targetBuyActive: true,
    targetBuyTriggered: isAlreadyTriggered,
    targetBuyTriggeredAt: isAlreadyTriggered ? Date.now() : undefined,
    targetBuyNote: existing.customThresholds.targetBuyNote as string,
    priceShiftThreshold: (existing.customThresholds.priceChangePct as number) || 2.5,
    volumeSpikeThreshold: (existing.customThresholds.volumeMultiplier as number) || 1.6,
    hysteresisBandPct: Number(hysteresisBufferPct) || 0.5,
    cooldownMinutes: Number(cooldownMinutes) || 30,
    lastTriggeredAt: isAlreadyTriggered ? Date.now() : undefined,
    lastTriggeredPrice: isAlreadyTriggered ? currentInTarget : undefined,
    suppressedOscillationsCount: (existing.customThresholds?.suppressedOscillationsCount as number) || 0,
  }).catch(() => {});

  res.json({ success: true, item: existing, warning: deviationWarning });
});

// POST /api/watchlist/:symbol/buy-reminder/dismiss
router.post("/:symbol/buy-reminder/dismiss", async (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });

  if (existing.customThresholds) {
    existing.customThresholds.targetBuyTriggered = false;
    const userId = getUserId(req);
    const rule = await marketRepository.getAlertRule(userId, cleanSymbol).catch(() => null);
    if (rule) {
      rule.targetBuyTriggered = false;
      await marketRepository.saveAlertRule(rule).catch(() => {});
    }
  }
  res.json({ success: true, item: existing });
});

// DELETE /api/watchlist/:symbol/buy-reminder
router.delete("/:symbol/buy-reminder", async (req, res) => {
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
    const userId = getUserId(req);
    await marketRepository.deleteAlertRule(userId, cleanSymbol).catch(() => {});
  }
  res.json({ success: true, item: existing });
});

export default router;
