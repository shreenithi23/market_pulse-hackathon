import React, { useState, useMemo } from 'react';
import {
  CompressedInsight,
  AttentionScoreData,
  MarketEvent,
  MarketMemoryState,
  StockQuote
} from '../types/market';
import {
  FileText,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Activity,
  Compass,
  ArrowUpRight,
  LayoutDashboard,
  AlignLeft
} from 'lucide-react';

interface ExecutiveBriefingProps {
  briefing: string;
  compressedInsights: CompressedInsight[];
  totalTracked: number;
  attentionScores?: Record<string, AttentionScoreData>;
  events?: MarketEvent[];
  systemSummary?: {
    totalTracked: number;
    needsAttentionCount: number;
    worthKnowingCount: number;
    normalCount: number;
    activeAlertsCount: number;
    unusualVolumeCount: number;
    triggeredBuyAlertsCount?: number;
  };
  memory?: MarketMemoryState;
  stocks?: StockQuote[];
  onSelectStock?: (symbol: string) => void;
  onResetSnapshot?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

interface ParsedSection {
  title: string;
  iconType: 'time' | 'matrix' | 'driver' | 'lifecycle' | 'recommendation' | 'general';
  paragraphs: string[];
  bullets: string[];
}

export const ExecutiveBriefing: React.FC<ExecutiveBriefingProps> = ({
  briefing,
  compressedInsights,
  totalTracked,
  attentionScores = {},
  events = [],
  systemSummary,
  memory,
  stocks = [],
  onSelectStock,
  onResetSnapshot,
  onNavigateToTab
}) => {
  const [showPipeline, setShowPipeline] = useState(false);
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'DOCUMENT'>('DASHBOARD');
  const [copied, setCopied] = useState(false);

  // Copy Briefing text to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(briefing);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse briefing text into structured visual sections (supporting Markdown or deterministic delimiters)
  const parsedSections = useMemo((): ParsedSection[] => {
    if (!briefing) return [];

    // Normalize text if it was legacy single line with delimiters
    let text = briefing;
    if (text.includes('>>> EXECUTIVE BRIEFING')) {
      text = text.replace('>>> EXECUTIVE BRIEFING | ', '');
    }

    // Split on markdown headers "###" or traditional section prefixes
    const rawChunks = text.split(/\n\s*\n|(?=###\s+)/);
    const sections: ParsedSection[] = [];

    rawChunks.forEach((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;

      let title = 'Executive Notice';
      let iconType: ParsedSection['iconType'] = 'general';
      let bodyText = trimmed;

      if (trimmed.startsWith('###')) {
        const headerEndIdx = trimmed.indexOf('\n');
        if (headerEndIdx !== -1) {
          title = trimmed.slice(0, headerEndIdx).replace(/^###\s*/, '').trim();
          bodyText = trimmed.slice(headerEndIdx).trim();
        } else {
          title = trimmed.replace(/^###\s*/, '').trim();
          bodyText = '';
        }
      } else if (trimmed.startsWith('BASELINE SNAPSHOT') || trimmed.includes('Baseline Drift')) {
        title = 'Baseline Drift & Posture';
        iconType = 'time';
      } else if (trimmed.startsWith('ALERT MATRIX') || trimmed.includes('Portfolio Alert Matrix') || trimmed.startsWith('MARKET QUIET')) {
        title = 'Portfolio Alert Matrix';
        iconType = 'matrix';
      } else if (trimmed.startsWith('PRIMARY DRIVER') || trimmed.includes('Primary Urgency Driver')) {
        title = 'Primary Urgency Driver';
        iconType = 'driver';
      } else if (trimmed.startsWith('LIFECYCLE STATUS') || trimmed.includes('Market Lifecycle Dynamics')) {
        title = 'Lifecycle Dynamics';
        iconType = 'lifecycle';
      } else if (trimmed.startsWith('RECOMMENDATION') || trimmed.includes('Tactical Recommendations')) {
        title = 'Tactical Recommendations';
        iconType = 'recommendation';
      }

      // Infer icon from title
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('time') || lowerTitle.includes('drift') || lowerTitle.includes('baseline') || lowerTitle.includes('snapshot')) {
        iconType = 'time';
      } else if (lowerTitle.includes('alert') || lowerTitle.includes('matrix') || lowerTitle.includes('status') || lowerTitle.includes('quiet')) {
        iconType = 'matrix';
      } else if (lowerTitle.includes('driver') || lowerTitle.includes('mover') || lowerTitle.includes('urgency')) {
        iconType = 'driver';
      } else if (lowerTitle.includes('lifecycle') || lowerTitle.includes('momentum') || lowerTitle.includes('dynamics')) {
        iconType = 'lifecycle';
      } else if (lowerTitle.includes('recommend') || lowerTitle.includes('tactical') || lowerTitle.includes('guidance')) {
        iconType = 'recommendation';
      }

      // Extract bullet points vs regular paragraphs
      const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
      const paragraphs: string[] = [];
      const bullets: string[] = [];

      lines.forEach((line) => {
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          bullets.push(line.replace(/^[•\-*]\s*/, ''));
        } else {
          paragraphs.push(line);
        }
      });

      sections.push({
        title,
        iconType,
        paragraphs,
        bullets
      });
    });

    return sections;
  }, [briefing]);

  // Priority Attention Analysis
  const needsAttentionList = useMemo(() => {
    return (Object.values(attentionScores) as AttentionScoreData[]).filter(s => s.category === 'NEEDS_ATTENTION');
  }, [attentionScores]);

  const worthKnowingList = useMemo(() => {
    return (Object.values(attentionScores) as AttentionScoreData[]).filter(s => s.category === 'WORTH_KNOWING');
  }, [attentionScores]);

  const topPriorityAsset = useMemo(() => {
    return needsAttentionList.length > 0 ? needsAttentionList[0] : null;
  }, [needsAttentionList]);

  const topPriorityQuote = useMemo(() => {
    if (!topPriorityAsset) return null;
    return stocks.find(s => s.symbol === topPriorityAsset.symbol);
  }, [topPriorityAsset, stocks]);

  // Lifecycle events grouping
  const escalatedEvents = useMemo(() => events.filter(e => e.currentState === 'ESCALATED'), [events]);
  const recoveringEvents = useMemo(() => events.filter(e => e.currentState === 'RECOVERING'), [events]);
  const developingEvents = useMemo(() => events.filter(e => e.currentState === 'DEVELOPING'), [events]);

  const timeElapsedStr = useMemo(() => {
    if (!memory?.currentBaseline?.timestamp) return 'Recent';
    const ms = Date.now() - memory.currentBaseline.timestamp;
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  }, [memory]);

  // Helper to render bold text and tags nicely
  const formatTextWithChips = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        // Check if it's a ticker symbol
        const isTicker = /^[A-Z0-9.]{2,8}$/.test(inner);
        if (isTicker) {
          return (
            <span
              key={i}
              onClick={() => onSelectStock && onSelectStock(inner)}
              className="inline-flex items-center px-2 py-0.5 mx-1 font-mono font-bold text-xs bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] rounded-lg cursor-pointer hover:text-[#4F46E5] hover:shadow-neu-inset transition-all"
            >
              {inner}
            </span>
          );
        }
        return (
          <strong key={i} className="font-display font-extrabold text-[#3D4852]">
            {inner}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <section className="relative px-4 py-5 max-w-7xl mx-auto w-full font-body">
      {/* Neumorphic Shell */}
      <div className="card-neu p-6 md:p-8 relative space-y-6">
        {/* 1. Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
              <FileText className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display font-extrabold text-xl text-[#3D4852] tracking-tight">
                  Executive Briefing: What Meaningfully Changed
                </h2>
                <span className="bg-[#E0E5EC] shadow-neu-inset-sm px-2.5 py-0.5 rounded-xl font-display font-bold text-[10px] text-[#38B2AC] uppercase flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Real-time Synthesis</span>
                </span>
              </div>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                Structured multi-stage intelligence distilling drift, urgency queues, and tactical next steps.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Toggle: Dashboard vs Formatted Document */}
            <div className="flex items-center bg-[#E0E5EC] p-1 rounded-2xl shadow-neu-inset">
              <button
                onClick={() => setViewMode('DASHBOARD')}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'DASHBOARD'
                    ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                    : 'text-[#6B7280] hover:text-[#3D4852]'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Dashboard View</span>
              </button>
              <button
                onClick={() => setViewMode('DOCUMENT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'DOCUMENT'
                    ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                    : 'text-[#6B7280] hover:text-[#3D4852]'
                }`}
              >
                <AlignLeft className="h-3.5 w-3.5" />
                <span>Formatted Memo</span>
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="btn-neu px-3 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 text-[#6B7280] hover:text-[#3D4852]"
              title="Copy synthesized briefing to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#38B2AC]" />
                  <span className="text-[#38B2AC]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Memo</span>
                </>
              )}
            </button>

            {/* Reset Snapshot Button */}
            {onResetSnapshot && (
              <button
                onClick={onResetSnapshot}
                className="btn-neu px-3 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 text-[#6B7280] hover:text-[#3D4852]"
                title="Reset memory baseline anchor to current market quotes"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#6C63FF]" />
                <span>Reset Anchor</span>
              </button>
            )}

            {/* Compression Pipeline Expander */}
            <button
              onClick={() => setShowPipeline(prev => !prev)}
              className="btn-neu px-3 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 text-[#6B7280] hover:text-[#3D4852]"
            >
              <Layers className="h-3.5 w-3.5 text-[#D97706]" />
              <span>Pipeline ({compressedInsights.length})</span>
              {showPipeline ? (
                <ChevronUp className="h-3.5 w-3.5 text-[#6B7280]" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-[#6B7280]" />
              )}
            </button>
          </div>
        </div>

        {/* 2. Top Metric Ribbon (Instant Scannability) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Tile 1: Memory Baseline Drift */}
          <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E0E5EC] shadow-neu-extrude-sm flex items-center justify-center text-[#6C63FF] shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display font-bold uppercase text-[10px] text-[#6B7280] block">Snapshot Drift</span>
              <span className="font-mono font-black text-sm text-[#3D4852]">{timeElapsedStr}</span>
            </div>
          </div>

          {/* Tile 2: Critical Urgency Count */}
          <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-[#E0E5EC] shadow-neu-extrude-sm flex items-center justify-center shrink-0 ${
              needsAttentionList.length > 0 ? 'text-[#E53E3E]' : 'text-[#38B2AC]'
            }`}>
              {needsAttentionList.length > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
            <div>
              <span className="font-display font-bold uppercase text-[10px] text-[#6B7280] block">Critical Urgency</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-black text-sm text-[#3D4852]">
                  {needsAttentionList.length}
                </span>
                <span className="text-[10px] text-[#6B7280] font-medium">assets breach</span>
              </div>
            </div>
          </div>

          {/* Tile 3: Secondary Alerts */}
          <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E0E5EC] shadow-neu-extrude-sm flex items-center justify-center text-[#D97706] shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display font-bold uppercase text-[10px] text-[#6B7280] block">Secondary Watch</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-black text-sm text-[#3D4852]">
                  {worthKnowingList.length}
                </span>
                <span className="text-[10px] text-[#6B7280] font-medium">worth knowing</span>
              </div>
            </div>
          </div>

          {/* Tile 4: Noise Filtering Efficiency */}
          <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E0E5EC] shadow-neu-extrude-sm flex items-center justify-center text-[#38B2AC] shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display font-bold uppercase text-[10px] text-[#6B7280] block">Noise Filtered</span>
              <span className="font-mono font-black text-sm text-[#38B2AC]">
                {totalTracked > 0
                  ? `${Math.round(((totalTracked - needsAttentionList.length) / totalTracked) * 100)}%`
                  : '100%'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. PRIMARY CONTENT VIEW: DASHBOARD OR FORMATTED DOCUMENT */}
        {viewMode === 'DASHBOARD' ? (
          <div className="space-y-6">
            {/* Primary Driver Spotlight & Lifecycle Dynamics */}
            <div className="space-y-6">
              {/* Marquee Headline Box */}
                <div className="bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-extrude-sm border border-[#6C63FF]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-display font-bold text-xs uppercase tracking-wider text-[#6C63FF]">
                      <Sparkles className="h-4 w-4 text-[#6C63FF]" />
                      Executive Summary & State
                    </span>
                    <span className="font-mono text-xs text-[#6B7280] bg-[#E0E5EC] shadow-neu-inset-sm px-2.5 py-1 rounded-xl">
                      Anchor: {timeElapsedStr}
                    </span>
                  </div>

                  <p className="font-body text-base text-[#3D4852] font-semibold leading-relaxed">
                    {needsAttentionList.length > 0 ? (
                      <>
                        Portfolio regime is currently <span className="text-[#E53E3E] font-bold">ACTIVE</span> with{' '}
                        <strong className="text-[#3D4852]">{needsAttentionList.length} assets</strong> exceeding tailored volatility and target boundaries since your baseline anchor {timeElapsedStr}.{' '}
                        {topPriorityAsset && (
                          <span>
                            <strong className="text-[#6C63FF]">{topPriorityAsset.symbol}</strong> commands immediate attention due to {topPriorityAsset.primaryDriver.toLowerCase()}.
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Market regime is <span className="text-[#38B2AC] font-bold">ALL QUIET</span>. All {totalTracked} tracked assets remain anchored within normal variance envelopes with zero anomalous departures recorded.
                      </>
                    )}
                  </p>

                  {/* Portfolio Urgency Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-[11px] font-mono text-[#6B7280] mb-1">
                      <span>Attention Distribution</span>
                      <span>
                        {needsAttentionList.length} Critical / {worthKnowingList.length} Secondary / {totalTracked - needsAttentionList.length - worthKnowingList.length} Quiet
                      </span>
                    </div>
                    <div className="h-3 w-full bg-[#E0E5EC] shadow-neu-inset rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${(needsAttentionList.length / (totalTracked || 1)) * 100}%` }}
                        className="bg-[#E53E3E] transition-all duration-500"
                        title="Critical Urgency"
                      />
                      <div
                        style={{ width: `${(worthKnowingList.length / (totalTracked || 1)) * 100}%` }}
                        className="bg-[#D97706] transition-all duration-500"
                        title="Secondary Awareness"
                      />
                      <div
                        style={{
                          width: `${((totalTracked - needsAttentionList.length - worthKnowingList.length) / (totalTracked || 1)) * 100}%`
                        }}
                        className="bg-[#38B2AC] transition-all duration-500"
                        title="Quiet Baseline"
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Urgent Asset Spotlight Card */}
                {topPriorityAsset ? (
                  <div className="bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-extrude-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#E53E3E]">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="font-display font-bold text-sm text-[#3D4852] uppercase tracking-wider">
                            Priority Attention Spotlight
                          </h3>
                          <span className="text-xs text-[#6B7280]">Asset commanding highest portfolio urgency</span>
                        </div>
                      </div>

                      {onSelectStock && (
                        <button
                          onClick={() => onSelectStock(topPriorityAsset.symbol)}
                          className="btn-neu px-3 py-1.5 text-xs font-display font-bold text-[#6C63FF] rounded-xl flex items-center gap-1 hover:text-[#4F46E5]"
                        >
                          <span>Inspect {topPriorityAsset.symbol}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="bg-[#E0E5EC] p-4 rounded-2xl shadow-neu-inset flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <span className="font-display font-black text-2xl text-[#3D4852]">
                          {topPriorityAsset.symbol}
                        </span>
                        {topPriorityQuote && (
                          <div>
                            <div className="font-mono font-bold text-sm text-[#3D4852]">
                              ₹{(topPriorityQuote.priceINR || (topPriorityQuote.price * 85.20)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className={`font-mono text-xs font-bold ${topPriorityQuote.changePct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'}`}>
                              {topPriorityQuote.changePct >= 0 ? '+' : ''}{topPriorityQuote.changePct.toFixed(2)}% today
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] font-display font-bold uppercase text-[#6B7280] block">Urgency Score</span>
                          <span className="font-mono font-black text-lg text-[#E53E3E]">
                            {topPriorityAsset.totalScore}<span className="text-xs text-[#6B7280]">/100</span>
                          </span>
                        </div>
                        <span className="bg-[#E0E5EC] shadow-neu-inset-sm text-[#E53E3E] text-[11px] font-bold px-2.5 py-1 rounded-xl uppercase">
                          CRITICAL
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#3D4852] font-body bg-[#E0E5EC] shadow-neu-inset-sm p-3.5 rounded-xl space-y-1">
                      <div className="font-display font-bold text-[#6C63FF] uppercase text-[10px]">
                        Primary Trigger Factor
                      </div>
                      <p className="font-medium">
                        {topPriorityAsset.primaryDriver}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-extrude-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#38B2AC] shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-[#3D4852]">No Urgent Threshold Breaches</h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">All tracked assets are fluctuating strictly within customary volatility tolerance limits.</p>
                    </div>
                  </div>
                )}

                {/* Market Lifecycle Regimes */}
                <div className="bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-extrude-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF]">
                        <Compass className="h-4 w-4" />
                      </span>
                      <h3 className="font-display font-bold text-sm text-[#3D4852] uppercase tracking-wider">
                        Active Lifecycle Regimes
                      </h3>
                    </div>
                    {onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('EVENT_LIFECYCLE')}
                        className="text-[11px] font-display font-bold text-[#6C63FF] hover:underline"
                      >
                        View Full Lifecycle Machine →
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Developing */}
                    <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-[10px] uppercase text-[#D97706]">Developing</span>
                        <span className="font-mono text-xs font-bold text-[#3D4852]">{developingEvents.length}</span>
                      </div>
                      <div className="text-[11px] font-body text-[#6B7280]">
                        {developingEvents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {developingEvents.map(e => (
                              <span key={e.id} className="font-mono font-bold text-[#3D4852]">{e.symbol}</span>
                            ))}
                          </div>
                        ) : (
                          <span>Quiet accumulation</span>
                        )}
                      </div>
                    </div>

                    {/* Escalated */}
                    <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-[10px] uppercase text-[#E53E3E]">Escalated</span>
                        <span className="font-mono text-xs font-bold text-[#3D4852]">{escalatedEvents.length}</span>
                      </div>
                      <div className="text-[11px] font-body text-[#6B7280]">
                        {escalatedEvents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {escalatedEvents.map(e => (
                              <span key={e.id} className="font-mono font-bold text-[#E53E3E]">{e.symbol}</span>
                            ))}
                          </div>
                        ) : (
                          <span>Zero runaway moves</span>
                        )}
                      </div>
                    </div>

                    {/* Recovering / Mean-Reversion */}
                    <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-inset space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-[10px] uppercase text-[#38B2AC]">Recovering</span>
                        <span className="font-mono text-xs font-bold text-[#3D4852]">{recoveringEvents.length}</span>
                      </div>
                      <div className="text-[11px] font-body text-[#6B7280]">
                        {recoveringEvents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {recoveringEvents.map(e => (
                              <span key={e.id} className="font-mono font-bold text-[#38B2AC]">{e.symbol}</span>
                            ))}
                          </div>
                        ) : (
                          <span>Equilibrium stable</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        ) : (
          /* DOCUMENT VIEW: Beautifully Formatted Multi-Section Report */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2">
              <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#6B7280]">
                Synthesized Executive Memorandum (Structured Sections)
              </span>
              <span className="font-mono text-xs text-[#6C63FF] bg-[#E0E5EC] shadow-neu-inset-sm px-2.5 py-1 rounded-xl">
                {parsedSections.length} Sections Formatted
              </span>
            </div>

            <div className="space-y-4">
              {parsedSections.map((section, idx) => {
                const getIcon = () => {
                  switch (section.iconType) {
                    case 'time':
                      return <Clock className="h-4 w-4 text-[#6C63FF]" />;
                    case 'matrix':
                      return <BarChart3 className="h-4 w-4 text-[#38B2AC]" />;
                    case 'driver':
                      return <AlertTriangle className="h-4 w-4 text-[#E53E3E]" />;
                    case 'lifecycle':
                      return <Compass className="h-4 w-4 text-[#D97706]" />;
                    case 'recommendation':
                      return <CheckCircle2 className="h-4 w-4 text-[#38B2AC]" />;
                    default:
                      return <FileText className="h-4 w-4 text-[#6C63FF]" />;
                  }
                };

                return (
                  <div
                    key={idx}
                    className="bg-[#E0E5EC] p-5 rounded-[24px] shadow-neu-extrude-sm border border-[#D1D9E6]/60 hover:shadow-neu-extrude transition-all duration-300"
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center shrink-0">
                        {getIcon()}
                      </div>
                      <h3 className="font-display font-bold text-sm text-[#3D4852] tracking-wide">
                        {section.title}
                      </h3>
                    </div>

                    {/* Paragraphs */}
                    {section.paragraphs.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {section.paragraphs.map((p, pIdx) => (
                          <p key={pIdx} className="font-body text-xs md:text-sm text-[#3D4852] leading-relaxed">
                            {formatTextWithChips(p)}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Bullets */}
                    {section.bullets.length > 0 && (
                      <div className="bg-[#E0E5EC] shadow-neu-inset-sm p-3.5 rounded-2xl space-y-2">
                        {section.bullets.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-start gap-2 text-xs md:text-sm text-[#3D4852]">
                            <span className="text-[#6C63FF] font-bold text-sm leading-none mt-0.5">•</span>
                            <span className="flex-1 leading-relaxed">{formatTextWithChips(b)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Compression Pipeline Visualizer Drawer */}
        {showPipeline && (
          <div className="mt-8 bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-inset transition-all duration-300 border border-[#D1D9E6]">
            {/* Pipeline Stage Header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D1D9E6]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E0E5EC] text-[#D97706] shadow-neu-extrude-sm">
                  <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#3D4852]">
                  4-STAGE DEDUPLICATION & COMPRESSION PIPELINE
                </span>
              </div>
              <span className="font-body text-xs font-medium text-[#6B7280]">
                Raw Ticks ➔ Deduplicated Clusters ➔ Urgency Scored ➔ Executive Briefing
              </span>
            </div>

            {/* Visual Process Flow Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#E0E5EC] p-3 rounded-2xl shadow-neu-extrude-sm text-center">
                <span className="font-display font-bold text-[10px] text-[#6B7280] block">STAGE 1</span>
                <span className="font-display font-bold text-xs text-[#3D4852]">Tick Ingestion</span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">Raw Market Prints</span>
              </div>
              <div className="bg-[#E0E5EC] p-3 rounded-2xl shadow-neu-extrude-sm text-center border border-[#6C63FF]/30">
                <span className="font-display font-bold text-[10px] text-[#6C63FF] block">STAGE 2</span>
                <span className="font-display font-bold text-xs text-[#6C63FF]">Cluster Deduplication</span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">Collapses Repeats</span>
              </div>
              <div className="bg-[#E0E5EC] p-3 rounded-2xl shadow-neu-extrude-sm text-center">
                <span className="font-display font-bold text-[10px] text-[#D97706] block">STAGE 3</span>
                <span className="font-display font-bold text-xs text-[#D97706]">Attention Scoring</span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">0-100 Weighted Urgency</span>
              </div>
              <div className="bg-[#E0E5EC] p-3 rounded-2xl shadow-neu-extrude-sm text-center border border-[#38B2AC]/40">
                <span className="font-display font-bold text-[10px] text-[#38B2AC] block">STAGE 4</span>
                <span className="font-display font-bold text-xs text-[#38B2AC]">Executive Synthesis</span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">Structured Memo & Bento</span>
              </div>
            </div>

            {/* Compressed Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {compressedInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-neu-extrude transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-display font-bold text-sm text-[#6C63FF]">
                        {insight.headline}
                      </span>
                      <span className="font-mono text-[10px] font-bold bg-[#E0E5EC] text-[#6B7280] shadow-neu-inset-sm px-2.5 py-1 rounded-xl shrink-0">
                        {insight.deduplicatedCount} collapsed
                      </span>
                    </div>

                    <p className="font-body text-xs text-[#3D4852] leading-relaxed mb-4">
                      {insight.executiveSummary}
                    </p>
                  </div>

                  <div className="border-t border-[#D1D9E6] pt-3 font-body text-xs text-[#6B7280] flex items-center justify-between gap-2">
                    <span className="text-[#3D4852] font-medium text-[11px] truncate">
                      {insight.actionableContext}
                    </span>
                    {insight.symbols.length > 0 && onSelectStock && (
                      <button
                        onClick={() => onSelectStock(insight.symbols[0])}
                        className="text-[#6C63FF] font-bold text-[10px] hover:underline shrink-0"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
