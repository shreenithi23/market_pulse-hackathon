var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express8 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/config/environment.ts
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var PORT = Number(process.env.PORT) || 3e3;
var USD_INR_EXCHANGE_RATE = 85.2;
var NODE_ENV = process.env.NODE_ENV || "development";
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1e3;

// src/services/storage/SqliteMarketRepository.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_sqlite = require("node:sqlite");
var SqliteMarketRepository = class {
  constructor(customPath) {
    this.db = null;
    const defaultPath = import_node_path.default.resolve(process.cwd(), "data", "market.db");
    const resolvedPath = customPath || process.env.DATABASE_PATH || defaultPath;
    const parentDir = import_node_path.default.dirname(resolvedPath);
    if (!import_node_fs.default.existsSync(parentDir)) {
      import_node_fs.default.mkdirSync(parentDir, { recursive: true });
    }
    this.dbPath = resolvedPath;
  }
  /**
   * Initializes SQLite connection, applies WAL pragmas, migrates tables, and seeds defaults.
   * Self-healing: if file is corrupted, re-initializes cleanly.
   */
  async initialize() {
    try {
      this.connectAndConfigure();
      this.runMigrations();
      await this.seedDefaultsIfEmpty();
      console.log(`[DATABASE] \u{1F680} SQLite connected at ${this.dbPath} (WAL mode, Foreign Keys ON)`);
    } catch (err) {
      console.error(`[DATABASE] \u26A0\uFE0F Initialization error, attempting self-healing recovery:`, err);
      this.recoverDatabase();
    }
  }
  connectAndConfigure() {
    this.db = new import_node_sqlite.DatabaseSync(this.dbPath);
    this.db.exec(`PRAGMA journal_mode = WAL`);
    this.db.exec(`PRAGMA foreign_keys = ON`);
    this.db.exec(`PRAGMA synchronous = NORMAL`);
    this.db.exec(`PRAGMA busy_timeout = 5000`);
    this.db.exec(`PRAGMA temp_store = MEMORY`);
    this.db.exec(`PRAGMA cache_size = -64000`);
  }
  recoverDatabase() {
    try {
      if (this.db) {
        try {
          this.db.close();
        } catch {
        }
      }
      const backupPath = `${this.dbPath}.corrupt_${Date.now()}.bak`;
      if (import_node_fs.default.existsSync(this.dbPath)) {
        import_node_fs.default.renameSync(this.dbPath, backupPath);
        console.log(`[DATABASE] \u{1F504} Corrupt file backed up to ${backupPath}`);
      }
      this.connectAndConfigure();
      this.runMigrations();
      this.seedDefaultsIfEmpty();
      console.log(`[DATABASE] \u2705 Self-healing recovery successful. Clean schema bootstrapped.`);
    } catch (recoveryErr) {
      console.error(`[DATABASE] \u274C Fatal recovery error:`, recoveryErr);
      throw recoveryErr;
    }
  }
  runMigrations() {
    if (!this.db) throw new Error("Database not connected");
    this.db.exec(`
      -- 1. Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        currency_preference TEXT NOT NULL DEFAULT 'INR' CHECK (currency_preference IN ('INR', 'USD')),
        risk_tolerance TEXT NOT NULL DEFAULT 'MODERATE' CHECK (risk_tolerance IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
        investment_horizon TEXT NOT NULL DEFAULT 'SWING' CHECK (investment_horizon IN ('INTRADAY', 'SWING', 'LONG_TERM')),
        default_target_buy_alert_channel TEXT NOT NULL DEFAULT 'APP_AND_EMAIL' CHECK (default_target_buy_alert_channel IN ('APP_AND_EMAIL', 'APP_ONLY')),
        groww_client_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 2. Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      -- 3. Watchlist Items table
      CREATE TABLE IF NOT EXISTS watchlist_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        user_notes TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        UNIQUE(user_id, symbol)
      );

      -- 4. Temporal Snapshot Metadata
      CREATE TABLE IF NOT EXISTS snapshot_meta (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      );

      -- 5. Baseline Snapshots ("What changed since I last checked?")
      CREATE TABLE IF NOT EXISTS baseline_snapshots (
        id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL REFERENCES snapshot_meta(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        baseline_price REAL NOT NULL,
        baseline_volume REAL NOT NULL,
        baseline_volatility REAL NOT NULL,
        snapshot_timestamp INTEGER NOT NULL,
        UNIQUE(snapshot_id, symbol)
      );

      -- 6. Alert Rules with Anti-Whipsaw Hysteresis State Machine
      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        target_buy_price REAL,
        target_buy_currency TEXT NOT NULL DEFAULT 'INR' CHECK (target_buy_currency IN ('INR', 'USD')),
        target_type TEXT NOT NULL DEFAULT 'DIP_BUY' CHECK (target_type IN ('DIP_BUY', 'BREAKOUT_BUY')),
        target_buy_active INTEGER NOT NULL DEFAULT 0,
        target_buy_triggered INTEGER NOT NULL DEFAULT 0,
        target_buy_triggered_at INTEGER,
        target_buy_note TEXT,
        price_shift_threshold REAL NOT NULL DEFAULT 2.5,
        volume_spike_threshold REAL NOT NULL DEFAULT 1.6,
        hysteresis_band_pct REAL NOT NULL DEFAULT 0.5,
        cooldown_minutes INTEGER NOT NULL DEFAULT 30,
        last_triggered_at INTEGER,
        last_triggered_price REAL,
        suppressed_oscillations_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, symbol)
      );

      -- 7. Anomaly & Alert Audit Log (Immutable append-only ledger)
      CREATE TABLE IF NOT EXISTS alert_audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_price REAL NOT NULL,
        attention_score INTEGER NOT NULL,
        message TEXT NOT NULL,
        suppressed_count INTEGER NOT NULL DEFAULT 0,
        triggered_at INTEGER NOT NULL
      );

      -- Indices for optimal lookup (hot paths)
      CREATE INDEX IF NOT EXISTS idx_watchlist_user      ON watchlist_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_wl_user_symbol      ON watchlist_items(user_id, symbol);
      CREATE INDEX IF NOT EXISTS idx_baselines_snapshot  ON baseline_snapshots(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_base_snap_sym       ON baseline_snapshots(snapshot_id, symbol);
      CREATE INDEX IF NOT EXISTS idx_rules_user_sym      ON alert_rules(user_id, symbol);
      CREATE INDEX IF NOT EXISTS idx_audit_user_time     ON alert_audit_log(user_id, triggered_at DESC);
    `);
  }
  /**
   * Prompt 2: Zero-config auto-seeding for evaluators.
   * If the database has no users, creates the default verified trader and pre-configures
   * top watchlist stocks, active dip-buy target reminders, and initial memory baselines.
   */
  async seedDefaultsIfEmpty() {
    if (!this.db) return;
    const countStmt = this.db.prepare("SELECT COUNT(*) as cnt FROM users");
    const res = countStmt.get();
    if (res && res.cnt > 0) {
      return;
    }
    console.log("[DATABASE] \u{1F4E6} Database is empty. Running zero-config bootstrap seeding...");
    const now = Date.now();
    const demoUserId = "usr_demo_1";
    const insertUser = this.db.prepare(`
      INSERT INTO users (
        id, email, name, avatar_url, password_hash, password_salt,
        email_verified, currency_preference, risk_tolerance,
        investment_horizon, default_target_buy_alert_channel,
        groww_client_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
      demoUserId,
      "trader@marketradar.io",
      "Arjun Mehta",
      null,
      "d5a4980753d10008b8849bca0ffb4a625fdfd1be0f7a77d540248c8b18408f65",
      // demo hash for "password123"
      "demo_salt_998124",
      1,
      // verified
      "INR",
      "MODERATE",
      "SWING",
      "APP_AND_EMAIL",
      "GW_8829104",
      now - 30 * 24 * 3600 * 1e3,
      now
    );
    const defaultTickers = [
      { symbol: "RELIANCE", name: "Reliance Industries Ltd.", sector: "Energy / Conglomerate" },
      { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT Services" },
      { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", sector: "Banking & Financials" },
      { symbol: "INFY", name: "Infosys Ltd.", sector: "IT Services" },
      { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Semiconductors" },
      { symbol: "TSLA", name: "Tesla, Inc.", sector: "Automotive / AI" },
      { symbol: "AAPL", name: "Apple Inc.", sector: "Consumer Tech" },
      { symbol: "MSFT", name: "Microsoft Corporation", sector: "Cloud / Software" },
      { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
      { symbol: "COIN", name: "Coinbase Global, Inc.", sector: "Crypto Infrastructure" }
    ];
    const insertWatchlist = this.db.prepare(`
      INSERT INTO watchlist_items (id, user_id, symbol, name, sector, added_at, user_notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of defaultTickers) {
      insertWatchlist.run(
        `wl_${item.symbol}_${now}`,
        demoUserId,
        item.symbol,
        item.name,
        item.sector,
        now - 7 * 24 * 3600 * 1e3,
        item.symbol === "NVDA" ? "Core AI holding. Monitoring $126 breakout level." : "",
        JSON.stringify(item.symbol === "NVDA" || item.symbol === "AMD" ? ["AI_CORE", "SEMIS"] : ["CORE"])
      );
    }
    const insertAlertRule = this.db.prepare(`
      INSERT INTO alert_rules (
        id, user_id, symbol, target_buy_price, target_buy_currency,
        target_type, target_buy_active, target_buy_triggered, target_buy_triggered_at,
        target_buy_note, price_shift_threshold, volume_spike_threshold,
        hysteresis_band_pct, cooldown_minutes, last_triggered_at,
        last_triggered_price, suppressed_oscillations_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAlertRule.run(
      `rule_NVDA_${now}`,
      demoUserId,
      "NVDA",
      11200,
      "INR",
      "DIP_BUY",
      1,
      1,
      now - 18 * 60 * 1e3,
      "Dip Buy Target: Alert when price is below \u20B911,200",
      3,
      2,
      0.5,
      30,
      now - 18 * 60 * 1e3,
      10948,
      3
    );
    insertAlertRule.run(
      `rule_AAPL_${now}`,
      demoUserId,
      "AAPL",
      18500,
      "INR",
      "DIP_BUY",
      1,
      0,
      null,
      "Dip Alert: Notify when price falls to \u20B918,500 target",
      2,
      1.5,
      0.5,
      30,
      null,
      null,
      0
    );
    const initialSnapshotId = "snap_auto_last_session";
    const baselineTimestamp = now - (3 * 3600 * 1e3 + 15 * 60 * 1e3);
    const insertMeta = this.db.prepare(`
      INSERT INTO snapshot_meta (id, user_id, label, description, timestamp, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    insertMeta.run(
      initialSnapshotId,
      demoUserId,
      "Previous Visit (3h 15m ago)",
      "Automatic snapshot from your previous active trading terminal session.",
      baselineTimestamp
    );
    const initialQuotes = {
      RELIANCE: { price: 2980.5, volume: 32e5, volatility: 18.2 },
      TCS: { price: 4185, volume: 14e5, volatility: 16.5 },
      HDFCBANK: { price: 1642, volume: 85e5, volatility: 19.1 },
      INFY: { price: 1820, volume: 29e5, volatility: 21 },
      NVDA: { price: 122.6, volume: 28e6, volatility: 34 },
      TSLA: { price: 218.4, volume: 35e6, volatility: 42.5 },
      AAPL: { price: 221.8, volume: 22e6, volatility: 20 },
      MSFT: { price: 442.1, volume: 11e6, volatility: 19.5 },
      AMD: { price: 151.2, volume: 18e6, volatility: 36.2 },
      COIN: { price: 214.5, volume: 75e5, volatility: 52 }
    };
    const insertBaseline = this.db.prepare(`
      INSERT INTO baseline_snapshots (id, snapshot_id, user_id, symbol, baseline_price, baseline_volume, baseline_volatility, snapshot_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [sym, q] of Object.entries(initialQuotes)) {
      insertBaseline.run(
        `base_${initialSnapshotId}_${sym}`,
        initialSnapshotId,
        demoUserId,
        sym,
        q.price,
        q.volume,
        q.volatility,
        baselineTimestamp
      );
    }
    const insertAudit = this.db.prepare(`
      INSERT INTO alert_audit_log (id, user_id, symbol, trigger_type, trigger_price, attention_score, message, suppressed_count, triggered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(
      `aud_1_${now}`,
      demoUserId,
      "NVDA",
      "BUY_TARGET_REACHED",
      10948,
      88,
      "NVDA breached target buy threshold of \u20B911,200.00 (Current: \u20B910,948.00). Anti-whipsaw cooldown active.",
      3,
      now - 18 * 60 * 1e3
    );
    console.log("[DATABASE] \u2705 Zero-config default seeding complete.");
  }
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  getDbStats() {
    if (!this.db) throw new Error("Database not initialized");
    const pragmaRes = this.db.prepare("PRAGMA journal_mode").get();
    const tables = ["users", "sessions", "watchlist_items", "snapshot_meta", "baseline_snapshots", "alert_rules", "alert_audit_log"];
    const tableCounts = {};
    for (const table of tables) {
      try {
        const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
        tableCounts[table] = row.cnt;
      } catch {
        tableCounts[table] = 0;
      }
    }
    return {
      path: this.dbPath,
      journalMode: pragmaRes?.journal_mode || "wal",
      tableCounts
    };
  }
  // --- Users & Authentication ---
  async getUserByEmail(email) {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
    const row = stmt.get(email);
    return row ? this.mapUserRow(row) : null;
  }
  async getUserById(id) {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    const row = stmt.get(id);
    return row ? this.mapUserRow(row) : null;
  }
  async upsertUser(user) {
    if (!this.db) throw new Error("Database not connected");
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, email, name, avatar_url, password_hash, password_salt,
        email_verified, currency_preference, risk_tolerance,
        investment_horizon, default_target_buy_alert_channel,
        groww_client_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt,
        email_verified = excluded.email_verified,
        currency_preference = excluded.currency_preference,
        risk_tolerance = excluded.risk_tolerance,
        investment_horizon = excluded.investment_horizon,
        default_target_buy_alert_channel = excluded.default_target_buy_alert_channel,
        groww_client_id = excluded.groww_client_id,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      user.id,
      user.email.toLowerCase(),
      user.name,
      user.avatarUrl || null,
      user.passwordHash,
      user.passwordSalt,
      user.emailVerified ? 1 : 0,
      user.currencyPreference,
      user.riskTolerance,
      user.investmentHorizon,
      user.defaultTargetBuyAlertChannel,
      user.growwClientId || null,
      user.createdAt,
      user.updatedAt
    );
  }
  async createSession(token, userId, expiresAt) {
    if (!this.db) throw new Error("Database not connected");
    const stmt = this.db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(token, userId, Date.now(), expiresAt);
  }
  async getSessionUserId(token) {
    if (!this.db) return null;
    const stmt = this.db.prepare(`
      SELECT user_id, expires_at FROM sessions WHERE token = ?
    `);
    const row = stmt.get(token);
    if (!row) return null;
    if (Date.now() > row.expires_at) {
      this.deleteSession(token);
      return null;
    }
    return row.user_id;
  }
  async deleteSession(token) {
    if (!this.db) return;
    const stmt = this.db.prepare("DELETE FROM sessions WHERE token = ?");
    stmt.run(token);
  }
  mapUserRow(row) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url || void 0,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      emailVerified: Boolean(row.email_verified),
      currencyPreference: row.currency_preference,
      riskTolerance: row.risk_tolerance,
      investmentHorizon: row.investment_horizon,
      defaultTargetBuyAlertChannel: row.default_target_buy_alert_channel,
      growwClientId: row.groww_client_id || void 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  // --- Watchlist Management ---
  async getWatchlist(userId) {
    if (!this.db) return [];
    const stmt = this.db.prepare("SELECT * FROM watchlist_items WHERE user_id = ? ORDER BY added_at DESC");
    const rows = stmt.all(userId);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      symbol: r.symbol,
      name: r.name,
      sector: r.sector,
      addedAt: r.added_at,
      userNotes: r.user_notes || "",
      tags: JSON.parse(r.tags || "[]")
    }));
  }
  async addWatchlistItem(item) {
    if (!this.db) throw new Error("Database not connected");
    const stmt = this.db.prepare(`
      INSERT INTO watchlist_items (id, user_id, symbol, name, sector, added_at, user_notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, symbol) DO UPDATE SET
        name = excluded.name,
        sector = excluded.sector,
        user_notes = excluded.user_notes,
        tags = excluded.tags
    `);
    stmt.run(
      item.id,
      item.userId,
      item.symbol.toUpperCase(),
      item.name,
      item.sector,
      item.addedAt,
      item.userNotes || "",
      JSON.stringify(item.tags || [])
    );
  }
  async removeWatchlistItem(userId, symbol) {
    if (!this.db) return false;
    const stmt = this.db.prepare("DELETE FROM watchlist_items WHERE user_id = ? AND symbol = ?");
    const info = stmt.run(userId, symbol.toUpperCase());
    return Boolean(info.changes && info.changes > 0);
  }
  // --- Alert Rules & Anti-Whipsaw State Machine ---
  async getAlertRule(userId, symbol) {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT * FROM alert_rules WHERE user_id = ? AND symbol = ?");
    const row = stmt.get(userId, symbol.toUpperCase());
    return row ? this.mapAlertRuleRow(row) : null;
  }
  async getAllAlertRules(userId) {
    if (!this.db) return [];
    const stmt = this.db.prepare("SELECT * FROM alert_rules WHERE user_id = ?");
    const rows = stmt.all(userId);
    return rows.map((r) => this.mapAlertRuleRow(r));
  }
  async saveAlertRule(rule) {
    if (!this.db) throw new Error("Database not connected");
    const stmt = this.db.prepare(`
      INSERT INTO alert_rules (
        id, user_id, symbol, target_buy_price, target_buy_currency,
        target_type, target_buy_active, target_buy_triggered, target_buy_triggered_at,
        target_buy_note, price_shift_threshold, volume_spike_threshold,
        hysteresis_band_pct, cooldown_minutes, last_triggered_at,
        last_triggered_price, suppressed_oscillations_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, symbol) DO UPDATE SET
        target_buy_price = excluded.target_buy_price,
        target_buy_currency = excluded.target_buy_currency,
        target_type = excluded.target_type,
        target_buy_active = excluded.target_buy_active,
        target_buy_triggered = excluded.target_buy_triggered,
        target_buy_triggered_at = excluded.target_buy_triggered_at,
        target_buy_note = excluded.target_buy_note,
        price_shift_threshold = excluded.price_shift_threshold,
        volume_spike_threshold = excluded.volume_spike_threshold,
        hysteresis_band_pct = excluded.hysteresis_band_pct,
        cooldown_minutes = excluded.cooldown_minutes,
        last_triggered_at = excluded.last_triggered_at,
        last_triggered_price = excluded.last_triggered_price,
        suppressed_oscillations_count = excluded.suppressed_oscillations_count
    `);
    stmt.run(
      rule.id,
      rule.userId,
      rule.symbol.toUpperCase(),
      rule.targetBuyPrice !== void 0 ? rule.targetBuyPrice : null,
      rule.targetBuyCurrency,
      rule.targetType,
      rule.targetBuyActive ? 1 : 0,
      rule.targetBuyTriggered ? 1 : 0,
      rule.targetBuyTriggeredAt || null,
      rule.targetBuyNote || null,
      rule.priceShiftThreshold,
      rule.volumeSpikeThreshold,
      rule.hysteresisBandPct,
      rule.cooldownMinutes,
      rule.lastTriggeredAt || null,
      rule.lastTriggeredPrice !== void 0 ? rule.lastTriggeredPrice : null,
      rule.suppressedOscillationsCount || 0
    );
  }
  async deleteAlertRule(userId, symbol) {
    if (!this.db) return false;
    const stmt = this.db.prepare("DELETE FROM alert_rules WHERE user_id = ? AND symbol = ?");
    const info = stmt.run(userId, symbol.toUpperCase());
    return Boolean(info.changes && info.changes > 0);
  }
  async recordSuppressedOscillation(userId, symbol) {
    if (!this.db) return 0;
    const stmt = this.db.prepare(`
      UPDATE alert_rules
      SET suppressed_oscillations_count = suppressed_oscillations_count + 1
      WHERE user_id = ? AND symbol = ?
      RETURNING suppressed_oscillations_count
    `);
    const row = stmt.get(userId, symbol.toUpperCase());
    return row?.suppressed_oscillations_count || 0;
  }
  mapAlertRuleRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      targetBuyPrice: row.target_buy_price !== null ? row.target_buy_price : void 0,
      targetBuyCurrency: row.target_buy_currency,
      targetType: row.target_type,
      targetBuyActive: Boolean(row.target_buy_active),
      targetBuyTriggered: Boolean(row.target_buy_triggered),
      targetBuyTriggeredAt: row.target_buy_triggered_at || void 0,
      targetBuyNote: row.target_buy_note || void 0,
      priceShiftThreshold: row.price_shift_threshold,
      volumeSpikeThreshold: row.volume_spike_threshold,
      hysteresisBandPct: row.hysteresis_band_pct,
      cooldownMinutes: row.cooldown_minutes,
      lastTriggeredAt: row.last_triggered_at || void 0,
      lastTriggeredPrice: row.last_triggered_price !== null ? row.last_triggered_price : void 0,
      suppressedOscillationsCount: row.suppressed_oscillations_count || 0
    };
  }
  // --- Prompt 4: Atomic ACID Transactions for Portfolio Baseline Snapshots ---
  /**
   * Atomically snapshots the entire portfolio inside an ACID transaction.
   * If any single insert fails, the transaction immediately rolls back,
   * guaranteeing baseline consistency without partial-write corruption.
   */
  async anchorPortfolioBaseline(userId, snapshotId, label, description, quotes) {
    if (!this.db) throw new Error("Database not connected");
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE snapshot_meta SET is_active = 0 WHERE user_id = ?").run(userId);
      const metaStmt = this.db.prepare(`
        INSERT INTO snapshot_meta (id, user_id, label, description, timestamp, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      metaStmt.run(snapshotId, userId, label, description, now);
      const quoteStmt = this.db.prepare(`
        INSERT INTO baseline_snapshots (
          id, snapshot_id, user_id, symbol, baseline_price, baseline_volume, baseline_volatility, snapshot_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const q of quotes) {
        quoteStmt.run(
          `base_${snapshotId}_${q.symbol}`,
          snapshotId,
          userId,
          q.symbol.toUpperCase(),
          q.price,
          q.volume,
          q.volatility,
          now
        );
      }
      const auditStmt = this.db.prepare(`
        INSERT INTO alert_audit_log (
          id, user_id, symbol, trigger_type, trigger_price, attention_score, message, suppressed_count, triggered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      auditStmt.run(
        `aud_snap_${now}`,
        userId,
        "PORTFOLIO",
        "BASELINE_RESET_TRANSACTION",
        quotes.reduce((acc, curr) => acc + curr.price, 0),
        0,
        `Atomic transaction completed: Anchored new memory baseline "${label}" across ${quotes.length} portfolio tickers.`,
        0,
        now
      );
      this.db.exec("COMMIT");
      console.log(`[DATABASE] \u{1F512} ACID Transaction committed: Snapshot ${snapshotId} (${quotes.length} tickers)`);
      return {
        snapshotId,
        timestamp: now,
        tickerCount: quotes.length
      };
    } catch (txError) {
      this.db.exec("ROLLBACK");
      console.error("[DATABASE] \u26A0\uFE0F ACID Transaction rolled back due to error:", txError);
      throw txError;
    }
  }
  async getActiveBaseline(userId) {
    if (!this.db) return { meta: null, quotes: {} };
    const metaRow = this.db.prepare(`
      SELECT * FROM snapshot_meta WHERE user_id = ? AND is_active = 1 ORDER BY timestamp DESC LIMIT 1
    `).get(userId);
    if (!metaRow) return { meta: null, quotes: {} };
    const meta = {
      id: metaRow.id,
      userId: metaRow.user_id,
      label: metaRow.label,
      description: metaRow.description,
      timestamp: metaRow.timestamp,
      isActive: Boolean(metaRow.is_active)
    };
    const quoteRows = this.db.prepare(`
      SELECT * FROM baseline_snapshots WHERE snapshot_id = ?
    `).all(metaRow.id);
    const quotes = {};
    for (const r of quoteRows) {
      quotes[r.symbol] = {
        symbol: r.symbol,
        price: r.baseline_price,
        volume: r.baseline_volume,
        volatility: r.baseline_volatility,
        timestamp: r.snapshot_timestamp
      };
    }
    return { meta, quotes };
  }
  async getAllSnapshots(userId) {
    if (!this.db) return [];
    const rows = this.db.prepare(`
      SELECT * FROM snapshot_meta WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20
    `).all(userId);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      label: r.label,
      description: r.description,
      timestamp: r.timestamp,
      isActive: Boolean(r.is_active)
    }));
  }
  async setActiveSnapshot(userId, snapshotId) {
    if (!this.db) return false;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE snapshot_meta SET is_active = 0 WHERE user_id = ?").run(userId);
      const res = this.db.prepare("UPDATE snapshot_meta SET is_active = 1 WHERE user_id = ? AND id = ?").run(userId, snapshotId);
      this.db.exec("COMMIT");
      return Boolean(res.changes && res.changes > 0);
    } catch (err) {
      this.db.exec("ROLLBACK");
      return false;
    }
  }
  // --- Prompt 5: Anomaly & Alert Audit Trail ---
  async recordAlertAudit(log) {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO alert_audit_log (
        id, user_id, symbol, trigger_type, trigger_price, attention_score, message, suppressed_count, triggered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      log.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      log.userId,
      log.symbol.toUpperCase(),
      log.triggerType,
      log.triggerPrice,
      log.attentionScore,
      log.message,
      log.suppressedCount || 0,
      log.triggeredAt || Date.now()
    );
  }
  async getAlertAuditLogs(userId, limit = 50) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT * FROM alert_audit_log WHERE user_id = ? ORDER BY triggered_at DESC LIMIT ?
    `);
    const rows = stmt.all(userId, limit);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      symbol: r.symbol,
      triggerType: r.trigger_type,
      triggerPrice: r.trigger_price,
      attentionScore: r.attention_score,
      message: r.message,
      suppressedCount: r.suppressed_count || 0,
      triggeredAt: r.triggered_at
    }));
  }
};
var marketRepository = new SqliteMarketRepository();

// server/data/stockUniverse.ts
var STOCK_UNIVERSE = [
  // --- Semiconductors & Hardware ---
  { symbol: "NVDA", name: "NVIDIA Corp", sector: "Semiconductors", basePrice: 128.5, avgVolume: 52e6, beta: 1.85, currency: "USD", marketCapTier: "MEGA", peRatio: 48.2, whyPick: "Dominant AI accelerator platform with 88% data center GPU market share." },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors", basePrice: 154.6, avgVolume: 38e6, beta: 1.75, currency: "USD", marketCapTier: "LARGE", peRatio: 42.1, whyPick: "High-growth MI300 architecture challenging enterprise cloud space." },
  { symbol: "TSM", name: "Taiwan Semiconductor", sector: "Semiconductors", basePrice: 172.4, avgVolume: 22e6, beta: 1.25, currency: "USD", marketCapTier: "MEGA", peRatio: 26.4, whyPick: "Global foundry leader manufacturing 90% of advanced sub-5nm chips." },
  // --- Cloud & Enterprise Software ---
  { symbol: "MSFT", name: "Microsoft Corp", sector: "Cloud/Software", basePrice: 442.8, avgVolume: 21e6, beta: 1.12, currency: "USD", marketCapTier: "MEGA", peRatio: 35.8, whyPick: "Azure cloud compounding revenue with OpenAI Copilot integration." },
  { symbol: "PLTR", name: "Palantir Tech", sector: "Cloud/Software", basePrice: 31.25, avgVolume: 42e6, beta: 2.05, currency: "USD", marketCapTier: "LARGE", peRatio: 88, whyPick: "AIP commercial adoption expanding institutional enterprise contracts." },
  { symbol: "INFY", name: "Infosys Ltd", sector: "Cloud/Software", basePrice: 1820, avgVolume: 85e5, beta: 0.82, currency: "INR", marketCapTier: "LARGE", peRatio: 26.5, whyPick: "Tier-1 Indian IT services leader with steady dividend payout and enterprise cloud digital transformation." },
  // --- Consumer Tech & Digital Media ---
  { symbol: "AAPL", name: "Apple Inc", sector: "Consumer Tech", basePrice: 224.2, avgVolume: 48e6, beta: 1.05, currency: "USD", marketCapTier: "MEGA", peRatio: 33.5, whyPick: "Unrivaled global ecosystem with 2.2B active hardware devices generating high-margin services." },
  { symbol: "AMZN", name: "Amazon.com Inc", sector: "Consumer Tech", basePrice: 186.3, avgVolume: 31e6, beta: 1.25, currency: "USD", marketCapTier: "MEGA", peRatio: 41.2, whyPick: "AWS cloud reacceleration and high-margin retail advertising engine." },
  { symbol: "GOOGL", name: "Alphabet Inc", sector: "Digital Media", basePrice: 178.1, avgVolume: 24e6, beta: 1.15, currency: "USD", marketCapTier: "MEGA", peRatio: 24.1, whyPick: "Search monopoly economics paired with Gemini multi-modal infrastructure growth." },
  { symbol: "META", name: "Meta Platforms", sector: "Digital Media", basePrice: 512, avgVolume: 16e6, beta: 1.35, currency: "USD", marketCapTier: "MEGA", peRatio: 27.6, whyPick: "Unmatched social attention monetization and open-source Llama AI ecosystem." },
  // --- Automotive / Clean EV ---
  { symbol: "TSLA", name: "Tesla Inc", sector: "Automotive/EV", basePrice: 218.4, avgVolume: 65e6, beta: 2.1, currency: "USD", marketCapTier: "MEGA", peRatio: 64, whyPick: "Market leader in autonomous robotaxi compute, energy storage, and EV manufacturing scale." },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automotive/EV", basePrice: 1045, avgVolume: 14e6, beta: 1.18, currency: "INR", marketCapTier: "LARGE", peRatio: 16.8, whyPick: "India's #1 passenger EV brand plus high-margin JLR luxury international turnaround." },
  // --- Financials & Banking ---
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", basePrice: 1642, avgVolume: 18e6, beta: 0.76, currency: "INR", marketCapTier: "MEGA", peRatio: 18.2, whyPick: "India's premier private banking powerhouse; ideal defensive stabilizer with low credit delinquency." },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", basePrice: 214.9, avgVolume: 11e6, beta: 0.95, currency: "USD", marketCapTier: "MEGA", peRatio: 12.4, whyPick: "Fortress balance sheet, $4T assets, and dominant global net interest margin leader." },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", basePrice: 1228, avgVolume: 15e6, beta: 0.85, currency: "INR", marketCapTier: "LARGE", peRatio: 17.5, whyPick: "Best-in-class return on assets (RoA > 2.3%) and strong retail underwriting franchise." },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", basePrice: 39.4, avgVolume: 35e6, beta: 1.1, currency: "USD", marketCapTier: "LARGE", peRatio: 13.8, whyPick: "Massive consumer deposit base benefiting from durable interest rate environments." },
  // --- Healthcare & Pharmaceuticals ---
  { symbol: "LLY", name: "Eli Lilly & Co", sector: "Healthcare", basePrice: 948, avgVolume: 32e5, beta: 0.78, currency: "USD", marketCapTier: "MEGA", peRatio: 65, whyPick: "Revolutionary GLP-1 metabolic health portfolio with high defensive patent protection." },
  { symbol: "SUNPHARMA", name: "Sun Pharma", sector: "Healthcare", basePrice: 1785, avgVolume: 45e5, beta: 0.62, currency: "INR", marketCapTier: "LARGE", peRatio: 34, whyPick: "Top Indian pharma multinational with high specialty dermatology & oncology margins." },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", basePrice: 564.5, avgVolume: 38e5, beta: 0.65, currency: "USD", marketCapTier: "MEGA", peRatio: 22.8, whyPick: "Healthcare provider with non-correlated premium cash flows and consistent dividend growth." },
  // --- Energy & Natural Resources ---
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", basePrice: 2980, avgVolume: 92e5, beta: 0.88, currency: "INR", marketCapTier: "MEGA", peRatio: 27.2, whyPick: "India's highest-valued conglomerate uniting oil-to-chemicals, Jio 5G telecom, and retail." },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", basePrice: 116.8, avgVolume: 14e6, beta: 0.85, currency: "USD", marketCapTier: "MEGA", peRatio: 14.1, whyPick: "Low break-even barrels in Permian/Guyana with aggressive shareholder buybacks." },
  { symbol: "CVX", name: "Chevron Corp", sector: "Energy", basePrice: 148.2, avgVolume: 85e5, beta: 0.88, currency: "USD", marketCapTier: "LARGE", peRatio: 13.9, whyPick: "Capital-efficient upstream portfolio yielding 4.2% dividend yield." },
  // --- Consumer Staples & FMCG ---
  { symbol: "ITC", name: "ITC Limited", sector: "Consumer Staples", basePrice: 492, avgVolume: 16e6, beta: 0.55, currency: "INR", marketCapTier: "LARGE", peRatio: 27.8, whyPick: "Tremendous cash machine with 3.8% dividend yield and ultra-low beta (0.55) downside buffer." },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", basePrice: 168.5, avgVolume: 62e5, beta: 0.54, currency: "USD", marketCapTier: "MEGA", peRatio: 26.2, whyPick: "Essential household consumer brand with 67 consecutive years of dividend increases." },
  // --- Crypto / Fintech ---
  { symbol: "COIN", name: "Coinbase Global", sector: "Crypto/Fintech", basePrice: 228.7, avgVolume: 12e6, beta: 2.6, currency: "USD", marketCapTier: "LARGE", peRatio: 38, whyPick: "Pure-play institutional crypto exchange with Ethereum L2 Base transaction growth." }
];

// server/state/marketState.ts
var liveQuotes = /* @__PURE__ */ new Map();
var userWatchlist = /* @__PURE__ */ new Map();
var activeBaseline;
function setActiveBaseline(snap) {
  activeBaseline = snap;
}
var savedSnapshots = [];
var activeEvents = /* @__PURE__ */ new Map();
var conflictsResolvedCounter = 12;
var feedStatus = "LIVE";
var feedLatency = 24;
function setFeedStatus(s, latency) {
  feedStatus = s;
  feedLatency = latency;
}
function incrementConflicts(n) {
  conflictsResolvedCounter += n;
}
function initializeMarketState() {
  const now = Date.now();
  STOCK_UNIVERSE.forEach((seed) => {
    const spread = Math.random() * 0.04 - 0.02;
    const currentPrice = Number((seed.basePrice * (1 + spread)).toFixed(2));
    const dayChange = Number((currentPrice - seed.basePrice).toFixed(2));
    const dayChangePct = Number((dayChange / seed.basePrice * 100).toFixed(2));
    const volumeMultiplier = 0.8 + Math.random() * 0.7;
    const volume = Math.round(seed.avgVolume * volumeMultiplier);
    const volatility = Number((18 + Math.random() * 20 * seed.beta).toFixed(1));
    const ticks = [];
    let p = seed.basePrice;
    for (let i = 9; i >= 0; i--) {
      p += (Math.random() - 0.49) * (seed.basePrice * 8e-3);
      ticks.push({
        time: new Date(now - i * 3 * 60 * 1e3).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }),
        price: Number(p.toFixed(2)),
        volume: Math.round(volume / 10 * (0.8 + Math.random() * 0.4))
      });
    }
    const currency = seed.currency || "USD";
    const priceINR = currency === "INR" ? currentPrice : Number((currentPrice * USD_INR_EXCHANGE_RATE).toFixed(2));
    liveQuotes.set(seed.symbol, {
      symbol: seed.symbol,
      name: seed.name,
      sector: seed.sector,
      price: currentPrice,
      currency,
      priceINR,
      change: dayChange,
      changePct: dayChangePct,
      volume,
      avgVolume: seed.avgVolume,
      volatility,
      dayHigh: Number((Math.max(currentPrice, seed.basePrice) * 1.01).toFixed(2)),
      dayLow: Number((Math.min(currentPrice, seed.basePrice) * 0.99).toFixed(2)),
      high52: Number((seed.basePrice * 1.35).toFixed(2)),
      low52: Number((seed.basePrice * 0.75).toFixed(2)),
      lastUpdated: now,
      ticks
    });
  });
  const defaultSymbols = ["NVDA", "TSLA", "AAPL", "MSFT", "AMD", "COIN", "XOM", "JPM"];
  defaultSymbols.forEach((sym) => {
    const customThresholds = {
      priceChangePct: sym === "NVDA" || sym === "TSLA" ? 3 : 2,
      volumeMultiplier: sym === "COIN" ? 2 : 1.5,
      volatilityJumpPct: 20
    };
    if (sym === "NVDA") {
      customThresholds.targetBuyPrice = 11200;
      customThresholds.targetBuyCurrency = "INR";
      customThresholds.targetBuyActive = true;
      customThresholds.targetBuyTriggered = true;
      customThresholds.targetBuyTriggeredAt = now - 18 * 60 * 1e3;
      customThresholds.targetBuyNote = "Dip Buy Target: Alert when price is below \u20B911,200";
    } else if (sym === "AAPL") {
      customThresholds.targetBuyPrice = 18500;
      customThresholds.targetBuyCurrency = "INR";
      customThresholds.targetBuyActive = true;
      customThresholds.targetBuyTriggered = false;
      customThresholds.targetBuyNote = "Dip Alert: Notify when price falls to \u20B918,500 target";
    }
    userWatchlist.set(sym, {
      symbol: sym,
      addedAt: now - 864e5 * 7,
      customThresholds,
      tags: sym === "NVDA" || sym === "AMD" ? ["AI_CORE", "SEMIS"] : ["CORE"]
    });
  });
  const baselineTimestamp = now - (3 * 3600 * 1e3 + 15 * 60 * 1e3);
  const baselineQuotes = {};
  liveQuotes.forEach((quote, sym) => {
    let baselinePrice = quote.price;
    let baselineVol = Math.round(quote.volume * 0.45);
    let baselineVolatility = quote.volatility;
    if (sym === "NVDA") {
      baselinePrice = Number((quote.price / 1.048).toFixed(2));
      baselineVol = Math.round(quote.avgVolume * 0.35);
      baselineVolatility = quote.volatility - 8.5;
    } else if (sym === "TSLA") {
      baselinePrice = Number((quote.price * 1.032).toFixed(2));
      baselineVol = Math.round(quote.avgVolume * 0.4);
    } else if (sym === "AMD") {
      baselinePrice = Number((quote.price / 1.031).toFixed(2));
    } else if (sym === "COIN") {
      baselineVolatility = quote.volatility - 14;
    }
    baselineQuotes[sym] = {
      price: baselinePrice,
      volume: baselineVol,
      volatility: baselineVolatility,
      timestamp: baselineTimestamp
    };
  });
  activeBaseline = {
    id: "snap_auto_last_session",
    timestamp: baselineTimestamp,
    label: "Previous Visit (3h 15m ago)",
    description: "Automatic snapshot from your previous active trading terminal session.",
    quotes: baselineQuotes
  };
  savedSnapshots.push(activeBaseline);
}

// server/services/eventLifecycle.ts
function seedInitialEvents(baselineTs, now) {
  const nvdaEvent = {
    id: "evt_nvda_surge_01",
    symbol: "NVDA",
    sector: "Semiconductors",
    scope: "STOCK_SPECIFIC",
    title: "AI Chip Demand Acceleration Breakout",
    summary: "NVDA surged +4.8% on heavy volume (2.4x standard velocity) breaking above the $126 resistance level.",
    currentState: "ESCALATED",
    severity: "HIGH",
    detectedAt: baselineTs + 45 * 60 * 1e3,
    lastTransitionAt: now - 20 * 60 * 1e3,
    peakDeviationPct: 5.2,
    currentDeviationPct: 4.8,
    volumeMultiple: 2.4,
    signalsInvolved: ["PRICE_MOVE", "VOLUME_SPIKE", "THRESHOLD_BREACH"],
    stateHistory: [
      { state: "DEVELOPING", timestamp: baselineTs + 45 * 60 * 1e3, metricSummary: "+1.8% at 1.3x vol", reason: "Unusual morning block buyer detected" },
      { state: "ESCALATED", timestamp: now - 20 * 60 * 1e3, metricSummary: "+5.2% peak at 2.4x vol", reason: "Breached user defined 3.0% threshold and $126 resistance" }
    ]
  };
  const semiEvent = {
    id: "evt_sector_semis_01",
    symbol: "SEMIS_INDEX",
    sector: "Semiconductors",
    scope: "SECTOR_WIDE",
    title: "Semiconductor Sector Coordinated Outperformance",
    summary: "Broad-based rally across chipmakers: NVDA (+4.8%) and AMD (+3.1%) moving synchronously with 82% correlation coefficient.",
    currentState: "DEVELOPING",
    severity: "MEDIUM",
    detectedAt: baselineTs + 90 * 60 * 1e3,
    lastTransitionAt: now - 35 * 60 * 1e3,
    peakDeviationPct: 4,
    currentDeviationPct: 3.9,
    volumeMultiple: 1.9,
    signalsInvolved: ["SECTOR_CORRELATION", "PRICE_MOVE"],
    stateHistory: [
      { state: "DEVELOPING", timestamp: baselineTs + 90 * 60 * 1e3, metricSummary: "Avg sector delta +2.8%", reason: "7 of 8 tracked hardware names advancing in tandem" }
    ]
  };
  const tslaEvent = {
    id: "evt_tsla_recovery_01",
    symbol: "TSLA",
    sector: "Automotive/EV",
    scope: "STOCK_SPECIFIC",
    title: "Intraday Liquidity Dip Mean Reversion",
    summary: "TSLA dropped -3.2% early session to $212 support, currently rebounding back to $218 with normalizing order flow.",
    currentState: "RECOVERING",
    severity: "MEDIUM",
    detectedAt: baselineTs + 30 * 60 * 1e3,
    lastTransitionAt: now - 15 * 60 * 1e3,
    peakDeviationPct: -3.6,
    currentDeviationPct: -1.2,
    volumeMultiple: 1.6,
    signalsInvolved: ["VOLATILITY_EXPANSION", "PRICE_MOVE"],
    stateHistory: [
      { state: "DEVELOPING", timestamp: baselineTs + 30 * 60 * 1e3, metricSummary: "-1.5% opening drift", reason: "Broad market futures opening weakness" },
      { state: "ESCALATED", timestamp: baselineTs + 75 * 60 * 1e3, metricSummary: "-3.6% intraday low at $211.50", reason: "Options gamma rebalancing selloff" },
      { state: "RECOVERING", timestamp: now - 15 * 60 * 1e3, metricSummary: "-1.2% rebounding to $218.40", reason: "Dip buyers absorbing liquidity at 200 EMA" }
    ]
  };
  activeEvents.set(nvdaEvent.id, nvdaEvent);
  activeEvents.set(semiEvent.id, semiEvent);
  activeEvents.set(tslaEvent.id, tslaEvent);
}
function updateEventLifecycle(now) {
  activeEvents.forEach((evt) => {
    const quote = liveQuotes.get(evt.symbol);
    if (!quote) return;
    const baseline = activeBaseline?.quotes[evt.symbol];
    if (!baseline) return;
    const deltaPct = Number(((quote.price - baseline.price) / baseline.price * 100).toFixed(2));
    evt.currentDeviationPct = deltaPct;
    if (Math.abs(deltaPct) > Math.abs(evt.peakDeviationPct)) {
      evt.peakDeviationPct = deltaPct;
    }
    evt.volumeMultiple = Number((quote.volume / quote.avgVolume).toFixed(2));
    const timeInCurrentState = now - evt.lastTransitionAt;
    if (evt.currentState === "DEVELOPING") {
      if (Math.abs(deltaPct) >= 3 || evt.volumeMultiple >= 2) {
        evt.currentState = "ESCALATED";
        evt.severity = "CRITICAL";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "ESCALATED",
          timestamp: now,
          metricSummary: `Deviation amplified to ${deltaPct > 0 ? "+" : ""}${deltaPct}% at ${evt.volumeMultiple}x volume`,
          reason: "Signal intensity crossed secondary threshold; momentum expanded"
        });
      }
    } else if (evt.currentState === "ESCALATED") {
      const revertedPct = Math.abs(evt.peakDeviationPct) - Math.abs(deltaPct);
      if (revertedPct >= Math.abs(evt.peakDeviationPct) * 0.35 && timeInCurrentState > 6e4) {
        evt.currentState = "RECOVERING";
        evt.severity = "MEDIUM";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "RECOVERING",
          timestamp: now,
          metricSummary: `Price retraced to ${deltaPct > 0 ? "+" : ""}${deltaPct}% (Peak was ${evt.peakDeviationPct > 0 ? "+" : ""}${evt.peakDeviationPct}%)`,
          reason: "Impulse fading; order flow rebalancing towards median"
        });
      }
    } else if (evt.currentState === "RECOVERING") {
      if (Math.abs(deltaPct) <= 0.8 || timeInCurrentState > 3e5) {
        evt.currentState = "RESOLVED";
        evt.severity = "LOW";
        evt.lastTransitionAt = now;
        evt.stateHistory.push({
          state: "RESOLVED",
          timestamp: now,
          metricSummary: `Variance compressed to ${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
          reason: "Event normalized; standard liquidity equilibrium restored"
        });
      }
    }
  });
}

// server/services/tickSimulator.ts
function startTickSimulator() {
  setInterval(() => {
    const now = Date.now();
    liveQuotes.forEach((quote) => {
      if (Math.random() > 0.3) return;
      const seed = STOCK_UNIVERSE.find((s) => s.symbol === quote.symbol);
      const beta = seed?.beta || 1;
      const delta = (Math.random() - 0.495) * (quote.price * 3e-3 * beta);
      const newPrice = Number(Math.max(1, quote.price + delta).toFixed(2));
      const newChange = Number((newPrice - (seed?.basePrice || quote.price)).toFixed(2));
      const newChangePct = Number((newChange / (seed?.basePrice || quote.price) * 100).toFixed(2));
      const newVolume = quote.volume + Math.floor(Math.random() * 25e3);
      quote.price = newPrice;
      quote.change = newChange;
      quote.changePct = newChangePct;
      quote.volume = newVolume;
      quote.dayHigh = Number(Math.max(quote.dayHigh, newPrice).toFixed(2));
      quote.dayLow = Number(Math.min(quote.dayLow, newPrice).toFixed(2));
      quote.priceINR = quote.currency === "INR" ? newPrice : Number((newPrice * USD_INR_EXCHANGE_RATE).toFixed(2));
      quote.lastUpdated = now;
      const watchlistEntry = userWatchlist.get(quote.symbol);
      const thresh = watchlistEntry?.customThresholds;
      if (thresh?.targetBuyPrice && thresh.targetBuyActive !== false) {
        const targetCurrency = thresh.targetBuyCurrency || "INR";
        const currentInTarget = targetCurrency === "INR" ? quote.priceINR || newPrice : quote.currency === "USD" ? newPrice : Number((newPrice / USD_INR_EXCHANGE_RATE).toFixed(2));
        const targetType = thresh.targetType || (thresh.targetBuyPrice >= currentInTarget ? "DIP_BUY" : "BREAKOUT_BUY");
        const hysteresisPct = thresh.hysteresisBufferPct ?? 0.5;
        const isDirectHit = targetType === "DIP_BUY" ? currentInTarget <= thresh.targetBuyPrice : currentInTarget >= thresh.targetBuyPrice;
        const rearmPrice = targetType === "DIP_BUY" ? Number((thresh.targetBuyPrice * (1 + hysteresisPct / 100)).toFixed(2)) : Number((thresh.targetBuyPrice * (1 - hysteresisPct / 100)).toFixed(2));
        if (thresh.targetBuyTriggered) {
          const hasRebounded = targetType === "DIP_BUY" ? currentInTarget >= rearmPrice : currentInTarget <= rearmPrice;
          if (hasRebounded) {
            thresh.targetBuyTriggered = false;
            marketRepository.getAlertRule("usr_demo_1", quote.symbol).then((rule) => {
              if (rule) {
                rule.targetBuyTriggered = false;
                marketRepository.saveAlertRule(rule).catch(() => {
                });
              }
            }).catch(() => {
            });
          } else if (!isDirectHit) {
            thresh.suppressedOscillationsCount = (thresh.suppressedOscillationsCount || 0) + 1;
          }
        } else if (isDirectHit) {
          thresh.targetBuyTriggered = true;
          thresh.targetBuyTriggeredAt = now;
          thresh.lastAlertDispatchedAt = now;
          thresh.lastAlertPrice = currentInTarget;
          marketRepository.getAlertRule("usr_demo_1", quote.symbol).then((rule) => {
            if (rule) {
              rule.targetBuyTriggered = true;
              rule.targetBuyTriggeredAt = now;
              rule.lastTriggeredAt = now;
              rule.lastTriggeredPrice = currentInTarget;
              marketRepository.saveAlertRule(rule).catch(() => {
              });
            }
          }).catch(() => {
          });
        }
      }
      if (Math.random() > 0.5) {
        quote.ticks.push({
          time: new Date(now).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }),
          price: newPrice,
          volume: newVolume
        });
        if (quote.ticks.length > 15) quote.ticks.shift();
      }
    });
  }, 3e3);
  console.log("[TICK] Background tick simulator started (3s interval).");
}

// server/middleware/authMiddleware.ts
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.substring(7);
  const headerToken = req.headers["x-auth-token"];
  return typeof headerToken === "string" ? headerToken : null;
}
async function resolveSessionUser(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    req.userId = await marketRepository.getSessionUserId(token);
  } catch {
    req.userId = null;
  }
  next();
}

// server/routes/healthRouter.ts
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    terminalEngine: "PulseWatch v2.4 (Modular Architecture)",
    uptimeSeconds: Math.floor(process.uptime()),
    geminiEnabled: Boolean(process.env.GEMINI_API_KEY)
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
      ...stats
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to retrieve DB stats" });
  }
});
var healthRouter_default = router;

// server/routes/authRouter.ts
var import_express2 = require("express");
var import_crypto = __toESM(require("crypto"), 1);
var router2 = (0, import_express2.Router)();
var pendingOtps = /* @__PURE__ */ new Map();
var emailDispatchLogs = [];
function hashPassword(password, salt) {
  return import_crypto.default.createHmac("sha256", salt).update(password).digest("hex");
}
function toUserProfile(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    currencyPreference: user.currencyPreference,
    riskTolerance: user.riskTolerance,
    investmentHorizon: user.investmentHorizon,
    defaultTargetBuyAlertChannel: user.defaultTargetBuyAlertChannel,
    growwClientId: user.growwClientId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
router2.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await marketRepository.getUserByEmail(normalizedEmail);
  if (existingUser && existingUser.emailVerified) {
    return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
  }
  const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const pwdHash = hashPassword(password, salt);
  const pendingUser = {
    id: existingUser?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split("@")[0],
    passwordSalt: salt,
    passwordHash: pwdHash,
    emailVerified: false,
    currencyPreference: "INR",
    riskTolerance: "MODERATE",
    investmentHorizon: "SWING",
    defaultTargetBuyAlertChannel: "APP_AND_EMAIL",
    createdAt: existingUser?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  pendingOtps.set(normalizedEmail, { email: normalizedEmail, otp, expiresAt: Date.now() + 10 * 60 * 1e3, attempts: 0, pendingUser });
  const dispatchRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    subject: "Your Smart Market Watchlist Registration OTP",
    otp,
    sentAt: Date.now(),
    status: "SENT"
  };
  emailDispatchLogs.unshift(dispatchRecord);
  if (emailDispatchLogs.length > 30) emailDispatchLogs.pop();
  console.log(`[AUTH] \u{1F4E7} Verification OTP [${otp}] dispatched to ${normalizedEmail}`);
  res.json({ success: true, message: `Verification code sent to ${normalizedEmail}.`, debugOtp: otp, expiresInSeconds: 600 });
});
router2.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and 6-digit OTP are required" });
  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingOtps.get(normalizedEmail);
  if (!pending) return res.status(400).json({ error: "No active verification code found. Please request a new OTP." });
  if (Date.now() > pending.expiresAt) {
    pendingOtps.delete(normalizedEmail);
    return res.status(400).json({ error: "Verification code has expired. Please request a new OTP." });
  }
  if (pending.otp.trim() !== String(otp).trim()) {
    pending.attempts++;
    if (pending.attempts >= 5) {
      pendingOtps.delete(normalizedEmail);
      return res.status(400).json({ error: "Too many incorrect attempts. Please request a new OTP code." });
    }
    return res.status(400).json({ error: `Invalid OTP code. ${5 - pending.attempts} attempt(s) remaining.` });
  }
  const verifiedUser = { ...pending.pendingUser, emailVerified: true, updatedAt: Date.now() };
  await marketRepository.upsertUser(verifiedUser);
  pendingOtps.delete(normalizedEmail);
  const sessionToken = import_crypto.default.randomBytes(32).toString("hex");
  await marketRepository.createSession(sessionToken, verifiedUser.id, Date.now() + SESSION_TTL_MS);
  console.log(`[AUTH] \u2705 User ${normalizedEmail} verified and logged in.`);
  res.json({ success: true, message: "Registration completed successfully!", token: sessionToken, user: toUserProfile(verifiedUser) });
});
router2.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  const normalizedEmail = email.toLowerCase().trim();
  const user = await marketRepository.getUserByEmail(normalizedEmail);
  if (!user) return res.status(404).json({ error: "No account found with this email. Please register first." });
  if (user.emailVerified) return res.status(400).json({ error: "Your email is already verified. Please log in." });
  const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
  const pending = pendingOtps.get(normalizedEmail);
  pendingOtps.set(normalizedEmail, {
    email: normalizedEmail,
    otp,
    expiresAt: Date.now() + 10 * 60 * 1e3,
    attempts: 0,
    pendingUser: pending?.pendingUser || user
  });
  const dispatchRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    subject: "Resent: Your Smart Watchlist Verification OTP",
    otp,
    sentAt: Date.now(),
    status: "SENT"
  };
  emailDispatchLogs.unshift(dispatchRecord);
  console.log(`[AUTH] \u{1F4E7} Resent OTP [${otp}] to ${normalizedEmail}`);
  res.json({ success: true, message: `A fresh OTP has been sent to ${normalizedEmail}.`, debugOtp: otp, expiresInSeconds: 600 });
});
router2.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  const normalizedEmail = email.toLowerCase().trim();
  const user = await marketRepository.getUserByEmail(normalizedEmail);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  const computedHash = hashPassword(password, user.passwordSalt);
  if (computedHash !== user.passwordHash) return res.status(401).json({ error: "Invalid email or password" });
  if (!user.emailVerified) {
    const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
    pendingOtps.set(normalizedEmail, { email: normalizedEmail, otp, expiresAt: Date.now() + 10 * 60 * 1e3, attempts: 0, pendingUser: user });
    return res.status(403).json({ error: "Email verification required. A new OTP has been dispatched.", requiresOtp: true, email: normalizedEmail, debugOtp: otp });
  }
  const sessionToken = import_crypto.default.randomBytes(32).toString("hex");
  await marketRepository.createSession(sessionToken, user.id, Date.now() + SESSION_TTL_MS);
  console.log(`[AUTH] \u{1F511} User ${normalizedEmail} logged in.`);
  res.json({ success: true, message: "Logged in successfully", token: sessionToken, user: toUserProfile(user) });
});
router2.get("/me", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated", authenticated: false });
  const userId = await marketRepository.getSessionUserId(token);
  if (!userId) return res.status(401).json({ error: "Session expired or invalid", authenticated: false });
  const user = await marketRepository.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found", authenticated: false });
  res.json({ success: true, authenticated: true, user: toUserProfile(user) });
});
router2.put("/profile", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const userId = await marketRepository.getSessionUserId(token);
  if (!userId) return res.status(401).json({ error: "Session expired or invalid" });
  const user = await marketRepository.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });
  const { name, avatarUrl, currencyPreference, riskTolerance, investmentHorizon, defaultTargetBuyAlertChannel, growwClientId } = req.body;
  if (name && typeof name === "string" && name.trim().length > 0) user.name = name.trim();
  if (avatarUrl !== void 0) user.avatarUrl = avatarUrl;
  if (currencyPreference === "INR" || currencyPreference === "USD") user.currencyPreference = currencyPreference;
  if (riskTolerance && ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"].includes(riskTolerance)) user.riskTolerance = riskTolerance;
  if (investmentHorizon && ["INTRADAY", "SWING", "LONG_TERM"].includes(investmentHorizon)) user.investmentHorizon = investmentHorizon;
  if (defaultTargetBuyAlertChannel && ["APP_AND_EMAIL", "APP_ONLY"].includes(defaultTargetBuyAlertChannel)) user.defaultTargetBuyAlertChannel = defaultTargetBuyAlertChannel;
  if (growwClientId !== void 0) user.growwClientId = typeof growwClientId === "string" ? growwClientId.trim() : void 0;
  user.updatedAt = Date.now();
  await marketRepository.upsertUser(user);
  console.log(`[AUTH] \u{1F464} Updated profile for ${user.email}`);
  res.json({ success: true, message: "Profile updated successfully", user: toUserProfile(user) });
});
router2.post("/logout", async (req, res) => {
  const token = extractToken(req);
  if (token) await marketRepository.deleteSession(token);
  res.json({ success: true, message: "Logged out successfully" });
});
router2.get("/debug/recent-otps", (_req, res) => {
  res.json({ recentDispatches: emailDispatchLogs.slice(0, 10), activePendingCount: pendingOtps.size });
});
var authRouter_default = router2;

// server/routes/watchlistRouter.ts
var import_express3 = require("express");
var router3 = (0, import_express3.Router)();
var getUserId = (req) => req.userId || "usr_demo_1";
router3.get("/", (_req, res) => {
  res.json(Array.from(userWatchlist.values()));
});
router3.post("/", (req, res) => {
  const { symbol, customThresholds, userNotes, tags } = req.body;
  if (!symbol || typeof symbol !== "string") return res.status(400).json({ error: "Valid symbol required" });
  const cleanSymbol = symbol.toUpperCase().trim();
  if (!liveQuotes.has(cleanSymbol)) {
    const defaultPrice = 100;
    liveQuotes.set(cleanSymbol, {
      symbol: cleanSymbol,
      name: `${cleanSymbol} Asset`,
      sector: "General / Other",
      price: defaultPrice,
      change: 0,
      changePct: 0,
      volume: 1e6,
      avgVolume: 1e6,
      volatility: 22,
      dayHigh: defaultPrice,
      dayLow: defaultPrice,
      high52: defaultPrice * 1.3,
      low52: defaultPrice * 0.7,
      lastUpdated: Date.now(),
      ticks: [{ time: "09:30", price: defaultPrice, volume: 1e5 }]
    });
    if (activeBaseline) {
      activeBaseline.quotes[cleanSymbol] = { price: defaultPrice, volume: 5e5, volatility: 22, timestamp: activeBaseline.timestamp };
    }
  }
  const record = {
    symbol: cleanSymbol,
    addedAt: Date.now(),
    customThresholds: customThresholds || { priceChangePct: 2.5, volumeMultiplier: 1.6, volatilityJumpPct: 20 },
    userNotes: userNotes || "",
    tags: tags || ["CUSTOM"]
  };
  userWatchlist.set(cleanSymbol, record);
  res.json({ success: true, item: record });
});
router3.delete("/:symbol", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existed = userWatchlist.delete(cleanSymbol);
  res.json({ success: existed, symbol: cleanSymbol });
});
router3.put("/:symbol/threshold", (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });
  const { targetBuyPrice, targetBuyCurrency } = req.body;
  if (targetBuyPrice !== void 0) {
    const numPrice = Number(targetBuyPrice);
    if (isNaN(numPrice) || numPrice <= 0) return res.status(400).json({ error: "Target price must be a valid positive number" });
  }
  let deviationWarning;
  if (targetBuyPrice !== void 0 && Number(targetBuyPrice) > 0) {
    const quote = liveQuotes.get(cleanSymbol);
    const targetCurr = targetBuyCurrency || existing.customThresholds.targetBuyCurrency || "INR";
    const currentInTarget = quote ? targetCurr === "INR" ? quote.priceINR || (quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2))) : quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2)) : Number(targetBuyPrice);
    const distancePct = Math.abs(currentInTarget - Number(targetBuyPrice)) / (currentInTarget || 1) * 100;
    if (distancePct > 30) {
      deviationWarning = `Target price is ${distancePct.toFixed(1)}% away from current spot price. Please verify.`;
    }
  }
  existing.customThresholds = { ...existing.customThresholds, ...req.body };
  if (req.body.userNotes !== void 0) existing.userNotes = req.body.userNotes;
  if (req.body.tags !== void 0) existing.tags = req.body.tags;
  res.json({ success: true, item: existing, warning: deviationWarning });
});
router3.post("/:symbol/buy-reminder", async (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });
  const { targetBuyPrice, targetBuyCurrency = "INR", targetBuyNote, targetType, hysteresisBufferPct = 0.5, cooldownMinutes = 30 } = req.body;
  if (!targetBuyPrice || isNaN(Number(targetBuyPrice)) || Number(targetBuyPrice) <= 0) {
    return res.status(400).json({ error: "Valid positive targetBuyPrice is required" });
  }
  const quote = liveQuotes.get(cleanSymbol);
  const targetCurrency = targetBuyCurrency === "USD" ? "USD" : "INR";
  const currentInTarget = quote ? targetCurrency === "INR" ? quote.priceINR || (quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2))) : quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2)) : Number(targetBuyPrice);
  const numTarget = Number(targetBuyPrice);
  const mode = targetType || (numTarget <= currentInTarget ? "DIP_BUY" : "BREAKOUT_BUY");
  const isAlreadyTriggered = mode === "DIP_BUY" ? currentInTarget <= numTarget : currentInTarget >= numTarget;
  const distancePct = Math.abs(currentInTarget - numTarget) / (currentInTarget || 1) * 100;
  const deviationWarning = distancePct > 30 ? `Target price is ${distancePct.toFixed(1)}% away from current spot price. Please verify.` : void 0;
  existing.customThresholds = {
    ...existing.customThresholds,
    targetBuyPrice: numTarget,
    targetBuyCurrency: targetCurrency,
    targetType: mode,
    targetBuyActive: true,
    targetBuyTriggered: isAlreadyTriggered,
    targetBuyTriggeredAt: isAlreadyTriggered ? Date.now() : void 0,
    targetBuyNote: targetBuyNote || `${mode === "BREAKOUT_BUY" ? "Breakout" : "Dip buy"} target at ${targetCurrency === "INR" ? "\u20B9" : "$"}${numTarget.toLocaleString()}`,
    hysteresisBufferPct: Number(hysteresisBufferPct) || 0.5,
    cooldownMinutes: Number(cooldownMinutes) || 30,
    lastAlertDispatchedAt: isAlreadyTriggered ? Date.now() : void 0,
    lastAlertPrice: isAlreadyTriggered ? currentInTarget : void 0,
    suppressedOscillationsCount: existing.customThresholds?.suppressedOscillationsCount || 0
  };
  const userId = getUserId(req);
  await marketRepository.saveAlertRule({
    id: `rule_${cleanSymbol}_${Date.now()}`,
    userId,
    symbol: cleanSymbol,
    targetBuyPrice: numTarget,
    targetBuyCurrency: targetCurrency,
    targetType: mode,
    targetBuyActive: true,
    targetBuyTriggered: isAlreadyTriggered,
    targetBuyTriggeredAt: isAlreadyTriggered ? Date.now() : void 0,
    targetBuyNote: existing.customThresholds.targetBuyNote,
    priceShiftThreshold: existing.customThresholds.priceChangePct || 2.5,
    volumeSpikeThreshold: existing.customThresholds.volumeMultiplier || 1.6,
    hysteresisBandPct: Number(hysteresisBufferPct) || 0.5,
    cooldownMinutes: Number(cooldownMinutes) || 30,
    lastTriggeredAt: isAlreadyTriggered ? Date.now() : void 0,
    lastTriggeredPrice: isAlreadyTriggered ? currentInTarget : void 0,
    suppressedOscillationsCount: existing.customThresholds?.suppressedOscillationsCount || 0
  }).catch(() => {
  });
  res.json({ success: true, item: existing, warning: deviationWarning });
});
router3.post("/:symbol/buy-reminder/dismiss", async (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });
  if (existing.customThresholds) {
    existing.customThresholds.targetBuyTriggered = false;
    const userId = getUserId(req);
    const rule = await marketRepository.getAlertRule(userId, cleanSymbol).catch(() => null);
    if (rule) {
      rule.targetBuyTriggered = false;
      await marketRepository.saveAlertRule(rule).catch(() => {
      });
    }
  }
  res.json({ success: true, item: existing });
});
router3.delete("/:symbol/buy-reminder", async (req, res) => {
  const cleanSymbol = req.params.symbol.toUpperCase();
  const existing = userWatchlist.get(cleanSymbol);
  if (!existing) return res.status(404).json({ error: "Symbol not in watchlist" });
  if (existing.customThresholds) {
    delete existing.customThresholds.targetBuyPrice;
    delete existing.customThresholds.targetBuyCurrency;
    delete existing.customThresholds.targetBuyActive;
    delete existing.customThresholds.targetBuyTriggered;
    delete existing.customThresholds.targetBuyTriggeredAt;
    delete existing.customThresholds.targetBuyNote;
    const userId = getUserId(req);
    await marketRepository.deleteAlertRule(userId, cleanSymbol).catch(() => {
    });
  }
  res.json({ success: true, item: existing });
});
var watchlistRouter_default = router3;

// server/routes/marketRouter.ts
var import_express4 = require("express");

// server/services/marketIntelligence.ts
function calculateSectorMovements() {
  const sectorsMap = /* @__PURE__ */ new Map();
  liveQuotes.forEach((quote) => {
    const s = quote.sector;
    if (!sectorsMap.has(s)) {
      sectorsMap.set(s, { totalPct: 0, advancers: 0, decliners: 0, count: 0, totalVolRatio: 0 });
    }
    const data = sectorsMap.get(s);
    data.totalPct += quote.changePct;
    data.count += 1;
    data.totalVolRatio += quote.volume / quote.avgVolume;
    if (quote.changePct > 0.3) data.advancers += 1;
    else if (quote.changePct < -0.3) data.decliners += 1;
  });
  const movements = [];
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
      isCorrelatedSurge: avgChangePct >= 2 && correlationScore >= 0.75,
      isCorrelatedDrop: avgChangePct <= -2 && correlationScore >= 0.75,
      correlationScore
    });
  });
  return movements.sort((a, b) => Math.abs(b.avgChangePct) - Math.abs(a.avgChangePct));
}
function calculateAttentionScore(symbol, sectorMovements) {
  const quote = liveQuotes.get(symbol);
  if (!quote) {
    return {
      symbol,
      totalScore: 0,
      category: "NO_MEANINGFUL_CHANGE",
      urgencyRank: 99,
      signals: [],
      rationales: [],
      primaryDriver: "No quote data available"
    };
  }
  const baseline = activeBaseline?.quotes[symbol] || {
    price: quote.price,
    volume: quote.avgVolume * 0.5,
    volatility: quote.volatility,
    timestamp: activeBaseline?.timestamp ?? Date.now()
  };
  const watchlistEntry = userWatchlist.get(symbol);
  const thresholds = watchlistEntry?.customThresholds || {};
  const userPriceThreshold = thresholds.priceChangePct ?? 2.5;
  const userVolThreshold = thresholds.volumeMultiplier ?? 1.6;
  const userVolatThreshold = thresholds.volatilityJumpPct ?? 20;
  const signals = [];
  const rationales = [];
  const deltaPricePct = Number(((quote.price - baseline.price) / baseline.price * 100).toFixed(2));
  const absDeltaPrice = Math.abs(deltaPricePct);
  const pricePoints = Math.min(40, Math.round(absDeltaPrice / userPriceThreshold * 22));
  if (pricePoints > 5) {
    signals.push({
      type: "PRICE_MOVE",
      label: "Price Delta vs Baseline",
      points: pricePoints,
      maxPoints: 40,
      description: `Shifted ${deltaPricePct >= 0 ? "+" : ""}${deltaPricePct}% from baseline ($${baseline.price.toFixed(2)} \u2192 $${quote.price.toFixed(2)})`,
      currentValue: quote.price,
      baselineValue: baseline.price,
      deltaPct: deltaPricePct,
      severity: absDeltaPrice >= userPriceThreshold ? "CRIT" : absDeltaPrice >= userPriceThreshold * 0.6 ? "WARN" : "INFO"
    });
    rationales.push({
      signalType: "PRICE_MOVE",
      headline: `Price Delta: ${deltaPricePct >= 0 ? "+" : ""}${deltaPricePct}% since last check`,
      detail: `Asset shifted from $${baseline.price.toFixed(2)} to $${quote.price.toFixed(2)}, representing a ${absDeltaPrice >= userPriceThreshold ? "critical threshold breach" : "moderate movement"}.`,
      impactScore: pricePoints,
      isCustomAlert: absDeltaPrice >= userPriceThreshold
    });
  }
  const volumeMultiplier = Number((quote.volume / quote.avgVolume).toFixed(2));
  let volPoints = 0;
  if (volumeMultiplier >= 1.2) {
    volPoints = Math.min(25, Math.round((volumeMultiplier - 1) * 16));
    signals.push({
      type: "VOLUME_SPIKE",
      label: "Unusual Trading Velocity",
      points: volPoints,
      maxPoints: 25,
      description: `Trading at ${volumeMultiplier}x 20-day expected volume pace (${(quote.volume / 1e6).toFixed(1)}M shares)`,
      currentValue: quote.volume,
      baselineValue: quote.avgVolume,
      deltaPct: Number(((volumeMultiplier - 1) * 100).toFixed(1)),
      severity: volumeMultiplier >= userVolThreshold ? "CRIT" : "WARN"
    });
    rationales.push({
      signalType: "VOLUME_SPIKE",
      headline: `Volume Spike: ${volumeMultiplier}x normal pace`,
      detail: `Turnover rate is tracking significantly higher than typical session distribution, indicating institutional block participation.`,
      impactScore: volPoints,
      isCustomAlert: volumeMultiplier >= userVolThreshold
    });
  }
  const baselineVolat = baseline.volatility || 20;
  const volatExpansionPct = Number(((quote.volatility - baselineVolat) / baselineVolat * 100).toFixed(1));
  let volatPoints = 0;
  if (volatExpansionPct >= 15) {
    volatPoints = Math.min(20, Math.round(volatExpansionPct / userVolatThreshold * 12));
    signals.push({
      type: "VOLATILITY_EXPANSION",
      label: "Volatility Regime Expansion",
      points: volatPoints,
      maxPoints: 20,
      description: `Intraday annualized ATR expanded +${volatExpansionPct}% (now ${quote.volatility.toFixed(1)}%)`,
      currentValue: quote.volatility,
      baselineValue: baselineVolat,
      deltaPct: volatExpansionPct,
      severity: volatExpansionPct >= userVolatThreshold ? "CRIT" : "WARN"
    });
    rationales.push({
      signalType: "VOLATILITY_EXPANSION",
      headline: `Volatility Jump: +${volatExpansionPct}% range expansion`,
      detail: `Intraday high-low spread ($${quote.dayLow.toFixed(2)} - $${quote.dayHigh.toFixed(2)}) widened beyond standard variance bounds.`,
      impactScore: volatPoints,
      isCustomAlert: volatExpansionPct >= userVolatThreshold
    });
  }
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
      description: `Breached custom rule(s): ${breachedPriceThreshold ? `\u0394Price >= \xB1${userPriceThreshold}%` : ""}${breachedPriceThreshold && breachedVolThreshold ? " & " : ""}${breachedVolThreshold ? `Volume >= ${userVolThreshold}x` : ""}`,
      currentValue: breachedPriceThreshold ? absDeltaPrice : volumeMultiplier,
      baselineValue: breachedPriceThreshold ? userPriceThreshold : userVolThreshold,
      deltaPct: 100,
      severity: "CRIT"
    });
    rationales.push({
      signalType: "THRESHOLD_BREACH",
      headline: `Rule Breached: User threshold active`,
      detail: `Your custom monitoring configuration signaled an immediate trigger for ${symbol}.`,
      impactScore: thresholdPoints,
      isCustomAlert: true
    });
  }
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
      severity: "WARN"
    });
    rationales.push({
      signalType: "SECTOR_CORRELATION",
      headline: `Sector Momentum: ${quote.sector} (${sectorData.avgChangePct >= 0 ? "+" : ""}${sectorData.avgChangePct}%)`,
      detail: `High sector co-movement (${Math.round(sectorData.correlationScore * 100)}% co-directional advancers/decliners).`,
      impactScore: sectorPoints,
      isCustomAlert: false
    });
  }
  let buyTargetPoints = 0;
  let reachedBuyTarget = false;
  let isAlertThrottled = false;
  if (thresholds.targetBuyPrice && thresholds.targetBuyActive !== false) {
    const targetCurrency = thresholds.targetBuyCurrency || "INR";
    const currentPriceInTarget = targetCurrency === "INR" ? quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2)) : quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2));
    const targetType = thresholds.targetType || (thresholds.targetBuyPrice >= currentPriceInTarget ? "DIP_BUY" : "BREAKOUT_BUY");
    const hysteresisPct = thresholds.hysteresisBufferPct ?? 0.5;
    const cooldownMs = (thresholds.cooldownMinutes ?? 30) * 60 * 1e3;
    const isDirectHit = targetType === "DIP_BUY" ? currentPriceInTarget <= thresholds.targetBuyPrice : currentPriceInTarget >= thresholds.targetBuyPrice;
    const rearmPrice = targetType === "DIP_BUY" ? Number((thresholds.targetBuyPrice * (1 + hysteresisPct / 100)).toFixed(2)) : Number((thresholds.targetBuyPrice * (1 - hysteresisPct / 100)).toFixed(2));
    if (thresholds.targetBuyTriggered) {
      const hasRebounded = targetType === "DIP_BUY" ? currentPriceInTarget >= rearmPrice : currentPriceInTarget <= rearmPrice;
      if (hasRebounded) {
        thresholds.targetBuyTriggered = false;
      } else if (!isDirectHit) {
        thresholds.suppressedOscillationsCount = (thresholds.suppressedOscillationsCount || 0) + 1;
      }
    }
    if (isDirectHit) {
      const now = Date.now();
      const timeSinceLastAlert = thresholds.lastAlertDispatchedAt ? now - thresholds.lastAlertDispatchedAt : Infinity;
      let significantProgression = false;
      if (thresholds.lastAlertPrice) {
        const deeperPct = targetType === "DIP_BUY" ? (thresholds.lastAlertPrice - currentPriceInTarget) / thresholds.lastAlertPrice * 100 : (currentPriceInTarget - thresholds.lastAlertPrice) / thresholds.lastAlertPrice * 100;
        if (deeperPct >= 2) significantProgression = true;
      }
      if (timeSinceLastAlert < cooldownMs && !significantProgression && thresholds.targetBuyTriggered) {
        isAlertThrottled = true;
        thresholds.suppressedOscillationsCount = (thresholds.suppressedOscillationsCount || 0) + 1;
        marketRepository.recordSuppressedOscillation("usr_demo_1", quote.symbol).catch(() => {
        });
      } else {
        const isFresh = !thresholds.targetBuyTriggered || timeSinceLastAlert >= cooldownMs;
        thresholds.targetBuyTriggered = true;
        thresholds.targetBuyTriggeredAt = thresholds.targetBuyTriggeredAt || now;
        thresholds.lastAlertDispatchedAt = now;
        thresholds.lastAlertPrice = currentPriceInTarget;
        if (isFresh) {
          marketRepository.recordAlertAudit({
            userId: "usr_demo_1",
            symbol: quote.symbol,
            triggerType: targetType === "BREAKOUT_BUY" ? "BREAKOUT_BUY_REACHED" : "DIP_BUY_REACHED",
            triggerPrice: currentPriceInTarget,
            attentionScore: 85,
            message: `${quote.symbol} reached ${targetType === "BREAKOUT_BUY" ? "Breakout" : "Dip-Buy"} target (${targetCurrency === "INR" ? "\u20B9" : "$"}${thresholds.targetBuyPrice}). Anti-whipsaw cooldown active.`,
            suppressedCount: thresholds.suppressedOscillationsCount || 0
          }).catch((err) => console.error("[AUDIT] Failed to record alert:", err));
        }
      }
      reachedBuyTarget = true;
    } else {
      reachedBuyTarget = Boolean(thresholds.targetBuyTriggered);
    }
    if (reachedBuyTarget) {
      const symSymbol = targetCurrency === "INR" ? "\u20B9" : "$";
      const modeLabel = targetType === "BREAKOUT_BUY" ? "Breakout Target" : "Dip Buy Target";
      buyTargetPoints = 25;
      const currentPriceInTargetFinal = targetCurrency === "INR" ? quote.currency === "INR" ? quote.price : Number((quote.price * USD_INR_EXCHANGE_RATE).toFixed(2)) : quote.currency === "USD" ? quote.price : Number((quote.price / USD_INR_EXCHANGE_RATE).toFixed(2));
      signals.push({
        type: "THRESHOLD_BREACH",
        label: `${modeLabel} Reached`,
        points: buyTargetPoints,
        maxPoints: 25,
        description: `${modeLabel} triggered at ${symSymbol}${currentPriceInTargetFinal.toLocaleString()} (Target: ${targetType === "BREAKOUT_BUY" ? "\u2265" : "\u2264"} ${symSymbol}${thresholds.targetBuyPrice.toLocaleString()})${thresholds.suppressedOscillationsCount ? ` [${thresholds.suppressedOscillationsCount} hover crosses suppressed]` : ""}`,
        currentValue: currentPriceInTargetFinal,
        baselineValue: thresholds.targetBuyPrice,
        deltaPct: Number(((currentPriceInTargetFinal - thresholds.targetBuyPrice) / thresholds.targetBuyPrice * 100).toFixed(2)),
        severity: "CRIT"
      });
      rationales.push({
        signalType: "THRESHOLD_BREACH",
        headline: `\u{1F3AF} ${modeLabel.toUpperCase()}: Reached ${symSymbol}${thresholds.targetBuyPrice.toLocaleString()}`,
        detail: `${symbol} reached your target purchase level of ${symSymbol}${thresholds.targetBuyPrice.toLocaleString()} (Current: ${symSymbol}${currentPriceInTargetFinal.toLocaleString()}). Anti-whipsaw 0.5% hysteresis active${isAlertThrottled ? " (notification throttled to prevent spam)." : "."}`,
        impactScore: buyTargetPoints,
        isCustomAlert: true
      });
    }
  }
  let sweepPoints = 0;
  if (quote.liquiditySweep?.detected) {
    sweepPoints = 15;
    signals.push({
      type: "VOLATILITY_EXPANSION",
      label: "Liquidity Sweep V-Reversal",
      points: sweepPoints,
      maxPoints: 20,
      description: `V-Shape mean reversion: ${quote.liquiditySweep.dropPct}% flash dip absorbed in ${quote.liquiditySweep.durationSeconds}s. Memory baseline preserved.`,
      currentValue: quote.price,
      baselineValue: quote.liquiditySweep.preDropPrice,
      deltaPct: quote.liquiditySweep.dropPct,
      severity: "WARN"
    });
    rationales.push({
      signalType: "VOLATILITY_EXPANSION",
      headline: `\u26A1 Liquidity Sweep: V-Shape Reversal (${quote.liquiditySweep.dropPct}%)`,
      detail: quote.liquiditySweep.notes,
      impactScore: sweepPoints,
      isCustomAlert: false
    });
  }
  const rawScore = pricePoints + volPoints + volatPoints + thresholdPoints + sectorPoints + buyTargetPoints + sweepPoints;
  const totalScore = Math.min(100, Math.max(0, rawScore));
  let category = "NO_MEANINGFUL_CHANGE";
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
    primaryDriver
  };
}
function generateDynamicGroups(scores, quotes) {
  const mostActive = [...quotes].filter((q) => q.volume / q.avgVolume >= 1.3).sort((a, b) => b.volume / b.avgVolume - a.volume / a.avgVolume).map((q) => q.symbol);
  const highAttention = Object.values(scores).filter((s) => s.totalScore >= 70).sort((a, b) => b.totalScore - a.totalScore).map((s) => s.symbol);
  const strongMomentum = [...quotes].filter((q) => Math.abs(q.changePct) >= 2.5).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).map((q) => q.symbol);
  const highVolatile = [...quotes].filter((q) => q.volatility >= 30).sort((a, b) => b.volatility - a.volatility).map((q) => q.symbol);
  const stable = [...quotes].filter((q) => Math.abs(q.changePct) < 1 && (scores[q.symbol]?.totalScore || 0) < 30).sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct)).map((q) => q.symbol);
  return [
    { id: "grp_high_attention", name: "CRITICAL ATTENTION", code: "ATTN_PRIORITY", description: "Assets with multiple anomaly signals or custom threshold breaches.", symbols: highAttention, badgeColor: "red", metricHighlight: `${highAttention.length} assets require review` },
    { id: "grp_most_active", name: "ABNORMAL VELOCITY", code: "VOLUME_SURGE", description: "Trading volume significantly exceeding 20-day baseline distributions.", symbols: mostActive, badgeColor: "amber", metricHighlight: `${mostActive.length} assets with volume spike` },
    { id: "grp_momentum", name: "STRONG MOMENTUM", code: "DIRECTIONAL_VELOCITY", description: "Aggressive directional price impulse (>2.5% intraday change).", symbols: strongMomentum, badgeColor: "green", metricHighlight: `${strongMomentum.length} trending names` },
    { id: "grp_volatility", name: "HIGH VOLATILITY", code: "REGIME_EXPANSION", description: "Elevated high-low intraday ATR spreads and gamma movement.", symbols: highVolatile, badgeColor: "purple", metricHighlight: `${highVolatile.length} wide range assets` },
    { id: "grp_stable", name: "STEADY / ANCHORED", code: "MEAN_CONVERGENCE", description: "Quiet, orderly price discovery with minimal drift from baseline.", symbols: stable, badgeColor: "blue", metricHighlight: `${stable.length} anchored assets` }
  ];
}
function compressEvents(scores, sectors) {
  const insights = [];
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
        highestScore: 88
      });
    }
  });
  Object.entries(scores).filter(([, score]) => score.category === "NEEDS_ATTENTION").map(([sym]) => sym).forEach((sym) => {
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
      highestScore: scoreData.totalScore
    });
  });
  const worthKnowingSymbols = Object.entries(scores).filter(([, score]) => score.category === "WORTH_KNOWING").map(([sym]) => sym);
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
      highestScore: 62
    });
  }
  return insights;
}

// server/services/diversification.ts
function calculatePortfolioDiversification(watchlist, stocks) {
  const stockMap = /* @__PURE__ */ new Map();
  stocks.forEach((s) => stockMap.set(s.symbol, s));
  const sectorCountMap = {};
  const totalWatchlist = watchlist.length || 1;
  watchlist.forEach((item) => {
    const q = stockMap.get(item.symbol);
    const sector = q?.sector || "Other";
    if (!sectorCountMap[sector]) sectorCountMap[sector] = { count: 0, symbols: [] };
    sectorCountMap[sector].count += 1;
    sectorCountMap[sector].symbols.push(item.symbol);
  });
  const allUniverseSectors = Array.from(new Set(STOCK_UNIVERSE.map((s) => s.sector)));
  const userSectorDistribution = allUniverseSectors.map((sector) => {
    const userSector = sectorCountMap[sector] || { count: 0, symbols: [] };
    const weightPct = Math.round(userSector.count / totalWatchlist * 100);
    let status = "MISSING";
    if (userSector.count === 0) status = "MISSING";
    else if (weightPct >= 35) status = "OVERWEIGHT";
    else if (weightPct >= 15) status = "BALANCED";
    else status = "UNDERWEIGHT";
    return { sector, count: userSector.count, weightPct, symbols: userSector.symbols, status };
  }).sort((a, b) => b.weightPct - a.weightPct);
  const dominant = userSectorDistribution[0] || { sector: "None", weightPct: 0 };
  let concentrationRisk = "LOW";
  if (dominant.weightPct >= 60) concentrationRisk = "CRITICAL";
  else if (dominant.weightPct >= 45) concentrationRisk = "HIGH";
  else if (dominant.weightPct >= 30) concentrationRisk = "MODERATE";
  const missingSectors = userSectorDistribution.filter((s) => s.status === "MISSING").map((s) => s.sector);
  const underweightedSectors = userSectorDistribution.filter((s) => s.status === "UNDERWEIGHT").map((s) => s.sector);
  const concentrationSummary = concentrationRisk === "HIGH" || concentrationRisk === "CRITICAL" ? `High sector concentration: ${dominant.weightPct}% of your watchlist is concentrated in ${dominant.sector}. You are heavily exposed to cyclical tech drawdowns. We recommend hedging into ${missingSectors.slice(0, 2).join(" and ")}.` : concentrationRisk === "MODERATE" ? `Moderate concentration in ${dominant.sector} (${dominant.weightPct}%). Adding exposure to defensive or non-correlated sectors will smooth drawdown volatility.` : `Well-diversified watchlist across multiple market sectors with low single-sector concentration risk.`;
  const watchlistSymbolSet = new Set(watchlist.map((w) => w.symbol));
  const allSectorTopPicks = {};
  allUniverseSectors.forEach((sector) => {
    const seedsInSector = STOCK_UNIVERSE.filter((s) => s.sector === sector);
    const mappedPicks = seedsInSector.map((seed) => {
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
        volatility: q ? q.volatility : 22,
        rank: 1,
        whyPick: seed.whyPick || "High-quality market leader with strong institutional liquidity.",
        isInWatchlist: watchlistSymbolSet.has(seed.symbol),
        peRatio: seed.peRatio,
        marketCapTier: seed.marketCapTier
      };
    });
    mappedPicks.sort((a, b) => {
      if (a.isInWatchlist !== b.isInWatchlist) return a.isInWatchlist ? 1 : -1;
      const scoreA = a.changePct * 2 - a.beta * 3;
      const scoreB = b.changePct * 2 - b.beta * 3;
      return scoreB - scoreA;
    });
    mappedPicks.forEach((p, idx) => {
      p.rank = idx + 1;
    });
    allSectorTopPicks[sector] = mappedPicks;
  });
  const recommendations = [];
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
      topKStocks: topKPicks
    });
  });
  return {
    userSectorDistribution,
    dominantSector: dominant.sector,
    concentrationRisk,
    concentrationSummary,
    recommendations,
    allSectorTopPicks
  };
}

// server/services/geminiService.ts
var import_genai = require("@google/genai");
var geminiClient = null;
var geminiAuthFailed = false;
var geminiRetryAfter = 0;
function getGeminiClient() {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  const now = Date.now();
  if (geminiAuthFailed && now < geminiRetryAfter) {
    return null;
  }
  if (!geminiClient) {
    try {
      geminiClient = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" }
        }
      });
    } catch (e) {
      console.warn("[GEMINI] Failed to initialize GoogleGenAI client:", e);
      return null;
    }
  }
  return geminiClient;
}
function markGeminiAuthFailed() {
  geminiAuthFailed = true;
  geminiRetryAfter = Date.now() + 15 * 60 * 1e3;
  console.warn("[GEMINI] Authentication unavailable; operating in deterministic briefing mode.");
}

// server/services/briefingEngine.ts
var cachedBriefing = "";
var lastBriefingTime = 0;
var isGeneratingBriefing = false;
function formatElapsedTime(ms) {
  const seconds = Math.floor(ms / 1e3);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
function buildDeterministicBriefing(timeElapsedStr, scores, events) {
  const needsAttention = Object.values(scores).filter((s) => s.category === "NEEDS_ATTENTION");
  const worthKnowing = Object.values(scores).filter((s) => s.category === "WORTH_KNOWING");
  const totalTracked = Object.keys(scores).length;
  const escalatedEvents = events.filter((e) => e.currentState === "ESCALATED");
  const recoveringEvents = events.filter((e) => e.currentState === "RECOVERING");
  const criticalSymbols = needsAttention.map((s) => s.symbol);
  const sections = [];
  sections.push(`### \u23F1\uFE0F Baseline Drift & Posture
Anchor snapshot established **${timeElapsedStr.toUpperCase()} AGO**. Monitoring ${totalTracked} watchlist assets against customized volatility and baseline price envelopes.`);
  if (criticalSymbols.length === 0 && worthKnowing.length === 0) {
    sections.push(`### \u{1F6E1}\uFE0F Portfolio Status: All Quiet
All ${totalTracked} tracked assets remain anchored within normal variance envelopes. Zero threshold breaches or abnormal volume surges recorded. No immediate intervention recommended.`);
  } else {
    sections.push(`### \u{1F4CA} Portfolio Alert Matrix
Detected **${criticalSymbols.length} critical priority** and **${worthKnowing.length} secondary alerts** across your portfolio.
\u2022 High Urgency Assets: ${criticalSymbols.length > 0 ? criticalSymbols.map((s) => `**${s}**`).join(", ") : "None"}
\u2022 Secondary Awareness: ${worthKnowing.length > 0 ? worthKnowing.map((s) => `**${s.symbol}**`).join(", ") : "None"}`);
    if (criticalSymbols.length > 0) {
      const topPick = needsAttention[0];
      sections.push(`### \u{1F3AF} Primary Urgency Driver: ${topPick.symbol}
**${topPick.symbol}** leads the attention queue with an urgency score of **${topPick.totalScore}/100**.
Trigger Mechanism: ${topPick.primaryDriver}. Immediate review is advised to evaluate positional risk.`);
    }
    if (escalatedEvents.length > 0 || recoveringEvents.length > 0) {
      const dynamics = [];
      if (escalatedEvents.length > 0) dynamics.push(`\u2022 **Escalated Momentum**: ${escalatedEvents.map((e) => `**${e.symbol}**`).join(", ")} currently experiencing elevated order-flow surges and expanding volatility.`);
      if (recoveringEvents.length > 0) dynamics.push(`\u2022 **Mean-Reversion Recovery**: ${recoveringEvents.map((e) => `**${e.symbol}**`).join(", ")} exhibiting stabilization and price reversion back towards the baseline anchor.`);
      sections.push(`### \u{1F504} Market Lifecycle Dynamics
${dynamics.join("\n")}`);
    }
    sections.push(`### \u{1F4CB} Tactical Recommendations
\u2022 **Review Attention Queue**: Inspect ${criticalSymbols.join(", ") || "priority symbols"} to confirm if price moves align with broader market themes.
\u2022 **Verify Order Triggers**: Check buy reminder targets and stop-loss levels for triggered assets.
\u2022 **Re-anchor Baseline**: If current market prints represent the new norm, take a new snapshot to silence baseline drift.`);
  }
  return sections.join("\n\n");
}
function triggerGeminiBriefingRefresh(timeElapsedStr, scores, events) {
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
### \u23F1\uFE0F Baseline Drift: [Time elapsed]
### \u{1F4CA} Portfolio Alert Matrix: [Summary of critical vs secondary alerts]
### \u{1F3AF} Primary Driver: [Top asset and reason]
### \u{1F504} Lifecycle Dynamics: [Escalated vs recovering status]
### \u{1F4CB} Tactical Recommendations: [Specific bullet points]

Rules:
- Adopt a disciplined, quantitative terminal tone.
- Bold key ticker symbols and scores.
- Use clean bullet points where appropriate.
- Keep concise, high-signal, under 140 words.`;
  ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt }).then((response) => {
    if (response.text) {
      cachedBriefing = response.text.trim();
      lastBriefingTime = Date.now();
    }
  }).catch((err) => {
    const errMsg = err?.message || String(err);
    const isAuthError = errMsg.includes("401") || errMsg.includes("UNAUTHENTICATED") || errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED") || errMsg.includes("invalid authentication credentials");
    if (isAuthError) markGeminiAuthFailed();
    else console.warn("[GEMINI] Briefing generation note:", errMsg);
    lastBriefingTime = Date.now();
  }).finally(() => {
    isGeneratingBriefing = false;
  });
}
function synthesizeExecutiveBriefing(timeElapsedStr, scores, compressedInsights, events) {
  const now = Date.now();
  const deterministic = buildDeterministicBriefing(timeElapsedStr, scores, events);
  if (cachedBriefing && cachedBriefing.startsWith(">>> EXECUTIVE BRIEFING")) {
    cachedBriefing = "";
  }
  const ai = getGeminiClient();
  if (ai && (now - lastBriefingTime > 6e4 || !cachedBriefing)) {
    triggerGeminiBriefingRefresh(timeElapsedStr, scores, events);
  }
  if (cachedBriefing && now - lastBriefingTime < 9e4) {
    return cachedBriefing;
  }
  cachedBriefing = deterministic;
  return cachedBriefing;
}
async function assembleMarketOverview() {
  const now = Date.now();
  updateEventLifecycle(now);
  const sectorMovements = calculateSectorMovements();
  const stocks = Array.from(liveQuotes.values());
  const watchlist = Array.from(userWatchlist.values());
  const attentionScores = {};
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
  const buyReminders = [];
  watchlist.forEach((item) => {
    const q = liveQuotes.get(item.symbol);
    if (!q) return;
    const thresh = item.customThresholds;
    if (!thresh?.targetBuyPrice || thresh.targetBuyActive === false) return;
    const targetCurrency = thresh.targetBuyCurrency || "INR";
    const currentPriceInTarget = targetCurrency === "INR" ? q.priceINR || (q.currency === "INR" ? q.price : Number((q.price * USD_INR_EXCHANGE_RATE).toFixed(2))) : q.currency === "USD" ? q.price : Number((q.price / USD_INR_EXCHANGE_RATE).toFixed(2));
    const targetType = thresh.targetType || (currentPriceInTarget <= thresh.targetBuyPrice ? "DIP_BUY" : "BREAKOUT_BUY");
    const hysteresisPct = thresh.hysteresisBufferPct ?? 0.5;
    const cooldownMs = (thresh.cooldownMinutes ?? 30) * 60 * 1e3;
    const isDirectHit = targetType === "DIP_BUY" ? currentPriceInTarget <= thresh.targetBuyPrice : currentPriceInTarget >= thresh.targetBuyPrice;
    const rearmRequiredPrice = targetType === "DIP_BUY" ? Number((thresh.targetBuyPrice * (1 + hysteresisPct / 100)).toFixed(2)) : Number((thresh.targetBuyPrice * (1 - hysteresisPct / 100)).toFixed(2));
    if (thresh.targetBuyTriggered) {
      const hasRebounded = targetType === "DIP_BUY" ? currentPriceInTarget >= rearmRequiredPrice : currentPriceInTarget <= rearmRequiredPrice;
      if (hasRebounded) thresh.targetBuyTriggered = false;
    }
    const isTriggered = isDirectHit || Boolean(thresh.targetBuyTriggered);
    const gapPct = Number(((currentPriceInTarget - thresh.targetBuyPrice) / thresh.targetBuyPrice * 100).toFixed(2));
    if (isDirectHit && !thresh.targetBuyTriggered) {
      thresh.targetBuyTriggered = true;
      thresh.targetBuyTriggeredAt = Date.now();
      thresh.lastAlertDispatchedAt = Date.now();
      thresh.lastAlertPrice = currentPriceInTarget;
    }
    const timeSinceAlert = thresh.lastAlertDispatchedAt ? now - thresh.lastAlertDispatchedAt : Infinity;
    buyReminders.push({
      symbol: item.symbol,
      stockName: q.name,
      sector: q.sector,
      targetBuyPrice: thresh.targetBuyPrice,
      targetBuyCurrency: targetCurrency,
      targetType,
      currentPrice: q.price,
      priceInTargetCurrency: currentPriceInTarget,
      gapPct,
      triggered: isTriggered,
      triggeredAt: thresh.targetBuyTriggeredAt,
      note: thresh.targetBuyNote || `Buy reminder target: ${targetCurrency === "INR" ? "\u20B9" : "$"}${thresh.targetBuyPrice.toLocaleString()}`,
      hysteresisBufferPct: hysteresisPct,
      cooldownMinutes: thresh.cooldownMinutes ?? 30,
      suppressedOscillationsCount: thresh.suppressedOscillationsCount || 0,
      isThrottled: Boolean(thresh.targetBuyTriggered && timeSinceAlert < cooldownMs),
      rearmRequiredPrice,
      antiWhipsawActive: true
    });
  });
  const needsAttentionCount = Object.values(attentionScores).filter((s) => s.category === "NEEDS_ATTENTION").length;
  const worthKnowingCount = Object.values(attentionScores).filter((s) => s.category === "WORTH_KNOWING").length;
  const normalCount = Object.values(attentionScores).filter((s) => s.category === "NO_MEANINGFUL_CHANGE").length;
  const activeAlertsCount = events.filter((e) => e.currentState !== "RESOLVED").length;
  const unusualVolumeCount = stocks.filter((s) => s.volume / s.avgVolume >= 1.5).length;
  const triggeredBuyAlertsCount = buyReminders.filter((b) => b.triggered).length;
  const feedHealth = {
    status: feedStatus,
    latencyMs: feedLatency + Math.floor(Math.random() * 8),
    activeFeed: "DIRECT_EXCHANGE",
    lastTickTimestamp: now,
    conflictsResolvedCount: conflictsResolvedCounter,
    cacheHitRatio: 0.94,
    isSimulated: true
  };
  return {
    feedHealth,
    memory: {
      currentBaseline: activeBaseline,
      availableSnapshots: savedSnapshots.map((s) => ({ id: s.id, timestamp: s.timestamp, label: s.label })),
      timeSinceBaselineFormatted: elapsedFormatted,
      elapsedSeconds: Math.floor(elapsedMs / 1e3)
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
      triggeredBuyAlertsCount
    }
  };
}

// server/routes/marketRouter.ts
var router4 = (0, import_express4.Router)();
router4.get("/overview", async (_req, res) => {
  try {
    const overview = await assembleMarketOverview();
    res.json(overview);
  } catch (err) {
    console.error("[MARKET] Overview error:", err);
    res.status(500).json({ error: "Failed to assemble market intelligence", details: err?.message });
  }
});
var handleSimulationTrigger = (req, res) => {
  const { scenario } = req.body;
  const now = Date.now();
  if (scenario === "TECH_SECTOR_RALLY") {
    liveQuotes.forEach((q) => {
      if (q.sector === "Semiconductors" || q.sector === "Cloud/Software") {
        const bump = 1 + (0.025 + Math.random() * 0.035);
        q.price = Number((q.price * bump).toFixed(2));
        q.changePct = Number((q.changePct + (bump - 1) * 100).toFixed(2));
        q.volume = Math.round(q.volume * 1.85);
        q.volatility += 6.5;
        q.dayHigh = Math.max(q.dayHigh, q.price);
      }
    });
    const semiEvent = {
      id: `evt_sim_semi_${now}`,
      symbol: "SEMIS_INDEX",
      sector: "Semiconductors",
      scope: "SECTOR_WIDE",
      title: "Coordinated AI Hardware Supply Shock Rally",
      summary: "Semiconductor basket exploded +4.2% on aggressive institutional sweep orders.",
      currentState: "ESCALATED",
      severity: "CRITICAL",
      detectedAt: now,
      lastTransitionAt: now,
      peakDeviationPct: 4.6,
      currentDeviationPct: 4.2,
      volumeMultiple: 2.3,
      signalsInvolved: ["SECTOR_CORRELATION", "PRICE_MOVE", "VOLUME_SPIKE"],
      stateHistory: [
        { state: "DEVELOPING", timestamp: now - 6e4, metricSummary: "+1.9% at 1.4x vol", reason: "Order flow clustering" },
        { state: "ESCALATED", timestamp: now, metricSummary: "+4.6% breakout at 2.3x vol", reason: "Major ETF rebalancing in hardware" }
      ]
    };
    activeEvents.set(semiEvent.id, semiEvent);
  } else if (scenario === "ENERGY_PULLBACK") {
    liveQuotes.forEach((q) => {
      if (q.sector === "Energy") {
        const drop = 1 - (0.028 + Math.random() * 0.02);
        q.price = Number((q.price * drop).toFixed(2));
        q.changePct = Number((q.changePct - (1 - drop) * 100).toFixed(2));
        q.volume = Math.round(q.volume * 1.5);
        q.dayLow = Math.min(q.dayLow, q.price);
      }
    });
  } else if (scenario === "NVDA_BREAKOUT") {
    const nvda = liveQuotes.get("NVDA");
    if (nvda) {
      nvda.price = Number((nvda.price * 1.058).toFixed(2));
      nvda.changePct += 5.8;
      nvda.volume = Math.round(nvda.avgVolume * 2.8);
      nvda.volatility += 12;
      nvda.dayHigh = Math.max(nvda.dayHigh, nvda.price);
    }
  } else if (scenario === "RESOLVE_EVENTS") {
    activeEvents.forEach((evt) => {
      evt.currentState = "RESOLVED";
      evt.lastTransitionAt = now;
      evt.stateHistory.push({ state: "RESOLVED", timestamp: now, metricSummary: "Spreads normalized back to median range", reason: "Trader initiated manual event resolution cycle" });
    });
  } else if (scenario === "FEED_ARBITRAGE_CONFLICT") {
    incrementConflicts(4);
    setFeedStatus("CONFLICT_RESOLVED", 85);
    setTimeout(() => setFeedStatus("LIVE", 24), 5e3);
  } else if (scenario === "FLASH_CRASH_SWEEP") {
    const q = liveQuotes.get("NVDA") || Array.from(liveQuotes.values())[0];
    if (q) {
      const preDropPrice = q.price;
      const troughPrice = Number((preDropPrice * 0.918).toFixed(2));
      q.price = troughPrice;
      q.change = Number((q.change - (preDropPrice - troughPrice)).toFixed(2));
      q.changePct = Number((q.changePct - 8.2).toFixed(2));
      q.volume = Math.round(q.volume * 2.8);
      q.volatility += 14.5;
      q.dayLow = Math.min(q.dayLow, troughPrice);
      q.ticks.push({ time: new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), price: troughPrice, volume: q.volume });
      q.liquiditySweep = {
        detected: true,
        dropPct: -8.2,
        troughPrice,
        preDropPrice,
        durationSeconds: 45,
        recoveredAt: 0,
        baselinePreserved: true,
        notes: `Flash crash liquidity air-pocket absorbed within 45s. V-Shape mean-reversion confirmed. Memory baseline preserved at $${preDropPrice.toFixed(2)}.`
      };
      const sweepEvt = {
        id: `evt_sweep_${q.symbol}_${now}`,
        symbol: q.symbol,
        sector: q.sector,
        scope: "STOCK_SPECIFIC",
        title: `\u26A1 Flash Crash Liquidity Sweep: ${q.symbol} -8.2% V-Reversal`,
        summary: `Instant liquidity hole dumped ${q.symbol} to $${troughPrice.toFixed(2)}. Algorithmic V-pattern detected; memory baseline anchor strictly preserved.`,
        currentState: "RECOVERING",
        severity: "CRITICAL",
        detectedAt: now,
        lastTransitionAt: now,
        peakDeviationPct: -8.2,
        currentDeviationPct: -8.2,
        volumeMultiple: 2.8,
        signalsInvolved: ["PRICE_MOVE", "VOLUME_SPIKE", "VOLATILITY_EXPANSION"],
        stateHistory: [
          { state: "DEVELOPING", timestamp: now - 3e4, metricSummary: "-2.1% rapid print", reason: "Order book liquidity gap" },
          { state: "ESCALATED", timestamp: now - 15e3, metricSummary: "-8.2% flash trough", reason: "Stop loss cascade" },
          { state: "RECOVERING", timestamp: now, metricSummary: "Rapid bid replenishment", reason: "V-Shape Mean Reversion confirmed. Baseline intact." }
        ]
      };
      activeEvents.set(sweepEvt.id, sweepEvt);
      setTimeout(() => {
        const recoverQ = liveQuotes.get(q.symbol);
        if (recoverQ) {
          recoverQ.price = Number((preDropPrice * 0.996).toFixed(2));
          recoverQ.change = Number((recoverQ.price - preDropPrice).toFixed(2));
          recoverQ.changePct = Number((recoverQ.changePct + 8).toFixed(2));
          recoverQ.dayHigh = Math.max(recoverQ.dayHigh, recoverQ.price);
          recoverQ.ticks.push({ time: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), price: recoverQ.price, volume: Math.round(recoverQ.volume * 1.2) });
          if (recoverQ.liquiditySweep) recoverQ.liquiditySweep.recoveredAt = Date.now();
          const evt = activeEvents.get(sweepEvt.id);
          if (evt) {
            evt.currentState = "RESOLVED";
            evt.currentDeviationPct = -0.4;
            evt.stateHistory.push({ state: "RESOLVED", timestamp: Date.now(), metricSummary: "Fully recovered to pre-flash price (-0.4%)", reason: "V-shape bounce verified. Memory baseline remained undisturbed." });
          }
        }
      }, 4500);
    }
  } else if (scenario === "TARGET_WHIPSAW_HOVER") {
    let targetSym = "TCS";
    let entry = userWatchlist.get(targetSym);
    if (!entry) {
      const first = Array.from(userWatchlist.values())[0];
      targetSym = first?.symbol || "NVDA";
      entry = first;
    }
    const q = liveQuotes.get(targetSym);
    if (q && entry) {
      const currentInINR = q.priceINR || (q.currency === "INR" ? q.price : Math.round(q.price * USD_INR_EXCHANGE_RATE));
      entry.customThresholds.targetBuyPrice = Math.round(currentInINR);
      entry.customThresholds.targetBuyActive = true;
      entry.customThresholds.targetType = "DIP_BUY";
      entry.customThresholds.hysteresisBufferPct = 0.5;
      entry.customThresholds.cooldownMinutes = 30;
      entry.customThresholds.targetBuyTriggered = true;
      entry.customThresholds.lastAlertDispatchedAt = Date.now() - 6e4;
      entry.customThresholds.lastAlertPrice = currentInINR;
      entry.customThresholds.suppressedOscillationsCount = (entry.customThresholds.suppressedOscillationsCount || 0) + 14;
      q.priceINR = Math.round(currentInINR * 1.002);
      q.price = q.currency === "INR" ? q.priceINR : Number((q.priceINR / USD_INR_EXCHANGE_RATE).toFixed(2));
    }
  }
  res.json({ success: true, scenarioApplied: scenario, timestamp: now });
};
router4.post("/simulate", handleSimulationTrigger);
var marketRouter_default = router4;

// server/routes/memoryRouter.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.post("/snapshot", async (req, res) => {
  const { label, description } = req.body;
  const now = Date.now();
  const snapshotQuotes = {};
  liveQuotes.forEach((quote, sym) => {
    const effectivePrice = quote.liquiditySweep?.detected && !quote.liquiditySweep?.recoveredAt ? quote.liquiditySweep.preDropPrice : quote.price;
    snapshotQuotes[sym] = { price: effectivePrice, volume: quote.volume, volatility: quote.volatility, timestamp: now };
  });
  const newSnapshot = {
    id: `snap_${now}`,
    timestamp: now,
    label: label || `Manual Checkpoint (${new Date(now).toLocaleTimeString()})`,
    description: description || "User reviewed market changes and reset the baseline reference point.",
    quotes: snapshotQuotes
  };
  setActiveBaseline(newSnapshot);
  savedSnapshots.unshift(newSnapshot);
  if (savedSnapshots.length > 10) savedSnapshots.pop();
  const userId = req.userId || "usr_demo_1";
  marketRepository.anchorPortfolioBaseline(
    userId,
    newSnapshot.id,
    newSnapshot.label,
    newSnapshot.description,
    Object.entries(snapshotQuotes).map(([sym, q]) => ({ symbol: sym, price: q.price, volume: q.volume, volatility: q.volatility, timestamp: q.timestamp }))
  ).catch((err) => console.error("[DATABASE] \u26A0\uFE0F Failed to commit baseline transaction:", err));
  res.json({ success: true, snapshot: newSnapshot, transactionCommitted: true });
});
var handleBaselineSelect = (req, res) => {
  const { snapshotId, offsetHours } = req.body;
  const now = Date.now();
  if (offsetHours !== void 0 && typeof offsetHours === "number") {
    const simulatedTs = now - offsetHours * 3600 * 1e3;
    const syntheticQuotes = {};
    liveQuotes.forEach((quote, sym) => {
      const variance = (Math.random() - 0.5) * 0.05 * (offsetHours / 2);
      syntheticQuotes[sym] = {
        price: Number((quote.price * (1 - variance)).toFixed(2)),
        volume: Math.round(quote.volume * Math.max(0.2, 1 - offsetHours * 0.15)),
        volatility: Number(Math.max(10, quote.volatility - offsetHours * 2).toFixed(1)),
        timestamp: simulatedTs
      };
    });
    const newBaseline = {
      id: `snap_offset_${offsetHours}h_${now}`,
      timestamp: simulatedTs,
      label: `Simulated: ${offsetHours} Hours Ago`,
      description: `Fast-forward time displacement: see what changed since ${offsetHours} hours ago.`,
      quotes: syntheticQuotes
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
router5.post("/switch-baseline", handleBaselineSelect);
router5.post("/select-baseline", handleBaselineSelect);
var memoryRouter_default = router5;

// server/routes/alertsRouter.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
router6.get("/audit", async (req, res) => {
  const userId = req.userId || "usr_demo_1";
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  try {
    const logs = await marketRepository.getAlertAuditLogs(userId, limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to retrieve alert audit trail" });
  }
});
var alertsRouter_default = router6;

// server/routes/brokerRouter.ts
var import_express7 = require("express");
var router7 = (0, import_express7.Router)();
var brokerState = {
  provider: "groww",
  connected: false,
  mode: "SANDBOX",
  supportedFeatures: [
    "Real-time NSE/BSE tick feeds",
    "Limit & Market order placement when Buy Target is reached",
    "Watchlist sync with Groww terminal",
    "Sector allocation portfolio import"
  ],
  instructions: "Groww allows connecting via personal authentication tokens or Webhook alerts. For automated Indian broker execution (NSE/BSE), set GROWW_API_TOKEN or configure Zerodha Kite Connect / Angel One SmartAPI in environment variables."
};
router7.get("/groww", (_req, res) => {
  res.json({
    ...brokerState,
    activeBuyRemindersCount: Array.from(userWatchlist.values()).filter(
      (w) => w.customThresholds?.targetBuyPrice
    ).length,
    timestamp: Date.now()
  });
});
router7.post("/groww/connect", (req, res) => {
  const { apiKey, clientId, accountName } = req.body;
  brokerState = {
    ...brokerState,
    connected: true,
    clientId: clientId || "GW_8829104",
    accountName: accountName || "Primary Trading Account (Groww)",
    mode: apiKey ? "LIVE" : "SANDBOX"
  };
  res.json({ success: true, message: "Connected to Groww Brokerage Bridge", broker: brokerState });
});
var brokerRouter_default = router7;

// server/index.ts
var import_cors = __toESM(require("cors"), 1);
var app = (0, import_express8.default)();
app.use((0, import_cors.default)({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true,
  credentials: true
}));
app.use(import_express8.default.json());
app.use(resolveSessionUser);
app.use("/api", healthRouter_default);
app.use("/api/auth", authRouter_default);
app.use("/api/watchlist", watchlistRouter_default);
app.use("/api/market", marketRouter_default);
app.post("/api/simulation/scenario", (req, res) => {
  req.url = "/simulate";
  marketRouter_default.handle(req, res, () => {
  });
});
app.use("/api/memory", memoryRouter_default);
app.use("/api/alerts", alertsRouter_default);
app.use("/api/broker", brokerRouter_default);
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});
async function startServer() {
  await marketRepository.initialize();
  initializeMarketState();
  const now = Date.now();
  const baselineTs = now - (3 * 3600 * 1e3 + 15 * 60 * 1e3);
  seedInitialEvents(baselineTs, now);
  startTickSimulator();
  if (NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express8.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
[TERMINAL] \u{1F680} PulseWatch server initialized on http://0.0.0.0:${PORT}`);
    console.log(`[TERMINAL] \u{1F4C2} Architecture: Modular Microservice (14 modules)`);
    console.log(`[TERMINAL] \u{1F5C4}\uFE0F  Database: SQLite WAL + ACID Transactions + Foreign Keys`);
    console.log(`[TERMINAL] \u{1F3D7}\uFE0F  Repository: Hexagonal Pattern (IMarketRepository)
`);
  });
}
startServer().catch((err) => {
  console.error("[FATAL] Server startup failed:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
