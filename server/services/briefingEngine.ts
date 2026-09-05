/**
 * briefingEngine.ts
 * Executive briefing synthesis: deterministic fallback + async Gemini AI enrichment.
 * assembleMarketOverview() is the main public entry point consumed by marketRouter.
 */

import {
  AttentionScoreData,
  CompressedInsight,
  MarketEvent,
  MarketOverviewResponse,
  BuyReminderAlert,
  DataFeedHealth,
} from "../../src/types/market.ts";
import {
  liveQuotes,
  userWatchlist,
  activeBaseline,
  savedSnapshots,
  activeEvents,
  feedStatus,
  feedLatency,
  conflictsResolvedCounter,
} from "../state/marketState.ts";
import { calculateSectorMovements, calculateAttentionScore, generateDynamicGroups, compressEvents } from "./marketIntelligence.ts";
import { updateEventLifecycle } from "./eventLifecycle.ts";
import { calculatePortfolioDiversification } from "./diversification.ts";
import { getGeminiClient, markGeminiAuthFailed } from "./geminiService.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

// ---------------------------------------------------------------------------
// Briefing cache
// ---------------------------------------------------------------------------
let cachedBriefing = "";
let lastBriefingTime = 0;
let isGeneratingBriefing = false;

export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Deterministic fallback briefing (no AI required)
// ---------------------------------------------------------------------------
function buildDeterministicBriefing(
  timeElapsedStr: string,
  scores: Record<string, AttentionScoreData>,
  events: MarketEvent[]
): string {
  const needsAttention = Object.values(scores).filter((s) => s.category === "NEEDS_ATTENTION");
  const worthKnowing = Object.values(scores).filter((s) => s.category === "WORTH_KNOWING");
  const totalTracked = Object.keys(scores).length;
  const escalatedEvents = events.filter((e) => e.currentState === "ESCALATED");
  const recoveringEvents = events.filter((e) => e.currentState === "RECOVERING");
  const criticalSymbols = needsAttention.map((s) => s.symbol);
  const sections: string[] = [];

  sections.push(`### ⏱️ Baseline Drift & Posture\nAnchor snapshot established **${timeElapsedStr.toUpperCase()} AGO**. Monitoring ${totalTracked} watchlist assets against customized volatility and baseline price envelopes.`);

  if (criticalSymbols.length === 0 && worthKnowing.length === 0) {
    sections.push(`### 🛡️ Portfolio Status: All Quiet\nAll ${totalTracked} tracked assets remain anchored within normal variance envelopes. Zero threshold breaches or abnormal volume surges recorded. No immediate intervention recommended.`);
  } else {
    sections.push(`### 📊 Portfolio Alert Matrix\nDetected **${criticalSymbols.length} critical priority** and **${worthKnowing.length} secondary alerts** across your portfolio.\n• High Urgency Assets: ${criticalSymbols.length > 0 ? criticalSymbols.map((s) => `**${s}**`).join(", ") : "None"}\n• Secondary Awareness: ${worthKnowing.length > 0 ? worthKnowing.map((s) => `**${s.symbol}**`).join(", ") : "None"}`);

    if (criticalSymbols.length > 0) {
      const topPick = needsAttention[0];
      sections.push(`### 🎯 Primary Urgency Driver: ${topPick.symbol}\n**${topPick.symbol}** leads the attention queue with an urgency score of **${topPick.totalScore}/100**.\nTrigger Mechanism: ${topPick.primaryDriver}. Immediate review is advised to evaluate positional risk.`);
    }

    if (escalatedEvents.length > 0 || recoveringEvents.length > 0) {
      const dynamics: string[] = [];
      if (escalatedEvents.length > 0) dynamics.push(`• **Escalated Momentum**: ${escalatedEvents.map((e) => `**${e.symbol}**`).join(", ")} currently experiencing elevated order-flow surges and expanding volatility.`);
      if (recoveringEvents.length > 0) dynamics.push(`• **Mean-Reversion Recovery**: ${recoveringEvents.map((e) => `**${e.symbol}**`).join(", ")} exhibiting stabilization and price reversion back towards the baseline anchor.`);
      sections.push(`### 🔄 Market Lifecycle Dynamics\n${dynamics.join("\n")}`);
    }

    sections.push(`### 📋 Tactical Recommendations\n• **Review Attention Queue**: Inspect ${criticalSymbols.join(", ") || "priority symbols"} to confirm if price moves align with broader market themes.\n• **Verify Order Triggers**: Check buy reminder targets and stop-loss levels for triggered assets.\n• **Re-anchor Baseline**: If current market prints represent the new norm, take a new snapshot to silence baseline drift.`);
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Non-blocking Gemini refresh
// ---------------------------------------------------------------------------
function triggerGeminiBriefingRefresh(
  timeElapsedStr: string,
  scores: Record<string, AttentionScoreData>,
  events: MarketEvent[]
) {
  if (isGeneratingBriefing) return;
  const ai = getGeminiClient();
  if (!ai) return;

  isGeneratingBriefing = true;
  const needsAttention = Object.values(scores).filter((s) => s.category === "NEEDS_ATTENTION");
  const worthKnowing = Object.values(scores).filter((s) => s.category === "WORTH_KNOWING");
  const totalTracked = Object.keys(scores).length;

  const prompt = `You are a Wall Street quantitative terminal market memory engine.
Current Context:
- Time elapsed since user last checked: ${timeElapsedStr}
- Total watchlist assets tracked: ${totalTracked}
- Assets needing attention: ${needsAttention.map((s) => `${s.symbol} (Score ${s.totalScore}/100: ${s.primaryDriver})`).join("; ") || "None"}
- Worth knowing assets: ${worthKnowing.map((s) => s.symbol).join(", ") || "None"}
- Active lifecycle events: ${events.map((e) => `${e.symbol} [${e.currentState}]: ${e.summary}`).join("; ")}

Generate a structured, beautifully formatted executive briefing for the returning trader with clear Markdown sections.
Do NOT write as a single paragraph. Use this structure:
### ⏱️ Baseline Drift: [Time elapsed]
### 📊 Portfolio Alert Matrix: [Summary of critical vs secondary alerts]
### 🎯 Primary Driver: [Top asset and reason]
### 🔄 Lifecycle Dynamics: [Escalated vs recovering status]
### 📋 Tactical Recommendations: [Specific bullet points]

Rules:
- Adopt a disciplined, quantitative terminal tone.
- Bold key ticker symbols and scores.
- Use clean bullet points where appropriate.
- Keep concise, high-signal, under 140 words.`;

  ai.models
    .generateContent({ model: "gemini-2.0-flash", contents: prompt })
    .then((response) => {
      if (response.text) {
        cachedBriefing = response.text.trim();
        lastBriefingTime = Date.now();
      }
    })
    .catch((err) => {
      const errMsg = err?.message || String(err);
      const isAuthError =
        errMsg.includes("401") ||
        errMsg.includes("UNAUTHENTICATED") ||
        errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED") ||
        errMsg.includes("invalid authentication credentials");
      if (isAuthError) markGeminiAuthFailed();
      else console.warn("[GEMINI] Briefing generation note:", errMsg);
      lastBriefingTime = Date.now();
    })
    .finally(() => {
      isGeneratingBriefing = false;
    });
}

// ---------------------------------------------------------------------------
// Synthesize briefing (instant response + background AI refresh)
// ---------------------------------------------------------------------------
function synthesizeExecutiveBriefing(
  timeElapsedStr: string,
  scores: Record<string, AttentionScoreData>,
  compressedInsights: CompressedInsight[],
  events: MarketEvent[]
): string {
  const now = Date.now();
  const deterministic = buildDeterministicBriefing(timeElapsedStr, scores, events);

  // Invalidate legacy single-paragraph format
  if (cachedBriefing && cachedBriefing.startsWith(">>> EXECUTIVE BRIEFING")) {
    cachedBriefing = "";
  }

  const ai = getGeminiClient();
  if (ai && (now - lastBriefingTime > 60_000 || !cachedBriefing)) {
    triggerGeminiBriefingRefresh(timeElapsedStr, scores, events);
  }

  if (cachedBriefing && now - lastBriefingTime < 90_000) {
    return cachedBriefing;
  }

  cachedBriefing = deterministic;
  return cachedBriefing;
}

// ---------------------------------------------------------------------------
// Main assembly function
// ---------------------------------------------------------------------------
export async function assembleMarketOverview(): Promise<MarketOverviewResponse> {
  const now = Date.now();
  updateEventLifecycle(now);

  const sectorMovements = calculateSectorMovements();
  const stocks = Array.from(liveQuotes.values());
  const watchlist = Array.from(userWatchlist.values());

  const attentionScores: Record<string, AttentionScoreData> = {};
  watchlist.forEach((item) => {
    attentionScores[item.symbol] = calculateAttentionScore(item.symbol, sectorMovements);
  });

  const dynamicGroups = generateDynamicGroups(attentionScores, stocks);
  const events = Array.from(activeEvents.values());
  const compressedInsights = compressEvents(attentionScores, sectorMovements);

  const elapsedMs = now - (activeBaseline?.timestamp ?? now);
  const elapsedFormatted = formatElapsedTime(elapsedMs);

  const personalizedExecutiveBriefing = synthesizeExecutiveBriefing(
    elapsedFormatted,
    attentionScores,
    compressedInsights,
    events
  );

  const diversification = calculatePortfolioDiversification(watchlist, stocks);

  // Buy reminders
  const buyReminders: BuyReminderAlert[] = [];
  watchlist.forEach((item) => {
    const q = liveQuotes.get(item.symbol);
    if (!q) return;
    const thresh = item.customThresholds;
    if (!thresh?.targetBuyPrice || thresh.targetBuyActive === false) return;

    const targetCurrency = (thresh.targetBuyCurrency as string) || "INR";
    const currentPriceInTarget =
      targetCurrency === "INR"
        ? q.priceINR || (q.currency === "INR" ? q.price : Number((q.price * USD_INR_EXCHANGE_RATE).toFixed(2)))
        : q.currency === "USD"
        ? q.price
        : Number((q.price / USD_INR_EXCHANGE_RATE).toFixed(2));

    const targetType: string =
      (thresh.targetType as string) ||
      (currentPriceInTarget <= (thresh.targetBuyPrice as number) ? "DIP_BUY" : "BREAKOUT_BUY");

    const hysteresisPct = (thresh.hysteresisBufferPct as number) ?? 0.5;
    const cooldownMs = ((thresh.cooldownMinutes as number) ?? 30) * 60 * 1000;

    const isDirectHit =
      targetType === "DIP_BUY"
        ? currentPriceInTarget <= (thresh.targetBuyPrice as number)
        : currentPriceInTarget >= (thresh.targetBuyPrice as number);

    const rearmRequiredPrice =
      targetType === "DIP_BUY"
        ? Number(((thresh.targetBuyPrice as number) * (1 + hysteresisPct / 100)).toFixed(2))
        : Number(((thresh.targetBuyPrice as number) * (1 - hysteresisPct / 100)).toFixed(2));

    if (thresh.targetBuyTriggered) {
      const hasRebounded =
        targetType === "DIP_BUY"
          ? currentPriceInTarget >= rearmRequiredPrice
          : currentPriceInTarget <= rearmRequiredPrice;
      if (hasRebounded) thresh.targetBuyTriggered = false;
    }

    const isTriggered = isDirectHit || Boolean(thresh.targetBuyTriggered);
    const gapPct = Number((((currentPriceInTarget - (thresh.targetBuyPrice as number)) / (thresh.targetBuyPrice as number)) * 100).toFixed(2));

    if (isDirectHit && !thresh.targetBuyTriggered) {
      thresh.targetBuyTriggered = true;
      thresh.targetBuyTriggeredAt = Date.now();
      thresh.lastAlertDispatchedAt = Date.now();
      thresh.lastAlertPrice = currentPriceInTarget;
    }

    const timeSinceAlert = thresh.lastAlertDispatchedAt ? now - (thresh.lastAlertDispatchedAt as number) : Infinity;

    buyReminders.push({
      symbol: item.symbol,
      stockName: q.name,
      sector: q.sector,
      targetBuyPrice: thresh.targetBuyPrice as number,
      targetBuyCurrency: targetCurrency as "INR" | "USD",
      targetType: targetType as "DIP_BUY" | "BREAKOUT_BUY",
      currentPrice: q.price,
      priceInTargetCurrency: currentPriceInTarget,
      gapPct,
      triggered: isTriggered,
      triggeredAt: thresh.targetBuyTriggeredAt as number | undefined,
      note: (thresh.targetBuyNote as string) || `Buy reminder target: ${targetCurrency === "INR" ? "₹" : "$"}${(thresh.targetBuyPrice as number).toLocaleString()}`,
      hysteresisBufferPct: hysteresisPct,
      cooldownMinutes: (thresh.cooldownMinutes as number) ?? 30,
      suppressedOscillationsCount: (thresh.suppressedOscillationsCount as number) || 0,
      isThrottled: Boolean(thresh.targetBuyTriggered && timeSinceAlert < cooldownMs),
      rearmRequiredPrice,
      antiWhipsawActive: true,
    });
  });

  const needsAttentionCount = Object.values(attentionScores).filter((s) => s.category === "NEEDS_ATTENTION").length;
  const worthKnowingCount = Object.values(attentionScores).filter((s) => s.category === "WORTH_KNOWING").length;
  const normalCount = Object.values(attentionScores).filter((s) => s.category === "NO_MEANINGFUL_CHANGE").length;
  const activeAlertsCount = events.filter((e) => e.currentState !== "RESOLVED").length;
  const unusualVolumeCount = stocks.filter((s) => s.volume / s.avgVolume >= 1.5).length;
  const triggeredBuyAlertsCount = buyReminders.filter((b) => b.triggered).length;

  const feedHealth: DataFeedHealth = {
    status: feedStatus,
    latencyMs: feedLatency + Math.floor(Math.random() * 8),
    activeFeed: "DIRECT_EXCHANGE",
    lastTickTimestamp: now,
    conflictsResolvedCount: conflictsResolvedCounter,
    cacheHitRatio: 0.94,
    isSimulated: true,
  };

  return {
    feedHealth,
    memory: {
      currentBaseline: activeBaseline,
      availableSnapshots: savedSnapshots.map((s) => ({ id: s.id, timestamp: s.timestamp, label: s.label })),
      timeSinceBaselineFormatted: elapsedFormatted,
      elapsedSeconds: Math.floor(elapsedMs / 1000),
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
      triggeredBuyAlertsCount,
    },
  };
}
