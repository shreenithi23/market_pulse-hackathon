/**
 * server/index.ts
 * PulseWatch — Modular Microservice Entry Point
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Express App                                            │
 *   │  ├── resolveSessionUser (async DB session middleware)   │
 *   │  ├── /api/health     → healthRouter                     │
 *   │  ├── /api/database   → healthRouter                     │
 *   │  ├── /api/auth       → authRouter                       │
 *   │  ├── /api/watchlist  → watchlistRouter                  │
 *   │  ├── /api/market     → marketRouter                     │
 *   │  ├── /api/simulation → marketRouter (alias)             │
 *   │  ├── /api/memory     → memoryRouter                     │
 *   │  ├── /api/alerts     → alertsRouter                     │
 *   │  └── /api/broker     → brokerRouter                     │
 *   │                                                         │
 *   │  Services (background)                                  │
 *   │  └── tickSimulator (3s interval)                        │
 *   │                                                         │
 *   │  Persistence                                            │
 *   │  └── SqliteMarketRepository (WAL, ACID, FK ON)          │
 *   └─────────────────────────────────────────────────────────┘
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

import { PORT, NODE_ENV } from "./config/environment.ts";
import { marketRepository } from "../src/services/storage/SqliteMarketRepository.ts";
import { initializeMarketState } from "./state/marketState.ts";
import { seedInitialEvents } from "./services/eventLifecycle.ts";
import { startTickSimulator } from "./services/tickSimulator.ts";
import { resolveSessionUser } from "./middleware/authMiddleware.ts";

// Routers
import healthRouter from "./routes/healthRouter.ts";
import authRouter from "./routes/authRouter.ts";
import watchlistRouter from "./routes/watchlistRouter.ts";
import marketRouter from "./routes/marketRouter.ts";
import memoryRouter from "./routes/memoryRouter.ts";
import alertsRouter from "./routes/alertsRouter.ts";
import brokerRouter from "./routes/brokerRouter.ts";
import cors from "cors";

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();

// Enable CORS for Vercel or external clients
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true,
  credentials: true,
}));

app.use(express.json());

// Async session resolution on every request (reads from SQLite)
app.use(resolveSessionUser);

// ---------------------------------------------------------------------------
// API Routers
// ---------------------------------------------------------------------------
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/watchlist", watchlistRouter);
app.use("/api/market", marketRouter);
// Alias: /api/simulation/scenario → marketRouter (POST /simulate)
app.post("/api/simulation/scenario", (req, res) => {
  req.url = "/simulate";
  (marketRouter as any).handle(req, res, () => {});
});
app.use("/api/memory", memoryRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/broker", brokerRouter);

// Catch-all 404 for /api/* — ensures no API path returns HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------
async function startServer() {
  // 1. Initialize SQLite (WAL pragmas, schema migrations, zero-config seeding)
  await marketRepository.initialize();

  // 2. Initialize in-memory market state (quotes, watchlist, baseline)
  initializeMarketState();

  // 3. Seed initial demo events
  const now = Date.now();
  const baselineTs = now - (3 * 3600 * 1000 + 15 * 60 * 1000);
  seedInitialEvents(baselineTs, now);

  // 4. Start background tick simulator
  startTickSimulator();

  // 5. Mount Vite dev middleware or static production build
  if (NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 6. Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n[TERMINAL] 🚀 PulseWatch server initialized on http://0.0.0.0:${PORT}`);
    console.log(`[TERMINAL] 📂 Architecture: Modular Microservice (14 modules)`);
    console.log(`[TERMINAL] 🗄️  Database: SQLite WAL + ACID Transactions + Foreign Keys`);
    console.log(`[TERMINAL] 🏗️  Repository: Hexagonal Pattern (IMarketRepository)\n`);
  });
}

startServer().catch((err) => {
  console.error("[FATAL] Server startup failed:", err);
  process.exit(1);
});
