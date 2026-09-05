export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  passwordHash: string;
  passwordSalt: string;
  emailVerified: boolean;
  currencyPreference: 'INR' | 'USD';
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  investmentHorizon: 'INTRADAY' | 'SWING' | 'LONG_TERM';
  defaultTargetBuyAlertChannel: 'APP_AND_EMAIL' | 'APP_ONLY';
  growwClientId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WatchlistDbItem {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  sector: string;
  addedAt: number;
  userNotes: string;
  tags: string[];
}

export interface BaselineQuoteItem {
  symbol: string;
  price: number;
  volume: number;
  volatility: number;
  timestamp: number;
}

export interface SnapshotMetaItem {
  id: string;
  userId: string;
  label: string;
  description: string;
  timestamp: number;
  isActive: boolean;
}

export interface AlertRuleDbItem {
  id: string;
  userId: string;
  symbol: string;
  targetBuyPrice?: number;
  targetBuyCurrency: 'INR' | 'USD';
  targetType: 'DIP_BUY' | 'BREAKOUT_BUY';
  targetBuyActive: boolean;
  targetBuyTriggered: boolean;
  targetBuyTriggeredAt?: number;
  targetBuyNote?: string;
  priceShiftThreshold: number;
  volumeSpikeThreshold: number;
  hysteresisBandPct: number;
  cooldownMinutes: number;
  lastTriggeredAt?: number;
  lastTriggeredPrice?: number;
  suppressedOscillationsCount: number;
}

export interface AlertAuditLogItem {
  id: string;
  userId: string;
  symbol: string;
  triggerType: string;
  triggerPrice: number;
  attentionScore: number;
  message: string;
  suppressedCount: number;
  triggeredAt: number;
}

/**
 * Storage Interface Abstraction (Hexagonal / Repository Pattern)
 * Decouples market logic and Express endpoints from the underlying database.
 * Enables drop-in replacement of SQLite with PostgreSQL, Supabase, or Cloud SQL.
 */
export interface IMarketRepository {
  // Database Lifecycle & Health
  initialize(): Promise<void>;
  close(): void;
  getDbStats(): { path: string; journalMode: string; tableCounts: Record<string, number> };

  // Users & Authentication
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  upsertUser(user: UserRecord): Promise<void>;
  createSession(token: string, userId: string, expiresAt: number): Promise<void>;
  getSessionUserId(token: string): Promise<string | null>;
  deleteSession(token: string): Promise<void>;

  // Watchlist Management
  getWatchlist(userId: string): Promise<WatchlistDbItem[]>;
  addWatchlistItem(item: WatchlistDbItem): Promise<void>;
  removeWatchlistItem(userId: string, symbol: string): Promise<boolean>;

  // Alert Rules & Anti-Whipsaw State Machine
  getAlertRule(userId: string, symbol: string): Promise<AlertRuleDbItem | null>;
  getAllAlertRules(userId: string): Promise<AlertRuleDbItem[]>;
  saveAlertRule(rule: AlertRuleDbItem): Promise<void>;
  deleteAlertRule(userId: string, symbol: string): Promise<boolean>;
  recordSuppressedOscillation(userId: string, symbol: string): Promise<number>;

  // Temporal Baseline Snapshots (ACID Transactions)
  anchorPortfolioBaseline(
    userId: string,
    snapshotId: string,
    label: string,
    description: string,
    quotes: BaselineQuoteItem[]
  ): Promise<{ snapshotId: string; timestamp: number; tickerCount: number }>;
  
  getActiveBaseline(userId: string): Promise<{ meta: SnapshotMetaItem | null; quotes: Record<string, BaselineQuoteItem> }>;
  getAllSnapshots(userId: string): Promise<SnapshotMetaItem[]>;
  setActiveSnapshot(userId: string, snapshotId: string): Promise<boolean>;

  // Anomaly & Alert Audit Trail (Immutable Log)
  recordAlertAudit(log: Omit<AlertAuditLogItem, 'id' | 'triggeredAt'> & { id?: string; triggeredAt?: number }): Promise<void>;
  getAlertAuditLogs(userId: string, limit?: number): Promise<AlertAuditLogItem[]>;
}
