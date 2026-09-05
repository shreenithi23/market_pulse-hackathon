/**
 * memoryRouter.ts
 * POST /api/memory/snapshot        — take new baseline (ACID transaction in DB)
 * POST /api/memory/switch-baseline — switch to saved snapshot
 * POST /api/memory/select-baseline — alias
 */

import { Router, Request, Response } from "express";
import {
  liveQuotes,
  savedSnapshots,
  setActiveBaseline,
  activeBaseline,
} from "../state/marketState.ts";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";
import { MemoryBaselineSnapshot } from "../../src/types/market.ts";

const router = Router();

// POST /api/memory/snapshot — atomic ACID snapshot commit
router.post("/snapshot", async (req, res) => {
  const { label, description } = req.body;
  const now = Date.now();

  const snapshotQuotes: Record<string, { price: number; volume: number; volatility: number; timestamp: number }> = {};
  liveQuotes.forEach((quote, sym) => {
    // Don't contaminate baseline with active flash-crash troughs
    const effectivePrice =
      (quote as any).liquiditySweep?.detected && !(quote as any).liquiditySweep?.recoveredAt
        ? (quote as any).liquiditySweep.preDropPrice
        : quote.price;

    snapshotQuotes[sym] = { price: effectivePrice, volume: quote.volume, volatility: quote.volatility, timestamp: now };
  });

  const newSnapshot: MemoryBaselineSnapshot = {
    id: `snap_${now}`,
    timestamp: now,
    label: label || `Manual Checkpoint (${new Date(now).toLocaleTimeString()})`,
    description: description || "User reviewed market changes and reset the baseline reference point.",
    quotes: snapshotQuotes,
  };

  setActiveBaseline(newSnapshot);
  savedSnapshots.unshift(newSnapshot);
  if (savedSnapshots.length > 10) savedSnapshots.pop();

  const userId = req.userId || "usr_demo_1";

  // ACID transaction — all ticker prices anchored atomically
  marketRepository.anchorPortfolioBaseline(
    userId,
    newSnapshot.id,
    newSnapshot.label,
    newSnapshot.description,
    Object.entries(snapshotQuotes).map(([sym, q]) => ({ symbol: sym, price: q.price, volume: q.volume, volatility: q.volatility, timestamp: q.timestamp }))
  ).catch((err) => console.error("[DATABASE] ⚠️ Failed to commit baseline transaction:", err));

  res.json({ success: true, snapshot: newSnapshot, transactionCommitted: true });
});

// Shared handler: switch active baseline
const handleBaselineSelect = (req: Request, res: Response) => {
  const { snapshotId, offsetHours } = req.body;
  const now = Date.now();

  if (offsetHours !== undefined && typeof offsetHours === "number") {
    const simulatedTs = now - offsetHours * 3600 * 1000;
    const syntheticQuotes: Record<string, { price: number; volume: number; volatility: number; timestamp: number }> = {};

    liveQuotes.forEach((quote, sym) => {
      const variance = (Math.random() - 0.5) * 0.05 * (offsetHours / 2);
      syntheticQuotes[sym] = {
        price: Number((quote.price * (1 - variance)).toFixed(2)),
        volume: Math.round(quote.volume * Math.max(0.2, 1 - offsetHours * 0.15)),
        volatility: Number(Math.max(10, quote.volatility - offsetHours * 2).toFixed(1)),
        timestamp: simulatedTs,
      };
    });

    const newBaseline: MemoryBaselineSnapshot = {
      id: `snap_offset_${offsetHours}h_${now}`,
      timestamp: simulatedTs,
      label: `Simulated: ${offsetHours} Hours Ago`,
      description: `Fast-forward time displacement: see what changed since ${offsetHours} hours ago.`,
      quotes: syntheticQuotes,
    };

    setActiveBaseline(newBaseline);
    savedSnapshots.unshift(newBaseline);
    return res.json({ success: true, baseline: newBaseline });
  }

  if (snapshotId) {
    const found = savedSnapshots.find((s) => s.id === snapshotId);
    if (found) {
      setActiveBaseline(found);
      return res.json({ success: true, baseline: found });
    }
  }

  res.status(400).json({ error: "Invalid snapshot reference or offset" });
};

router.post("/switch-baseline", handleBaselineSelect);
router.post("/select-baseline", handleBaselineSelect);

export default router;
