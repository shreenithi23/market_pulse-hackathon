export type AttentionCategory = 'NEEDS_ATTENTION' | 'WORTH_KNOWING' | 'NO_MEANINGFUL_CHANGE';

export type EventLifecycleState = 'DEVELOPING' | 'ESCALATED' | 'RECOVERING' | 'RESOLVED';

export type EventScope = 'STOCK_SPECIFIC' | 'SECTOR_WIDE' | 'MARKET_WIDE';

export type SignalType = 
  | 'PRICE_MOVE' 
  | 'VOLUME_SPIKE' 
  | 'VOLATILITY_EXPANSION' 
  | 'THRESHOLD_BREACH' 
  | 'SECTOR_CORRELATION';

export interface MarketSignal {
  type: SignalType;
  label: string;
  points: number; // contribution to 0-100 score
  maxPoints: number;
  description: string;
  currentValue: number;
  baselineValue: number;
  deltaPct: number;
  severity: 'INFO' | 'WARN' | 'CRIT';
}

export interface ExplainableRationale {
  signalType: SignalType;
  headline: string;
  detail: string;
  impactScore: number;
  isCustomAlert: boolean;
}

export interface AttentionScoreData {
  symbol: string;
  totalScore: number; // 0-100
  category: AttentionCategory;
  urgencyRank: number;
  signals: MarketSignal[];
  rationales: ExplainableRationale[];
  primaryDriver: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  currency?: 'INR' | 'USD';
  priceINR?: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volatility: number; // % annualized intraday ATR
  dayHigh: number;
  dayLow: number;
  high52: number;
  low52: number;
  lastUpdated: number;
  ticks: Array<{ time: string; price: number; volume: number }>;
  // "Flash Crash" V-Shape Reversal & Liquidity Sweep detection
  liquiditySweep?: LiquiditySweepInfo;
}

export interface LiquiditySweepInfo {
  detected: boolean;
  dropPct: number;
  troughPrice: number;
  preDropPrice: number;
  durationSeconds: number;
  recoveredAt: number;
  baselinePreserved: boolean;
  notes: string;
}

export type TargetBuyType = 'DIP_BUY' | 'BREAKOUT_BUY';

export interface UserThresholdConfig {
  priceChangePct: number; // e.g. 2.5%
  volumeMultiplier: number; // e.g. 1.8x
  volatilityJumpPct: number; // e.g. 25%
  targetHighPrice?: number;
  targetLowPrice?: number;
  // Buy Target Reminder (e.g. buy at X rupees / dollars)
  targetBuyPrice?: number;
  targetBuyCurrency?: 'INR' | 'USD';
  targetBuyActive?: boolean;
  targetBuyTriggered?: boolean;
  targetBuyTriggeredAt?: number;
  targetBuyNote?: string;
  // Anti-Whipsaw & In-line Validation Config
  targetType?: TargetBuyType; // 'DIP_BUY' (price <= target) or 'BREAKOUT_BUY' (price >= target)
  hysteresisBufferPct?: number; // e.g. 0.5% required rebound before re-arming
  cooldownMinutes?: number; // e.g. 30 minutes notification throttling
  lastAlertDispatchedAt?: number;
  lastAlertPrice?: number;
  suppressedOscillationsCount?: number; // Count of whipsaw hover crosses suppressed
}

export interface WatchlistRecord {
  symbol: string;
  addedAt: number;
  customThresholds: Partial<UserThresholdConfig>;
  userNotes?: string;
  tags?: string[];
}

export interface MemoryBaselineSnapshot {
  id: string;
  timestamp: number;
  label: string;
  description: string;
  quotes: Record<string, {
    price: number;
    volume: number;
    volatility: number;
    timestamp: number;
  }>;
}

export interface LifecycleTransition {
  state: EventLifecycleState;
  timestamp: number;
  metricSummary: string;
  reason: string;
}

export interface MarketEvent {
  id: string;
  symbol: string;
  sector: string;
  scope: EventScope;
  title: string;
  summary: string;
  currentState: EventLifecycleState;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedAt: number;
  lastTransitionAt: number;
  peakDeviationPct: number;
  currentDeviationPct: number;
  volumeMultiple: number;
  stateHistory: LifecycleTransition[];
  signalsInvolved: SignalType[];
}

export interface CompressedInsight {
  id: string;
  scope: EventScope;
  category: AttentionCategory;
  sector?: string;
  symbols: string[];
  headline: string;
  deduplicatedCount: number;
  executiveSummary: string;
  actionableContext: string;
  signals: string[];
  highestScore: number;
}

export interface DynamicGroup {
  id: string;
  name: string;
  code: string;
  description: string;
  symbols: string[];
  badgeColor: 'green' | 'amber' | 'red' | 'blue' | 'purple';
  metricHighlight: string;
}

export interface SectorMovement {
  sector: string;
  avgChangePct: number;
  advancersCount: number;
  declinersCount: number;
  totalStocks: number;
  volumeMultiplier: number;
  isCorrelatedSurge: boolean;
  isCorrelatedDrop: boolean;
  correlationScore: number;
}

export interface DataFeedHealth {
  status: 'LIVE' | 'DELAYED' | 'STALE' | 'CONFLICT_RESOLVED';
  latencyMs: number;
  activeFeed: 'DIRECT_EXCHANGE' | 'CONSOLIDATED_TAPE' | 'SYNTHETIC_PEER';
  lastTickTimestamp: number;
  conflictsResolvedCount: number;
  cacheHitRatio: number;
  isSimulated: boolean;
}

export interface MarketMemoryState {
  currentBaseline: MemoryBaselineSnapshot;
  availableSnapshots: Array<{ id: string; timestamp: number; label: string }>;
  timeSinceBaselineFormatted: string;
  elapsedSeconds: number;
}

export interface BuyReminderAlert {
  symbol: string;
  stockName: string;
  sector: string;
  targetBuyPrice: number;
  targetBuyCurrency: 'INR' | 'USD';
  targetType?: TargetBuyType;
  currentPrice: number;
  priceInTargetCurrency: number;
  gapPct: number;
  triggered: boolean;
  triggeredAt?: number;
  note?: string;
  // Edge Case: Whipsaw & Hysteresis Protection
  hysteresisBufferPct?: number;
  cooldownMinutes?: number;
  suppressedOscillationsCount?: number;
  isThrottled?: boolean;
  rearmRequiredPrice?: number;
  antiWhipsawActive?: boolean;
}

export interface SectorAllocation {
  sector: string;
  count: number;
  weightPct: number;
  symbols: string[];
  status: 'OVERWEIGHT' | 'BALANCED' | 'UNDERWEIGHT' | 'MISSING';
}

export interface TopKStockPick {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  currency: 'INR' | 'USD';
  priceINR: number;
  changePct: number;
  volume: number;
  beta: number;
  volatility: number;
  rank: number;
  whyPick: string;
  isInWatchlist: boolean;
  peRatio?: number;
  marketCapTier?: 'MEGA' | 'LARGE' | 'MID';
}

export interface DiversificationRecommendation {
  id: string;
  targetSector: string;
  sourceOverweightSector: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  headline: string;
  rationale: string;
  diversificationBenefit: string;
  correlationImpact: string;
  topKStocks: TopKStockPick[];
}

export interface PortfolioDiversificationData {
  userSectorDistribution: SectorAllocation[];
  dominantSector: string;
  concentrationRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  concentrationSummary: string;
  recommendations: DiversificationRecommendation[];
  allSectorTopPicks: Record<string, TopKStockPick[]>;
}

export interface MarketOverviewResponse {
  feedHealth: DataFeedHealth;
  memory: MarketMemoryState;
  watchlist: WatchlistRecord[];
  stocks: StockQuote[];
  attentionScores: Record<string, AttentionScoreData>;
  events: MarketEvent[];
  compressedInsights: CompressedInsight[];
  dynamicGroups: DynamicGroup[];
  sectorMovements: SectorMovement[];
  personalizedExecutiveBriefing: string;
  buyReminders?: BuyReminderAlert[];
  diversification?: PortfolioDiversificationData;
  systemSummary: {
    totalTracked: number;
    needsAttentionCount: number;
    worthKnowingCount: number;
    normalCount: number;
    activeAlertsCount: number;
    unusualVolumeCount: number;
    triggeredBuyAlertsCount?: number;
  };
}
