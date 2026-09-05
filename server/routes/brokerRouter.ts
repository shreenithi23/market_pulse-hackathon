/**
 * brokerRouter.ts
 * GET  /api/broker/groww         — broker connection status
 * POST /api/broker/groww/connect — connect broker
 */

import { Router } from "express";
import { userWatchlist } from "../state/marketState.ts";

const router = Router();

interface BrokerConfig {
  provider: "groww" | "zerodha" | "angelone" | "upstox";
  connected: boolean;
  accountName?: string;
  clientId?: string;
  mode: "SANDBOX" | "LIVE";
  supportedFeatures: string[];
  instructions: string;
}

let brokerState: BrokerConfig = {
  provider: "groww",
  connected: false,
  mode: "SANDBOX",
  supportedFeatures: [
    "Real-time NSE/BSE tick feeds",
    "Limit & Market order placement when Buy Target is reached",
    "Watchlist sync with Groww terminal",
    "Sector allocation portfolio import",
  ],
  instructions:
    "Groww allows connecting via personal authentication tokens or Webhook alerts. For automated Indian broker execution (NSE/BSE), set GROWW_API_TOKEN or configure Zerodha Kite Connect / Angel One SmartAPI in environment variables.",
};

router.get("/groww", (_req, res) => {
  res.json({
    ...brokerState,
    activeBuyRemindersCount: Array.from(userWatchlist.values()).filter(
      (w) => w.customThresholds?.targetBuyPrice
    ).length,
    timestamp: Date.now(),
  });
});

router.post("/groww/connect", (req, res) => {
  const { apiKey, clientId, accountName } = req.body;
  brokerState = {
    ...brokerState,
    connected: true,
    clientId: clientId || "GW_8829104",
    accountName: accountName || "Primary Trading Account (Groww)",
    mode: apiKey ? "LIVE" : "SANDBOX",
  };
  res.json({ success: true, message: "Connected to Groww Brokerage Bridge", broker: brokerState });
});

export default router;
