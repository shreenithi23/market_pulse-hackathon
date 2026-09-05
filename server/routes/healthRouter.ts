/**
 * healthRouter.ts
 * GET /api/health          — liveness check
 * GET /api/database/stats  — SQLite schema & table counts
 */

import { Router } from "express";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    terminalEngine: "PulseWatch v2.4 (Modular Architecture)",
    uptimeSeconds: Math.floor(process.uptime()),
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY),
  });
});

router.get("/database/stats", (_req, res) => {
  try {
    const stats = marketRepository.getDbStats();
    res.json({
      success: true,
      engine: "SQLite Native (node:sqlite)",
      architecture: "Hexagonal / Repository Pattern (IMarketRepository)",
      concurrency: "Write-Ahead Logging (WAL) Mode with Foreign Keys Enabled",
      durability: "ACID Compliant with Immediate Transactions",
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to retrieve DB stats" });
  }
});

export default router;
