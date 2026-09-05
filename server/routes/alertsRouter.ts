/**
 * alertsRouter.ts
 * GET /api/alerts/audit — immutable audit log from SQLite
 */

import { Router } from "express";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";

const router = Router();

router.get("/audit", async (req, res) => {
  const userId = req.userId || "usr_demo_1";
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  try {
    const logs = await marketRepository.getAlertAuditLogs(userId, limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to retrieve alert audit trail" });
  }
});

export default router;
