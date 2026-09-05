/**
 * marketIntelligence.ts
 * Core signal detection pipeline:
 *   - Sector movement analysis
 *   - Multi-signal attention score engine (with hysteresis buy-target guards)
 *   - Dynamic cluster groups
 *   - Event compression / deduplication
 */

import {
  StockQuote,
  AttentionScoreData,
  MarketSignal,
  ExplainableRationale,
  AttentionCategory,
  SectorMovement,
  CompressedInsight,
  DynamicGroup,
  MarketEvent,
} from "../../src/types/market.ts";
import { liveQuotes, userWatchlist, activeBaseline, activeEvents } from "../state/marketState.ts";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

// ---------------------------------------------------------------------------
// 1. Sector Movement Analysis
// ---------------------------------------------------------------------------
export function calculateSectorMovements(): SectorMovement[] {
  const sectorsMap = new Map<
    string,
    { totalPct: number; advancers: number; decliners: number; count: number; totalVolRatio: number }
  >();

  liveQuotes.forEach((quote) => {
    const s = quote.sector;
    if (!sectorsMap.has(s)) {
      sectorsMap.set(s, { totalPct: 0, advancers: 0, decliners: 0, count: 0, totalVolRatio: 0 });
    }
    const data = sectorsMap.get(s)!;
    data.totalPct += quote.changePct;
    data.count += 1;
    data.totalVolRatio += quote.volume / quote.avgVolume;
    if (quote.changePct > 0.3) data.advancers += 1;
    else if (quote.changePct < -0.3) data.decliners += 1;
  });

  const movements: SectorMovement[] = [];
  sectorsMap.forEach((v, sector) => {
    const avgChangePct = Number((v.totalPct / v.count).toFixed(2));
    const volumeMultiplier = Number((v.totalVolRatio / v.count).toFixed(2));
    const correlationScore = Number((Math.max(v.advancers, v.decliners) / v.count).toFixed(2));

    movements.push({
      sector,
      avgChangePct,
      advancersCount: v.advancers,
      declinersCount: v.decliners,
      totalStocks: v.count,
      volumeMultiplier,
      isCorrelatedSurge: avgChangePct >= 2.0 && correlationScore >= 0.75,
      isCorrelatedDrop: avgChangePct <= -2.0 && correlationScore >= 0.75,
      correlationScore,
    });
  });

  return movements.sort((a, b) => Math.abs(b.avgChangePct) - Math.abs(a.avgChangePct));
}

// ---------------------------------------------------------------------------
// 2. Multi-Signal Attention Score (with anti-whipsaw hysteresis)
// ---------------------------------------------------------------------------
export function calculateAttentionScore(
  symbol: string,
  sectorMovements: SectorMovement[]
): AttentionScoreData {
  const quote = liveQuotes.get(symbol);
  if (!quote) {
    return {
      symbol,
      totalScore: 0,
      category: "NO_MEANINGFUL_CHANGE",
      urgencyRank: 99,
      signals: [],
      rationales: [],
      primaryDriver: "No quote data available",
    };
  }

  const baseline = activeBaseline?.quotes[symbol] || {
    price: quote.price,
    volume: quote.avgVolume * 0.5,
    volatility: quote.volatility,
    timestamp: activeBaseline?.timestamp ?? Date.now(),
  };

  const watchlistEntry = userWatchlist.get(symbol);
  const thresholds = watchlistEntry?.customThresholds || {};
  const userPriceThreshold = (thresholds.priceChangePct as number) ?? 2.5;
  const userVolThreshold = (thresholds.volumeMultiplier as number) ?? 1.6;
  const userVolatThreshold = (thresholds.volatilityJumpPct as number) ?? 20;

  const signals: MarketSignal[] = [];
  const rationales: ExplainableRationale[] = [];

  // Signal A: Price delta since baseline
  const deltaPricePct = Number((((quote.price - baseline.price) / baseline.price) * 100).toFixed(2));
  const absDeltaPrice = Math.abs(deltaPricePct);
  const pricePoints = Math.min(40, Math.round((absDeltaPrice / userPriceThreshold) * 22));
  if (pricePoints > 5) {
    signals.push({
      type: "PRICE_MOVE",
      label: "Price Delta vs Baseline",
      points: pricePoints,
      maxPoints: 40,
      description: `Shifted ${deltaPricePct >= 0 ? "+" : ""}${deltaPricePct}% from baseline ($${baseline.price.toFixed(2)} → $${quote.price.toFixed(2)})`,
      currentValue: quote.price,
      baselineValue: baseline.price,
      deltaPct: deltaPricePct,
      severity: absDeltaPrice >= userPriceThreshold ? "CRIT" : absDeltaPrice >= userPriceThreshold * 0.6 ? "WARN" : "INFO",
    });
    rationales.push({
      signalType: "PRICE_MOVE",
      headline: `Price Delta: ${deltaPricePct >= 0 ? "+" : ""}${deltaPricePct}% since last check`,
      detail: `Asset shifted from $${baseline.price.toFixed(2)} to $${quote.price.toFixed(2)}, representing a ${absDeltaPrice >= userPriceThreshold ? "critical threshold breach" : "moderate movement"}.`,
      impactScore: pricePoints,
      isCustomAlert: absDeltaPrice >= userPriceThreshold,
    });
  }

  // Signal B: Volume spike
  const volumeMultiplier = Number((quote.volume / quote.avgVolume).toFixed(2));
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
      severity: volumeMultiplier >= userVolThreshold ? "CRIT" : "WARN",
    });
    rationales.push({
      signalType: "VOLUME_SPIKE",
      headline: `Volume Spike: ${volumeMultiplier}x normal pace`,
      detail: `Turnover rate is tracking significantly higher than typical session distribution, indicating institutional block participation.`,
      impactScore: volPoints,
      isCustomAlert: volumeMultiplier >= userVolThreshold,
    });
  }

  // Signal C: Volatility expansion
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
      severity: volatExpansionPct >= userVolatThreshold ? "CRIT" : "WARN",
    });
    rationales.push({
      signalType: "VOLATILITY_EXPANSION",
      headline: `Volatility Jump: +${volatExpansionPct}% range expansion`,
      detail: `Intraday high-low spread ($${quote.dayLow.toFixed(2)} - $${quote.dayHigh.toFixed(2)}) widened beyond standard variance bounds.`,
      impactScore: volatPoints,
      isCustomAlert: volatExpansionPct >= userVolatThreshold,
    });
  }

  // Signal D: User threshold crossings
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
      description: `Breached custom rule(s): ${breachedPriceThreshold ? `ΔPrice >= ±${userPriceThreshold}%` : ""}${breachedPriceThreshold && breachedVolThreshold ? " & " : ""}${breachedVolThreshold ? `Volume >= ${userVolThreshold}x` : ""}`,
      currentValue: breachedPriceThreshold ? absDeltaPrice : volumeMultiplier,
      baselineValue: breachedPriceThreshold ? userPriceThreshold : userVolThreshold,
      deltaPct: 100,
      severity: "CRIT",
    });
    rationales.push({
      signalType: "THRESHOLD_BREACH",
      headline: `Rule Breached: User threshold active`,
      detail: `Your custom monitoring configuration signaled an immediate trigger for ${symbol}.`,
      impactScore: thresholdPoints,
      isCustomAlert: true,
    });
  }

  // Signal E: Sector correlation
  const sectorData = sectorMovements.find((s) => s.sector === quote.sector);
  let sectorPoints = 0;
  if (sectorData && (sectorData.isCorrelatedSurge || sectorData.isCorrelatedDrop)) {
    sectorPoints = 15;
    signals.push({
      type: "SECTOR_CORRELATION",
      label: "Correlated Sector Move",
      points: sectorPoints,
      maxPoints: 15,
      description: `${quote.sector} sector exhibiting ${sectorData.avgChangePct > 0 ? "bullish rally" : "bearish pullback"} (${sectorData.avgChangePct >= 0 ? "+" : ""}${sectorData.avgChangePct}% avg)`,
      currentValue: sectorData.avgChangePct,
      baselineValue: 0,
      deltaPct: sectorData.avgChangePct,
      severity: "WARN",
    });
    rationales.push({
      signalType: "SECTOR_CORRELATION",
      headline: `Sector Momentum: ${quote.sector} (${sectorData.avgChangePct >= 0 ? "+" : ""}${sectorData.avgChangePct}%)`,
      detail: `High sector co-movement (${Math.round(sectorData.correlationScore * 100)}% co-directional advancers/decliners).`,
      impactScore: sectorPoints,
      isCustomAlert: false,
    });
  }

  // Signal F: Anti-Whipsaw Buy Target Hysteresis State Machine
  let buyTargetPoints = 0;
  let reachedBuyTarget = false;
  let isAlertThrottled = false;

  if (thresholds.targetBuyPrice && thresholds.targetBuyActive !== false) {
    const targetCurrency = (thresholds.targetBuyCurrency as string) || "INR";
    const currentPriceInTarget =
      targetCurrency === "INR"
        ? quote.currency === "INR"
          ? quote.price
          : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2))
        : quote.currency === "USD"
        ? quote.price
        : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2));

    const targetType: string =
      (thresholds.targetType as string) ||
      ((thresholds.targetBuyPrice as number) >= currentPriceInTarget ? "DIP_BUY" : "BREAKOUT_BUY");

    const hysteresisPct = (thresholds.hysteresisBufferPct as number) ?? 0.5;
    const cooldownMs = ((thresholds.cooldownMinutes as number) ?? 30) * 60 * 1000;

    const isDirectHit =
      targetType === "DIP_BUY"
        ? currentPriceInTarget <= (thresholds.targetBuyPrice as number)
        : currentPriceInTarget >= (thresholds.targetBuyPrice as number);

    const rearmPrice =
      targetType === "DIP_BUY"
        ? Number(((thresholds.targetBuyPrice as number) * (1 + hysteresisPct / 100)).toFixed(2))
        : Number(((thresholds.targetBuyPrice as number) * (1 - hysteresisPct / 100)).toFixed(2));

    // Hysteresis rearm check
    if (thresholds.targetBuyTriggered) {
      const hasRebounded =
        targetType === "DIP_BUY"
          ? currentPriceInTarget >= rearmPrice
          : currentPriceInTarget <= rearmPrice;

      if (hasRebounded) {
        thresholds.targetBuyTriggered = false;
      } else if (!isDirectHit) {
        thresholds.suppressedOscillationsCount =
          ((thresholds.suppressedOscillationsCount as number) || 0) + 1;
      }
    }

    if (isDirectHit) {
      const now = Date.now();
      const timeSinceLastAlert = thresholds.lastAlertDispatchedAt
        ? now - (thresholds.lastAlertDispatchedAt as number)
        : Infinity;

      let significantProgression = false;
      if (thresholds.lastAlertPrice) {
        const deeperPct =
          targetType === "DIP_BUY"
            ? (((thresholds.lastAlertPrice as number) - currentPriceInTarget) / (thresholds.lastAlertPrice as number)) * 100
            : ((currentPriceInTarget - (thresholds.lastAlertPrice as number)) / (thresholds.lastAlertPrice as number)) * 100;
        if (deeperPct >= 2.0) significantProgression = true;
      }

      if (timeSinceLastAlert < cooldownMs && !significantProgression && thresholds.targetBuyTriggered) {
        // Throttled — suppress oscillation
        isAlertThrottled = true;
        thresholds.suppressedOscillationsCount =
          ((thresholds.suppressedOscillationsCount as number) || 0) + 1;
        marketRepository.recordSuppressedOscillation("usr_demo_1", quote.symbol).catch(() => {});
      } else {
        const isFresh = !thresholds.targetBuyTriggered || timeSinceLastAlert >= cooldownMs;
        thresholds.targetBuyTriggered = true;
        thresholds.targetBuyTriggeredAt = (thresholds.targetBuyTriggeredAt as number) || now;
        thresholds.lastAlertDispatchedAt = now;
        thresholds.lastAlertPrice = currentPriceInTarget;

        if (isFresh) {
          marketRepository.recordAlertAudit({
            userId: "usr_demo_1",
            symbol: quote.symbol,
            triggerType: targetType === "BREAKOUT_BUY" ? "BREAKOUT_BUY_REACHED" : "DIP_BUY_REACHED",
            triggerPrice: currentPriceInTarget,
            attentionScore: 85,
            message: `${quote.symbol} reached ${targetType === "BREAKOUT_BUY" ? "Breakout" : "Dip-Buy"} target (${targetCurrency === "INR" ? "₹" : "$"}${thresholds.targetBuyPrice}). Anti-whipsaw cooldown active.`,
            suppressedCount: (thresholds.suppressedOscillationsCount as number) || 0,
          }).catch((err) => console.error("[AUDIT] Failed to record alert:", err));
        }
      }
      reachedBuyTarget = true;
    } else {
      reachedBuyTarget = Boolean(thresholds.targetBuyTriggered);
    }

    if (reachedBuyTarget) {
      const symSymbol = targetCurrency === "INR" ? "₹" : "$";
      const modeLabel = targetType === "BREAKOUT_BUY" ? "Breakout Target" : "Dip Buy Target";
      buyTargetPoints = 25;
      const currentPriceInTargetFinal =
        targetCurrency === "INR"
          ? quote.currency === "INR"
            ? quote.price
            : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2))
          : quote.currency === "USD"
          ? quote.price
          : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2));

      signals.push({
        type: "THRESHOLD_BREACH",
        label: `${modeLabel} Reached`,
        points: buyTargetPoints,
        maxPoints: 25,
        description: `${modeLabel} triggered at ${symSymbol}${currentPriceInTargetFinal.toLocaleString()} (Target: ${targetType === "BREAKOUT_BUY" ? "≥" : "≤"} ${symSymbol}${(thresholds.targetBuyPrice as number).toLocaleString()})${thresholds.suppressedOscillationsCount ? ` [${thresholds.suppressedOscillationsCount} hover crosses suppressed]` : ""}`,
        currentValue: currentPriceInTargetFinal,
        baselineValue: thresholds.targetBuyPrice as number,
        deltaPct: Number((((currentPriceInTargetFinal - (thresholds.targetBuyPrice as number)) / (thresholds.targetBuyPrice as number)) * 100).toFixed(2)),
        severity: "CRIT",
      });
      rationales.push({
        signalType: "THRESHOLD_BREACH",
        headline: `🎯 ${modeLabel.toUpperCase()}: Reached ${symSymbol}${(thresholds.targetBuyPrice as number).toLocaleString()}`,
        detail: `${symbol} reached your target purchase level of ${symSymbol}${(thresholds.targetBuyPrice as number).toLocaleString()} (Current: ${symSymbol}${currentPriceInTargetFinal.toLocaleString()}). Anti-whipsaw 0.5% hysteresis active${isAlertThrottled ? " (notification throttled to prevent spam)." : "."}`,
        impactScore: buyTargetPoints,
        isCustomAlert: true,
      });
    }
  }

  // Signal G: Liquidity Sweep V-reversal
  let sweepPoints = 0;
  if ((quote as any).liquiditySweep?.detected) {
    sweepPoints = 15;
    signals.push({
      type: "VOLATILITY_EXPANSION",
      label: "Liquidity Sweep V-Reversal",
      points: sweepPoints,
      maxPoints: 20,
      description: `V-Shape mean reversion: ${(quote as any).liquiditySweep.dropPct}% flash dip absorbed in ${(quote as any).liquiditySweep.durationSeconds}s. Memory baseline preserved.`,
      currentValue: quote.price,
      baselineValue: (quote as any).liquiditySweep.preDropPrice,
      deltaPct: (quote as any).liquiditySweep.dropPct,
      severity: "WARN",
    });
    rationales.push({
      signalType: "VOLATILITY_EXPANSION",
      headline: `⚡ Liquidity Sweep: V-Shape Reversal (${(quote as any).liquiditySweep.dropPct}%)`,
      detail: (quote as any).liquiditySweep.notes,
      impactScore: sweepPoints,
      isCustomAlert: false,
    });
  }

  // Aggregate
  const rawScore = pricePoints + volPoints + volatPoints + thresholdPoints + sectorPoints + buyTargetPoints + sweepPoints;
  const totalScore = Math.min(100, Math.max(0, rawScore));

  let category: AttentionCategory = "NO_MEANINGFUL_CHANGE";
  if (totalScore >= 70 || breachedPriceThreshold || reachedBuyTarget) {
    category = "NEEDS_ATTENTION";
  } else if (totalScore >= 35 || volPoints >= 15 || absDeltaPrice >= 1.5) {
    category = "WORTH_KNOWING";
  }

  let primaryDriver = "Normal baseline oscillation";
  if (signals.length > 0) {
    const sorted = [...signals].sort((a, b) => b.points - a.points);
    primaryDriver = `${sorted[0].label} (+${sorted[0].points} pts)`;
  }

  return {
    symbol,
    totalScore,
    category,
    urgencyRank: 100 - totalScore,
    signals,
    rationales,
    primaryDriver,
  };
}

// ---------------------------------------------------------------------------
// 3. Dynamic Cluster Groups
// ---------------------------------------------------------------------------
export function generateDynamicGroups(
  scores: Record<string, AttentionScoreData>,
  quotes: StockQuote[]
): DynamicGroup[] {
  const mostActive = [...quotes]
    .filter((q) => q.volume / q.avgVolume >= 1.3)
    .sort((a, b) => b.volume / b.avgVolume - a.volume / a.avgVolume)
    .map((q) => q.symbol);

  const highAttention = Object.values(scores)
    .filter((s) => s.totalScore >= 70)
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s) => s.symbol);

  const strongMomentum = [...quotes]
    .filter((q) => Math.abs(q.changePct) >= 2.5)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .map((q) => q.symbol);

  const highVolatile = [...quotes]
    .filter((q) => q.volatility >= 30)
    .sort((a, b) => b.volatility - a.volatility)
    .map((q) => q.symbol);

  const stable = [...quotes]
    .filter((q) => Math.abs(q.changePct) < 1.0 && (scores[q.symbol]?.totalScore || 0) < 30)
    .sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct))
    .map((q) => q.symbol);

  return [
    { id: "grp_high_attention", name: "CRITICAL ATTENTION", code: "ATTN_PRIORITY", description: "Assets with multiple anomaly signals or custom threshold breaches.", symbols: highAttention, badgeColor: "red", metricHighlight: `${highAttention.length} assets require review` },
    { id: "grp_most_active", name: "ABNORMAL VELOCITY", code: "VOLUME_SURGE", description: "Trading volume significantly exceeding 20-day baseline distributions.", symbols: mostActive, badgeColor: "amber", metricHighlight: `${mostActive.length} assets with volume spike` },
    { id: "grp_momentum", name: "STRONG MOMENTUM", code: "DIRECTIONAL_VELOCITY", description: "Aggressive directional price impulse (>2.5% intraday change).", symbols: strongMomentum, badgeColor: "green", metricHighlight: `${strongMomentum.length} trending names` },
    { id: "grp_volatility", name: "HIGH VOLATILITY", code: "REGIME_EXPANSION", description: "Elevated high-low intraday ATR spreads and gamma movement.", symbols: highVolatile, badgeColor: "purple", metricHighlight: `${highVolatile.length} wide range assets` },
    { id: "grp_stable", name: "STEADY / ANCHORED", code: "MEAN_CONVERGENCE", description: "Quiet, orderly price discovery with minimal drift from baseline.", symbols: stable, badgeColor: "blue", metricHighlight: `${stable.length} anchored assets` },
  ];
}

// ---------------------------------------------------------------------------
// 4. Event Compression / Deduplication
// ---------------------------------------------------------------------------
export function compressEvents(
  scores: Record<string, AttentionScoreData>,
  sectors: SectorMovement[]
): CompressedInsight[] {
  const insights: CompressedInsight[] = [];

  // Group A: Correlated sector moves
  sectors.filter((s) => s.isCorrelatedSurge || s.isCorrelatedDrop).forEach((sec) => {
    const symbolsInSector = Array.from(userWatchlist.keys()).filter((sym) => liveQuotes.get(sym)?.sector === sec.sector);
    if (symbolsInSector.length > 0) {
      const isBull = sec.avgChangePct > 0;
      insights.push({
        id: `ins_sec_${sec.sector.toLowerCase()}`,
        scope: "SECTOR_WIDE",
        category: "NEEDS_ATTENTION",
        sector: sec.sector,
        symbols: symbolsInSector,
        headline: `${sec.sector.toUpperCase()} MACRO CLUSTER: ${isBull ? "COORDINATED RALLY" : "SECTOR SELLOFF"}`,
        deduplicatedCount: symbolsInSector.length * 4,
        executiveSummary: `Aggregated ${symbolsInSector.length} individual symbol alerts into single macro cluster. The entire ${sec.sector} basket is moving synchronously with ${Math.round(sec.correlationScore * 100)}% directional consensus, averaging ${sec.avgChangePct >= 0 ? "+" : ""}${sec.avgChangePct}%.`,
        actionableContext: `Individual stock alerts for ${symbolsInSector.join(", ")} share systemic macro drivers rather than idiosyncratic news. Focus on sector-wide liquidity flows.`,
        signals: ["SECTOR_CORRELATION", "VOLUME_SPIKE"],
        highestScore: 88,
      });
    }
  });

  // Group B: High-attention stock-specific
  Object.entries(scores)
    .filter(([, score]) => score.category === "NEEDS_ATTENTION")
    .map(([sym]) => sym)
    .forEach((sym) => {
      const scoreData = scores[sym];
      const quote = liveQuotes.get(sym);
      if (!quote) return;
      const inSectorInsight = insights.some((i) => i.scope === "SECTOR_WIDE" && i.symbols.includes(sym));
      if (inSectorInsight && scoreData.totalScore < 85) return;
      insights.push({
        id: `ins_stock_${sym.toLowerCase()}`,
        scope: "STOCK_SPECIFIC",
        category: scoreData.category,
        symbols: [sym],
        headline: `${sym}: ${scoreData.primaryDriver.toUpperCase()}`,
        deduplicatedCount: 7,
        executiveSummary: `${sym} triggered an attention score of ${scoreData.totalScore}/100. ${scoreData.rationales.map((r) => r.detail).join(" ")}`,
        actionableContext: `Threshold triggers fired at current price $${quote.price.toFixed(2)}. Day range: $${quote.dayLow.toFixed(2)} - $${quote.dayHigh.toFixed(2)}.`,
        signals: scoreData.signals.map((s) => s.label),
        highestScore: scoreData.totalScore,
      });
    });

  // Group C: Worth-knowing digest
  const worthKnowingSymbols = Object.entries(scores)
    .filter(([, score]) => score.category === "WORTH_KNOWING")
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
      highestScore: 62,
    });
  }

  return insights;
}
