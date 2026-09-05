/**
 * tickSimulator.ts
 * Background 3-second stochastic tick engine with:
 *   - Per-stock price/volume micro-updates
 *   - Anti-whipsaw hysteresis guard (suppresses repetitive alerts)
 *   - DB persistence of alert trigger state via marketRepository
 */

import { liveQuotes, userWatchlist } from "../state/marketState.ts";
import { STOCK_UNIVERSE } from "../data/stockUniverse.ts";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";
import { USD_INR_EXCHANGE_RATE } from "../config/environment.ts";

export function startTickSimulator() {
  setInterval(() => {
    const now = Date.now();

    liveQuotes.forEach((quote) => {
      // ~70% chance of tick update per cycle
      if (Math.random() > 0.3) return;

      const seed = STOCK_UNIVERSE.find((s) => s.symbol === quote.symbol);
      const beta = seed?.beta || 1.0;
      const delta = (Math.random() - 0.495) * (quote.price * 0.003 * beta);
      const newPrice = Number(Math.max(1, quote.price + delta).toFixed(2));
      const newChange = Number((newPrice - (seed?.basePrice || quote.price)).toFixed(2));
      const newChangePct = Number(((newChange / (seed?.basePrice || quote.price)) * 100).toFixed(2));
      const newVolume = quote.volume + Math.floor(Math.random() * 25_000);

      quote.price = newPrice;
      quote.change = newChange;
      quote.changePct = newChangePct;
      quote.volume = newVolume;
      quote.dayHigh = Number(Math.max(quote.dayHigh, newPrice).toFixed(2));
      quote.dayLow = Number(Math.min(quote.dayLow, newPrice).toFixed(2));
      quote.priceINR =
        quote.currency === "INR"
          ? newPrice
          : Number((newPrice * USD_INR_EXCHANGE_RATE).toFixed(2));
      quote.lastUpdated = now;

      // -----------------------------------------------------------------------
      // Anti-Whipsaw Buy Target Hysteresis Guard
      // -----------------------------------------------------------------------
      const watchlistEntry = userWatchlist.get(quote.symbol);
      const thresh = watchlistEntry?.customThresholds;

      if (thresh?.targetBuyPrice && thresh.targetBuyActive !== false) {
        const targetCurrency = (thresh.targetBuyCurrency as string) || "INR";
        const currentInTarget =
          targetCurrency === "INR"
            ? quote.priceINR || newPrice
            : quote.currency === "USD"
            ? newPrice
            : Number((newPrice / USD_INR_EXCHANGE_RATE).toFixed(2));

        const targetType: string =
          (thresh.targetType as string) ||
          ((thresh.targetBuyPrice as number) >= currentInTarget ? "DIP_BUY" : "BREAKOUT_BUY");

        const hysteresisPct = (thresh.hysteresisBufferPct as number) ?? 0.5;

        const isDirectHit =
          targetType === "DIP_BUY"
            ? currentInTarget <= (thresh.targetBuyPrice as number)
            : currentInTarget >= (thresh.targetBuyPrice as number);

        const rearmPrice =
          targetType === "DIP_BUY"
            ? Number(((thresh.targetBuyPrice as number) * (1 + hysteresisPct / 100)).toFixed(2))
            : Number(((thresh.targetBuyPrice as number) * (1 - hysteresisPct / 100)).toFixed(2));

        if (thresh.targetBuyTriggered) {
          const hasRebounded =
            targetType === "DIP_BUY"
              ? currentInTarget >= rearmPrice
              : currentInTarget <= rearmPrice;

          if (hasRebounded) {
            thresh.targetBuyTriggered = false;
            // Persist re-arm state to DB
            marketRepository.getAlertRule("usr_demo_1", quote.symbol).then((rule) => {
              if (rule) {
                rule.targetBuyTriggered = false;
                marketRepository.saveAlertRule(rule).catch(() => {});
              }
            }).catch(() => {});
          } else if (!isDirectHit) {
            // Hovering in hysteresis band — suppress oscillation
            thresh.suppressedOscillationsCount =
              ((thresh.suppressedOscillationsCount as number) || 0) + 1;
          }
        } else if (isDirectHit) {
          thresh.targetBuyTriggered = true;
          thresh.targetBuyTriggeredAt = now;
          thresh.lastAlertDispatchedAt = now;
          thresh.lastAlertPrice = currentInTarget;

          // Persist trigger to DB
          marketRepository.getAlertRule("usr_demo_1", quote.symbol).then((rule) => {
            if (rule) {
              rule.targetBuyTriggered = true;
              rule.targetBuyTriggeredAt = now;
              rule.lastTriggeredAt = now;
              rule.lastTriggeredPrice = currentInTarget;
              marketRepository.saveAlertRule(rule).catch(() => {});
            }
          }).catch(() => {});
        }
      }

      // Maintain sparkline ring buffer (max 15 ticks)
      if (Math.random() > 0.5) {
        quote.ticks.push({
          time: new Date(now).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          price: newPrice,
          volume: newVolume,
        });
        if (quote.ticks.length > 15) quote.ticks.shift();
      }
    });
  }, 3000);

  console.log("[TICK] Background tick simulator started (3s interval).");
}
