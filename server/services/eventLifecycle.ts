/**
 * eventLifecycle.ts
 * Market event state machine: DEVELOPING → ESCALATED → RECOVERING → RESOLVED
 * and initial seed event factory.
 */

import { MarketEvent } from "../../src/types/market.ts";
import { liveQuotes, activeBaseline, activeEvents } from "../state/marketState.ts";

// ---------------------------------------------------------------------------
// Seed the three default demo events on startup
// ---------------------------------------------------------------------------
export function seedInitialEvents(baselineTs: number, now: number) {
  // NVDA Breakout (Escalated)
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
      { state: "ESCALATED", timestamp: now - 20 * 60 * 1000, metricSummary: "+5.2% peak at 2.4x vol", reason: "Breached user defined 3.0% threshold and $126 resistance" },
    ],
  };

  // Sector-wide Semis event (Developing)
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
      { state: "DEVELOPING", timestamp: baselineTs + 90 * 60 * 1000, metricSummary: "Avg sector delta +2.8%", reason: "7 of 8 tracked hardware names advancing in tandem" },
    ],
  };

  // TSLA Recovery (Recovering)
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
      { state: "RECOVERING", timestamp: now - 15 * 60 * 1000, metricSummary: "-1.2% rebounding to $218.40", reason: "Dip buyers absorbing liquidity at 200 EMA" },
    ],
  };

  activeEvents.set(nvdaEvent.id, nvdaEvent);
  activeEvents.set(semiEvent.id, semiEvent);
  activeEvents.set(tslaEvent.id, tslaEvent);
}

// ---------------------------------------------------------------------------
// Per-tick lifecycle state machine
// ---------------------------------------------------------------------------
export function updateEventLifecycle(now: number) {
  activeEvents.forEach((evt) => {
    const quote = liveQuotes.get(evt.symbol);
    if (!quote) return;

    const baseline = activeBaseline?.quotes[evt.symbol];
    if (!baseline) return;

    const deltaPct = Number((((quote.price - baseline.price) / baseline.price) * 100).toFixed(2));
    evt.currentDeviationPct = deltaPct;
    if (Math.abs(deltaPct) > Math.abs(evt.peakDeviationPct)) {
      evt.peakDeviationPct = deltaPct;
    }
    evt.volumeMultiple = Number((quote.volume / quote.avgVolume).toFixed(2));

    const timeInCurrentState = now - evt.lastTransitionAt;

    if (evt.currentState === "DEVELOPING") {
      if (Math.abs(deltaPct) >= 3.0 || evt.volumeMultiple >= 2.0) {
        evt.currentState = "ESCALATED";
        evt.severity = "CRITICAL";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "ESCALATED",
          timestamp: now,
          metricSummary: `Deviation amplified to ${deltaPct > 0 ? "+" : ""}${deltaPct}% at ${evt.volumeMultiple}x volume`,
          reason: "Signal intensity crossed secondary threshold; momentum expanded",
        });
      }
    } else if (evt.currentState === "ESCALATED") {
      const revertedPct = Math.abs(evt.peakDeviationPct) - Math.abs(deltaPct);
      if (revertedPct >= Math.abs(evt.peakDeviationPct) * 0.35 && timeInCurrentState > 60_000) {
        evt.currentState = "RECOVERING";
        evt.severity = "MEDIUM";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "RECOVERING",
          timestamp: now,
          metricSummary: `Price retraced to ${deltaPct > 0 ? "+" : ""}${deltaPct}% (Peak was ${evt.peakDeviationPct > 0 ? "+" : ""}${evt.peakDeviationPct}%)`,
          reason: "Impulse fading; order flow rebalancing towards median",
        });
      }
    } else if (evt.currentState === "RECOVERING") {
      if (Math.abs(deltaPct) <= 0.8 || timeInCurrentState > 300_000) {
        evt.currentState = "RESOLVED";
        evt.severity = "LOW";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "RESOLVED",
          timestamp: now,
          metricSummary: `Variance compressed to ${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
          reason: "Event normalized; standard liquidity equilibrium restored",
        });
      }
    }
  });
}
