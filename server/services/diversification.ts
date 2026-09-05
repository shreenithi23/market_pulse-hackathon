/**
 * diversification.ts
 * Portfolio diversification analysis and top-K cross-sector recommendations.
 */

import {
  StockQuote,
  WatchlistRecord,
  PortfolioDiversificationData,
  SectorAllocation,
  DiversificationRecommendation,
  TopKStockPick,
} from "../../src/types/market.ts";
import { STOCK_UNIVERSE } from "../data/stockUniverse.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

export function calculatePortfolioDiversification(
  watchlist: WatchlistRecord[],
  stocks: StockQuote[]
): PortfolioDiversificationData {
  const stockMap = new Map<string, StockQuote>();
  stocks.forEach((s) => stockMap.set(s.symbol, s));

  // 1. Sector allocation
  const sectorCountMap: Record<string, { count: number; symbols: string[] }> = {};
  const totalWatchlist = watchlist.length || 1;

  watchlist.forEach((item) => {
    const q = stockMap.get(item.symbol);
    const sector = q?.sector || "Other";
    if (!sectorCountMap[sector]) sectorCountMap[sector] = { count: 0, symbols: [] };
    sectorCountMap[sector].count += 1;
    sectorCountMap[sector].symbols.push(item.symbol);
  });

  const allUniverseSectors = Array.from(new Set(STOCK_UNIVERSE.map((s) => s.sector)));

  const userSectorDistribution: SectorAllocation[] = allUniverseSectors
    .map((sector) => {
      const userSector = sectorCountMap[sector] || { count: 0, symbols: [] };
      const weightPct = Math.round((userSector.count / totalWatchlist) * 100);
      let status: "OVERWEIGHT" | "BALANCED" | "UNDERWEIGHT" | "MISSING" = "MISSING";
      if (userSector.count === 0) status = "MISSING";
      else if (weightPct >= 35) status = "OVERWEIGHT";
      else if (weightPct >= 15) status = "BALANCED";
      else status = "UNDERWEIGHT";

      return { sector, count: userSector.count, weightPct, symbols: userSector.symbols, status };
    })
    .sort((a, b) => b.weightPct - a.weightPct);

  // 2. Concentration risk
  const dominant = userSectorDistribution[0] || { sector: "None", weightPct: 0 };
  let concentrationRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
  if (dominant.weightPct >= 60) concentrationRisk = "CRITICAL";
  else if (dominant.weightPct >= 45) concentrationRisk = "HIGH";
  else if (dominant.weightPct >= 30) concentrationRisk = "MODERATE";

  const missingSectors = userSectorDistribution.filter((s) => s.status === "MISSING").map((s) => s.sector);
  const underweightedSectors = userSectorDistribution.filter((s) => s.status === "UNDERWEIGHT").map((s) => s.sector);

  const concentrationSummary =
    concentrationRisk === "HIGH" || concentrationRisk === "CRITICAL"
      ? `High sector concentration: ${dominant.weightPct}% of your watchlist is concentrated in ${dominant.sector}. You are heavily exposed to cyclical tech drawdowns. We recommend hedging into ${missingSectors.slice(0, 2).join(" and ")}.`
      : concentrationRisk === "MODERATE"
      ? `Moderate concentration in ${dominant.sector} (${dominant.weightPct}%). Adding exposure to defensive or non-correlated sectors will smooth drawdown volatility.`
      : `Well-diversified watchlist across multiple market sectors with low single-sector concentration risk.`;

  // 3. Top-K picks per sector
  const watchlistSymbolSet = new Set(watchlist.map((w) => w.symbol));
  const allSectorTopPicks: Record<string, TopKStockPick[]> = {};

  allUniverseSectors.forEach((sector) => {
    const seedsInSector = STOCK_UNIVERSE.filter((s) => s.sector === sector);
    const mappedPicks: TopKStockPick[] = seedsInSector.map((seed) => {
      const q = stockMap.get(seed.symbol);
      const currentPrice = q ? q.price : seed.basePrice;
      const priceINR = q?.priceINR || (seed.currency === "INR" ? currentPrice : Number((currentPrice * USD_INR_EXCHANGE_RATE).toFixed(2)));

      return {
        symbol: seed.symbol,
        name: seed.name,
        sector: seed.sector,
        price: currentPrice,
        currency: seed.currency || "USD",
        priceINR,
        changePct: q ? q.changePct : 0,
        volume: q ? q.volume : seed.avgVolume,
        beta: seed.beta,
        volatility: q ? q.volatility : 22.0,
        rank: 1,
        whyPick: seed.whyPick || "High-quality market leader with strong institutional liquidity.",
        isInWatchlist: watchlistSymbolSet.has(seed.symbol),
        peRatio: seed.peRatio,
        marketCapTier: seed.marketCapTier,
      };
    });

    mappedPicks.sort((a, b) => {
      if (a.isInWatchlist !== b.isInWatchlist) return a.isInWatchlist ? 1 : -1;
      const scoreA = a.changePct * 2 - a.beta * 3;
      const scoreB = b.changePct * 2 - b.beta * 3;
      return scoreB - scoreA;
    });
    mappedPicks.forEach((p, idx) => { p.rank = idx + 1; });
    allSectorTopPicks[sector] = mappedPicks;
  });

  // 4. Recommendations
  const recommendations: DiversificationRecommendation[] = [];
  const candidateSectors = [...missingSectors, ...underweightedSectors].filter((s) => s !== dominant.sector);

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
      id: `rec_div_${targetSec.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${idx}`,
      targetSector: targetSec,
      sourceOverweightSector: dominant.sector,
      urgency: dominant.weightPct >= 50 ? "HIGH" : "MEDIUM",
      headline,
      rationale,
      diversificationBenefit: benefit,
      correlationImpact,
      topKStocks: topKPicks,
    });
  });

  return {
    userSectorDistribution,
    dominantSector: dominant.sector,
    concentrationRisk,
    concentrationSummary,
    recommendations,
    allSectorTopPicks,
  };
}
