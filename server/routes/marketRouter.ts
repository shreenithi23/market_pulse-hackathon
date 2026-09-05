/**
 * marketRouter.ts
 * GET  /api/market/overview          — full intelligence snapshot
 * POST /api/market/simulate          — scenario injection
 * POST /api/simulation/scenario      — alias for above
 */

import { Router, Request, Response } from "express";
import { assembleMarketOverview } from "../services/briefingEngine.ts";
import {
  liveQuotes,
  userWatchlist,
  activeEvents,
  setFeedStatus,
  incrementConflicts,
} from "../state/marketState.ts";
import { MarketEvent } from "../../src/types/market.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

const router = Router();

// GET /api/market/overview
router.get("/overview", async (_req, res) => {
  try {
    const overview = await assembleMarketOverview();
    res.json(overview);
  } catch (err: any) {
    console.error("[MARKET] Overview error:", err);
    res.status(500).json({ error: "Failed to assemble market intelligence", details: err?.message });
  }
});

// Shared simulation handler
const handleSimulationTrigger = (req: Request, res: Response) => {
  const { scenario } = req.body;
  const now = Date.now();

  if (scenario === "TECH_SECTOR_RALLY") {
    liveQuotes.forEach((q) => {
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
        { state: "ESCALATED", timestamp: now, metricSummary: "+4.6% breakout at 2.3x vol", reason: "Major ETF rebalancing in hardware" },
      ],
    };
    activeEvents.set(semiEvent.id, semiEvent);

  } else if (scenario === "ENERGY_PULLBACK") {
    liveQuotes.forEach((q) => {
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
    activeEvents.forEach((evt) => {
      evt.currentState = "RESOLVED";
      evt.lastTransitionAt = now;
      evt.stateHistory.push({ state: "RESOLVED", timestamp: now, metricSummary: "Spreads normalized back to median range", reason: "Trader initiated manual event resolution cycle" });
    });

  } else if (scenario === "FEED_ARBITRAGE_CONFLICT") {
    incrementConflicts(4);
    setFeedStatus("CONFLICT_RESOLVED", 85);
    setTimeout(() => setFeedStatus("LIVE", 24), 5000);

  } else if (scenario === "FLASH_CRASH_SWEEP") {
    const q = liveQuotes.get("NVDA") || Array.from(liveQuotes.values())[0];
    if (q) {
      const preDropPrice = q.price;
      const troughPrice = Number((preDropPrice * 0.918).toFixed(2));
      q.price = troughPrice;
      q.change = Number((q.change - (preDropPrice - troughPrice)).toFixed(2));
      q.changePct = Number((q.changePct - 8.2).toFixed(2));
      q.volume = Math.round(q.volume * 2.8);
      q.volatility += 14.5;
      q.dayLow = Math.min(q.dayLow, troughPrice);
      q.ticks.push({ time: new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), price: troughPrice, volume: q.volume });

      (q as any).liquiditySweep = {
        detected: true,
        dropPct: -8.2,
        troughPrice,
        preDropPrice,
        durationSeconds: 45,
        recoveredAt: 0,
        baselinePreserved: true,
        notes: `Flash crash liquidity air-pocket absorbed within 45s. V-Shape mean-reversion confirmed. Memory baseline preserved at $${preDropPrice.toFixed(2)}.`,
      };

      const sweepEvt: MarketEvent = {
        id: `evt_sweep_${q.symbol}_${now}`,
        symbol: q.symbol,
        sector: q.sector,
        scope: "STOCK_SPECIFIC",
        title: `⚡ Flash Crash Liquidity Sweep: ${q.symbol} -8.2% V-Reversal`,
        summary: `Instant liquidity hole dumped ${q.symbol} to $${troughPrice.toFixed(2)}. Algorithmic V-pattern detected; memory baseline anchor strictly preserved.`,
        currentState: "RECOVERING",
        severity: "CRITICAL",
        detectedAt: now,
        lastTransitionAt: now,
        peakDeviationPct: -8.2,
        currentDeviationPct: -8.2,
        volumeMultiple: 2.8,
        signalsInvolved: ["PRICE_MOVE", "VOLUME_SPIKE", "VOLATILITY_EXPANSION"],
        stateHistory: [
          { state: "DEVELOPING", timestamp: now - 30000, metricSummary: "-2.1% rapid print", reason: "Order book liquidity gap" },
          { state: "ESCALATED", timestamp: now - 15000, metricSummary: "-8.2% flash trough", reason: "Stop loss cascade" },
          { state: "RECOVERING", timestamp: now, metricSummary: "Rapid bid replenishment", reason: "V-Shape Mean Reversion confirmed. Baseline intact." },
        ],
      };
      activeEvents.set(sweepEvt.id, sweepEvt);

      // Auto V-shape rebound after 4.5s
      setTimeout(() => {
        const recoverQ = liveQuotes.get(q.symbol);
        if (recoverQ) {
          recoverQ.price = Number((preDropPrice * 0.996).toFixed(2));
          recoverQ.change = Number((recoverQ.price - preDropPrice).toFixed(2));
          recoverQ.changePct = Number((recoverQ.changePct + 8.0).toFixed(2));
          recoverQ.dayHigh = Math.max(recoverQ.dayHigh, recoverQ.price);
          recoverQ.ticks.push({ time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), price: recoverQ.price, volume: Math.round(recoverQ.volume * 1.2) });
          if ((recoverQ as any).liquiditySweep) (recoverQ as any).liquiditySweep.recoveredAt = Date.now();
          const evt = activeEvents.get(sweepEvt.id);
          if (evt) {
            evt.currentState = "RESOLVED";
            evt.currentDeviationPct = -0.4;
            evt.stateHistory.push({ state: "RESOLVED", timestamp: Date.now(), metricSummary: "Fully recovered to pre-flash price (-0.4%)", reason: "V-shape bounce verified. Memory baseline remained undisturbed." });
          }
        }
      }, 4500);
    }

  } else if (scenario === "TARGET_WHIPSAW_HOVER") {
    let targetSym = "TCS";
    let entry = userWatchlist.get(targetSym);
    if (!entry) {
      const first = Array.from(userWatchlist.values())[0];
      targetSym = first?.symbol || "NVDA";
      entry = first;
    }
    const q = liveQuotes.get(targetSym);
    if (q && entry) {
      const currentInINR = q.priceINR || (q.currency === "INR" ? q.price : Math.round(q.price * USD_INR_EXCHANGE_RATE));
      entry.customThresholds.targetBuyPrice = Math.round(currentInINR);
      entry.customThresholds.targetBuyActive = true;
      entry.customThresholds.targetType = "DIP_BUY";
      entry.customThresholds.hysteresisBufferPct = 0.5;
      entry.customThresholds.cooldownMinutes = 30;
      entry.customThresholds.targetBuyTriggered = true;
      entry.customThresholds.lastAlertDispatchedAt = Date.now() - 60000;
      entry.customThresholds.lastAlertPrice = currentInINR;
      entry.customThresholds.suppressedOscillationsCount = ((entry.customThresholds.suppressedOscillationsCount as number) || 0) + 14;
      q.priceINR = Math.round(currentInINR * 1.002);
      q.price = q.currency === "INR" ? q.priceINR : Number((q.priceINR / USD_INR_EXCHANGE_RATE).toFixed(2));
    }
  }

  res.json({ success: true, scenarioApplied: scenario, timestamp: now });
};

router.post("/simulate", handleSimulationTrigger);

export default router;
