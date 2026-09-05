import React, { useState } from 'react';
import {
  StockQuote,
  WatchlistRecord,
  AttentionScoreData,
  AttentionCategory,
  BuyReminderAlert
} from '../types/market';
import {
  Plus,
  Trash2,
  Sliders,
  Search,
  ChevronRight,
  Info,
  Target,
  Bell,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface WatchlistPaneProps {
  stocks: StockQuote[];
  watchlist: WatchlistRecord[];
  attentionScores: Record<string, AttentionScoreData>;
  selectedCategory: AttentionCategory | 'ALL';
  buyReminders?: BuyReminderAlert[];
  onSelectCategory: (cat: AttentionCategory | 'ALL') => void;
  onSelectStock: (symbol: string) => void;
  onOpenAddModal: () => void;
  onOpenThresholdModal: (symbol: string) => void;
  onRemoveStock: (symbol: string) => void;
  onDismissBuyReminder?: (symbol: string) => void;
  onNavigateToDiversification?: () => void;
}

export const WatchlistPane: React.FC<WatchlistPaneProps> = ({
  stocks,
  watchlist,
  attentionScores,
  selectedCategory,
  buyReminders = [],
  onSelectCategory,
  onSelectStock,
  onOpenAddModal,
  onOpenThresholdModal,
  onRemoveStock,
  onDismissBuyReminder,
  onNavigateToDiversification
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState<'INR' | 'USD'>('INR');

  // Map symbols to quotes
  const stockMap = new Map<string, StockQuote>();
  stocks.forEach(s => stockMap.set(s.symbol, s));

  // Filter items by category & search
  let filteredItems = watchlist.filter(item => {
    const scoreData = attentionScores[item.symbol];
    if (selectedCategory !== 'ALL') {
      if (scoreData?.category !== selectedCategory) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const quote = stockMap.get(item.symbol);
      const matchesSymbol = item.symbol.toLowerCase().includes(q);
      const matchesName = quote?.name.toLowerCase().includes(q);
      const matchesSector = quote?.sector.toLowerCase().includes(q);
      if (!matchesSymbol && !matchesName && !matchesSector) return false;
    }
    return true;
  });

  // Sort by attention score descending
  filteredItems.sort((a, b) => {
    const scoreA = attentionScores[a.symbol]?.totalScore || 0;
    const scoreB = attentionScores[b.symbol]?.totalScore || 0;
    return scoreB - scoreA;
  });

  // Counts
  const countAll = watchlist.length;
  const countAttn = watchlist.filter(w => attentionScores[w.symbol]?.category === 'NEEDS_ATTENTION').length;
  const countKnowing = watchlist.filter(w => attentionScores[w.symbol]?.category === 'WORTH_KNOWING').length;
  const countNormal = watchlist.filter(w => attentionScores[w.symbol]?.category === 'NO_MEANINGFUL_CHANGE').length;

  const triggeredReminders = buyReminders.filter(b => b.triggered);

  // Ascii Sparkline
  const renderAsciiSparkline = (ticks: Array<{ price: number }>) => {
    if (!ticks || ticks.length < 2) return '[--]';
    const prices = ticks.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const glyphs = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    return prices
      .slice(-8)
      .map(p => {
        const idx = Math.min(
          glyphs.length - 1,
          Math.max(0, Math.floor(((p - min) / range) * (glyphs.length - 1)))
        );
        return glyphs[idx];
      })
      .join('');
  };

  const formatPrice = (quote: StockQuote) => {
    if (displayCurrency === 'INR') {
      const inr = quote.priceINR || (quote.currency === 'INR' ? quote.price : quote.price * 85.20);
      return `₹${inr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const usd = quote.currency === 'USD' ? quote.price : quote.price / 85.20;
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatSecondaryPrice = (quote: StockQuote) => {
    if (displayCurrency === 'INR') {
      const usd = quote.currency === 'USD' ? quote.price : quote.price / 85.20;
      return `$${usd.toFixed(2)} USD`;
    }
    const inr = quote.priceINR || (quote.currency === 'INR' ? quote.price : quote.price * 85.20);
    return `₹${inr.toLocaleString(undefined, { maximumFractionDigits: 0 })} INR`;
  };

  return (
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full font-body">
      {/* 1. High Priority Buy Target Alerts Banner */}
      {triggeredReminders.length > 0 && (
        <div className="mb-6 card-neu p-4.5 bg-[#E0E5EC] border-2 border-[#38B2AC]/60 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-300 shadow-neu-extrude-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#38B2AC] shrink-0 mt-0.5">
                <Target className="h-5 w-5 animate-bounce" strokeWidth={2.4} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-[#E0E5EC] shadow-neu-inset-sm text-[#38B2AC] text-[10px] font-black uppercase px-2 py-0.5 rounded-lg">
                    Target Met
                  </span>
                  <h3 className="font-display font-black text-sm text-[#3D4852]">
                    {triggeredReminders.length} Buy Price {triggeredReminders.length === 1 ? 'Target' : 'Targets'} Reached!
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#2C7A7B] bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-0.5 rounded-lg">
                    <ShieldCheck className="h-3 w-3 text-[#38B2AC]" />
                    <span>0.5% Hysteresis Guard Active</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {triggeredReminders.map(r => {
                    const isBreakout = r.targetType === 'BREAKOUT_BUY';
                    return (
                      <div
                        key={r.symbol}
                        onClick={() => onSelectStock(r.symbol)}
                        className="cursor-pointer font-mono font-bold text-xs text-[#2C7A7B] bg-[#E0E5EC] shadow-neu-inset-sm px-2.5 py-1 rounded-xl hover:text-[#6C63FF] transition-colors flex items-center gap-1.5 flex-wrap"
                      >
                        {isBreakout ? <ArrowUpRight className="h-3 w-3 text-[#6C63FF]" /> : <ArrowDownRight className="h-3 w-3 text-[#38B2AC]" />}
                        <span>{r.symbol}: {isBreakout ? 'Breakout' : 'Dip'} Hit {r.targetBuyCurrency === 'INR' ? '₹' : '$'}{r.targetBuyPrice.toLocaleString()} (Now {r.targetBuyCurrency === 'INR' ? '₹' : '$'}{r.priceInTargetCurrency.toLocaleString()})</span>
                        {r.rearmPrice && (
                          <span className="text-[10px] font-normal text-[#6B7280]">
                            • Re-arm {isBreakout ? '≤' : '≥'} {r.targetBuyCurrency === 'INR' ? '₹' : '$'}{r.rearmPrice.toLocaleString()}
                          </span>
                        )}
                        {r.suppressedOscillationsCount !== undefined && r.suppressedOscillationsCount > 0 && (
                          <span className="text-[10px] text-[#38B2AC] bg-[#E0E5EC] shadow-neu-inset-sm px-1.5 py-0.2 rounded-md">
                            🛡️ {r.suppressedOscillationsCount} hover checks throttled
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {triggeredReminders.map(r => onDismissBuyReminder && (
                <button
                  key={r.symbol}
                  onClick={() => onDismissBuyReminder(r.symbol)}
                  className="btn-neu px-3 py-1.5 text-[11px] font-bold text-[#6B7280] hover:text-[#3D4852] rounded-xl"
                  title={`Dismiss alert for ${r.symbol}`}
                >
                  Dismiss {r.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Controls: Category Tabs + Currency Switcher + Search + Track Stock */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-[#D1D9E6]">
        {/* Category Filters (Horizontally scrollable with touch on mobile/tablet) */}
        <div className="overflow-x-auto no-scrollbar pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 flex items-center gap-2 shrink-0">
          {/* Tab: All */}
          <button
            id="tab-all"
            onClick={() => onSelectCategory('ALL')}
            className={`px-3.5 sm:px-4 py-2 text-xs font-display font-bold uppercase tracking-wider rounded-2xl whitespace-nowrap shrink-0 transition-all duration-300 min-h-[38px] touch-manipulation ${
              selectedCategory === 'ALL'
                ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                : 'btn-neu'
            }`}
          >
            All Stocks ({countAll})
          </button>

          {/* Tab: Needs Attention */}
          <button
            id="tab-needs-attention"
            onClick={() => onSelectCategory('NEEDS_ATTENTION')}
            className={`px-3.5 sm:px-4 py-2 text-xs font-display font-bold uppercase tracking-wider rounded-2xl whitespace-nowrap shrink-0 transition-all duration-300 flex items-center gap-1.5 min-h-[38px] touch-manipulation ${
              selectedCategory === 'NEEDS_ATTENTION'
                ? 'bg-[#E0E5EC] text-[#E53E3E] shadow-neu-inset'
                : 'btn-neu text-[#E53E3E]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#E53E3E] animate-pulse shrink-0" />
            <span>Needs Attention ({countAttn})</span>
          </button>

          {/* Tab: Worth Knowing */}
          <button
            id="tab-worth-knowing"
            onClick={() => onSelectCategory('WORTH_KNOWING')}
            className={`px-3.5 sm:px-4 py-2 text-xs font-display font-bold uppercase tracking-wider rounded-2xl whitespace-nowrap shrink-0 transition-all duration-300 flex items-center gap-1.5 min-h-[38px] touch-manipulation ${
              selectedCategory === 'WORTH_KNOWING'
                ? 'bg-[#E0E5EC] text-[#D97706] shadow-neu-inset'
                : 'btn-neu text-[#D97706]'
            }`}
          >
            <span>⚡ Worth Knowing ({countKnowing})</span>
          </button>

          {/* Tab: Stable */}
          <button
            id="tab-no-meaningful"
            onClick={() => onSelectCategory('NO_MEANINGFUL_CHANGE')}
            className={`px-3.5 sm:px-4 py-2 text-xs font-display font-bold uppercase tracking-wider rounded-2xl whitespace-nowrap shrink-0 transition-all duration-300 flex items-center gap-1.5 min-h-[38px] touch-manipulation ${
              selectedCategory === 'NO_MEANINGFUL_CHANGE'
                ? 'bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset'
                : 'btn-neu text-[#38B2AC]'
            }`}
          >
            <span>Stable ({countNormal})</span>
          </button>
        </div>

        {/* Right side controls: Currency toggle + Search + Add Ticker */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3">
          {/* Currency Toggle (₹ INR vs $ USD) */}
          <div className="bg-[#E0E5EC] shadow-neu-inset rounded-2xl p-1 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setDisplayCurrency('INR')}
              className={`px-2.5 py-1 text-xs font-display font-black rounded-xl transition-all ${
                displayCurrency === 'INR'
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                  : 'text-[#6B7280] hover:text-[#3D4852]'
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => setDisplayCurrency('USD')}
              className={`px-2.5 py-1 text-xs font-display font-black rounded-xl transition-all ${
                displayCurrency === 'USD'
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                  : 'text-[#6B7280] hover:text-[#3D4852]'
              }`}
            >
              $ USD
            </button>
          </div>

          <div className="relative flex-1 sm:flex-initial min-w-[120px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6B7280]" strokeWidth={2.2} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search watchlist..."
              className="bg-[#E0E5EC] shadow-neu-inset rounded-2xl py-2 pl-8 sm:pl-9 pr-3 text-xs font-medium text-[#3D4852] placeholder-[#A0AEC0] focus:shadow-neu-inset-deep focus:outline-none w-full sm:w-44 md:w-52"
            />
          </div>

          <button
            id="btn-add-stock"
            onClick={onOpenAddModal}
            className="btn-neu-primary px-3.5 sm:px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 sm:gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300 whitespace-nowrap min-h-[38px] touch-manipulation shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            <span>Track Stock</span>
          </button>
        </div>
      </div>

      {/* Helpful Hint + Diversification quick jump */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-[#6C63FF] shrink-0" strokeWidth={2.2} />
          <span>Click any stock to inspect explanations, or click the Target icon to set a Buy Target in ₹ Rupees.</span>
        </div>
        {onNavigateToDiversification && (
          <button
            onClick={onNavigateToDiversification}
            className="font-display font-bold text-xs text-[#6C63FF] hover:underline flex items-center gap-1"
          >
            <span>Check Sector Diversification & Top Picks</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Watchlist Stock Cards List */}
      {filteredItems.length === 0 ? (
        <div className="card-neu p-12 text-center">
          <p className="font-display font-extrabold text-xl text-[#3D4852]">No Stocks Found</p>
          <p className="font-body text-sm font-medium text-[#6B7280] mt-1.5">
            {searchQuery
              ? `No tracked stock matches "${searchQuery}".`
              : 'Try selecting a different filter tab or click [+ Track Stock] to add one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item, index) => {
            const quote = stockMap.get(item.symbol);
            const scoreData = attentionScores[item.symbol];
            const isCritical = scoreData?.category === 'NEEDS_ATTENTION';
            const isWarning = scoreData?.category === 'WORTH_KNOWING';

            if (!quote) return null;

            // Buy Target Calculation
            const thresh = item.customThresholds;
            const hasBuyTarget = Boolean(thresh?.targetBuyPrice && thresh?.targetBuyActive !== false);
            const targetCurrency = thresh?.targetBuyCurrency || 'INR';
            const currentInTarget = targetCurrency === 'INR'
              ? (quote.priceINR || (quote.currency === 'INR' ? quote.price : quote.price * 85.20))
              : (quote.currency === 'USD' ? quote.price : quote.price / 85.20);
            const isTargetMet = hasBuyTarget && currentInTarget <= (thresh.targetBuyPrice || 0);

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectStock(item.symbol)}
                className="card-neu p-5 md:p-6 relative transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:shadow-neu-extrude group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Index, Symbol, Name, Sector, Tags & Target Pill */}
                  <div className="flex items-start gap-3.5 flex-wrap flex-1 min-w-[240px]">
                    <div className="w-8 h-8 rounded-xl bg-[#E0E5EC] shadow-neu-inset-sm flex items-center justify-center font-display font-extrabold text-xs text-[#6C63FF] shrink-0 mt-0.5">
                      {index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-display font-black text-2xl tracking-tight text-[#3D4852] group-hover:text-[#6C63FF] transition-colors">
                          {quote.symbol}
                        </span>
                        <span className="bg-[#E0E5EC] shadow-neu-extrude-sm px-2.5 py-0.5 font-display text-xs font-bold text-[#6C63FF] rounded-xl">
                          {quote.sector}
                        </span>
                        {item.tags?.map(t => (
                          <span
                            key={t}
                            className="bg-[#E0E5EC] text-[#6B7280] shadow-neu-inset-sm font-mono text-[10px] font-medium px-2 py-0.5 rounded-lg"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <div className="font-body text-xs font-medium text-[#6B7280] mt-0.5">
                        {quote.name}
                      </div>

                      {/* Liquidity Sweep / Flash Crash Recovery Badge */}
                      {quote.liquiditySweep && quote.liquiditySweep.detected && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E0E5EC] shadow-neu-inset-sm border border-[#38B2AC]/50 text-[11px] font-mono">
                          <Zap className="h-3.5 w-3.5 text-[#38B2AC] shrink-0 animate-pulse" />
                          <span className="font-bold text-[#2C7A7B]">
                            Flash Sweep ({quote.liquiditySweep.dropPct}% V-Rebound)
                          </span>
                          <span className="text-[10px] text-[#6B7280]">
                            • Baseline Preserved
                          </span>
                        </div>
                      )}

                      {/* Buy Reminder Target Badge */}
                      {hasBuyTarget ? (
                        <div className="mt-2 inline-flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl shadow-neu-inset-sm text-[11px] font-mono font-bold">
                            {isTargetMet ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#38B2AC] shrink-0 animate-pulse" />
                                <span className="text-[#2C7A7B]">
                                  {thresh.targetType === 'BREAKOUT_BUY' ? 'Breakout Hit' : 'Dip Target Met'}: {targetCurrency === 'INR' ? '₹' : '$'}{thresh.targetBuyPrice?.toLocaleString()}
                                </span>
                              </>
                            ) : (
                              <>
                                {thresh.targetType === 'BREAKOUT_BUY' ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-[#6C63FF] shrink-0" />
                                ) : (
                                  <Target className="h-3.5 w-3.5 text-[#6C63FF] shrink-0" />
                                )}
                                <span className="text-[#6B7280]">
                                  {thresh.targetType === 'BREAKOUT_BUY' ? 'Breakout' : 'Buy Target'}: {targetCurrency === 'INR' ? '₹' : '$'}{thresh.targetBuyPrice?.toLocaleString()}
                                </span>
                                <span className="text-[#6C63FF] text-[10px]">
                                  ({(((currentInTarget - (thresh.targetBuyPrice || 0)) / (thresh.targetBuyPrice || 1)) * 100).toFixed(1)}% away)
                                </span>
                              </>
                            )}
                          </div>
                          {(thresh.suppressedOscillationsCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#38B2AC] px-1">
                              <ShieldCheck className="h-3 w-3" />
                              <span>{thresh.suppressedOscillationsCount} hover notifications throttled</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenThresholdModal(quote.symbol);
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-display font-bold text-[#6B7280] hover:text-[#6C63FF] transition-colors"
                        >
                          <Target className="h-3 w-3" />
                          <span>+ Set Buy Target (₹)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Price, Day Change, Sparkline, Volume */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-6 py-2 md:py-0 md:border-l md:border-r border-[#D1D9E6]/60 md:px-6">
                    {/* Price & Delta */}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-extrabold text-xl text-[#3D4852]">
                          {formatPrice(quote)}
                        </span>
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-xl shadow-neu-inset-sm ${
                            quote.changePct >= 0
                              ? 'text-[#38B2AC]'
                              : 'text-[#E53E3E]'
                          }`}
                        >
                          {quote.changePct >= 0 ? '+' : ''}
                          {quote.changePct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[#6B7280] mt-0.5">
                        {formatSecondaryPrice(quote)}
                      </div>
                    </div>

                    {/* Sparkline & Volume */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-2 font-mono text-xs text-[#6C63FF]">
                        <span className="text-[#6B7280] text-[11px]">Ticks:</span>
                        <span className="tracking-wider font-bold bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-0.5 rounded-xl">
                          {renderAsciiSparkline(quote.ticks)}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[#6B7280] mt-0.5">
                        Vol: {(quote.volume / 1_000_000).toFixed(1)}M ({(quote.volume / quote.avgVolume).toFixed(1)}x avg)
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Attention Score & Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#D1D9E6]/60">
                    {/* Attention Badge & Score */}
                    <div className="text-left md:text-right">
                      <div className="flex items-center gap-1.5 md:justify-end">
                        {isCritical && (
                          <span className="bg-[#E0E5EC] text-[#E53E3E] shadow-neu-inset-sm px-2.5 py-1 font-display text-[11px] font-bold rounded-xl flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E53E3E] animate-pulse" />
                            <span>CRITICAL</span>
                          </span>
                        )}
                        {isWarning && (
                          <span className="bg-[#E0E5EC] text-[#D97706] shadow-neu-inset-sm px-2.5 py-1 font-display text-[11px] font-bold rounded-xl">
                            WORTH KNOWING
                          </span>
                        )}
                        {!isCritical && !isWarning && (
                          <span className="bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset-sm px-2.5 py-1 font-display text-[11px] font-bold rounded-xl">
                            Stable
                          </span>
                        )}
                        <span
                          className={`font-display font-black text-sm ${
                            isCritical ? 'text-[#E53E3E]' : isWarning ? 'text-[#D97706]' : 'text-[#6C63FF]'
                          }`}
                        >
                          {scoreData ? `${scoreData.totalScore}/100` : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View Explanation Button (stops propagation so row click also works) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStock(item.symbol);
                        }}
                        className="btn-neu-primary px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1 group-hover:shadow-neu-extrude transition-all min-h-[38px] touch-manipulation"
                        title="View full explanation & math"
                      >
                        <span>Explain</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>

                      {/* Configure Alert & Buy Target Rules */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenThresholdModal(quote.symbol);
                        }}
                        className="btn-neu w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-[#6C63FF] hover:-translate-y-0.5 active:translate-y-0.5 transition-all min-h-[38px] min-w-[38px] touch-manipulation"
                        title="Set buy reminder target or configure sensitivity thresholds"
                        aria-label="Set alert rules and buy target"
                      >
                        <Target className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.2} />
                      </button>

                      {/* Remove Stock */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveStock(quote.symbol);
                        }}
                        className="btn-neu w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-[#E53E3E] hover:text-[#C53030] hover:-translate-y-0.5 active:translate-y-0.5 transition-all min-h-[38px] min-w-[38px] touch-manipulation"
                        title="Remove from watchlist"
                        aria-label="Remove stock"
                      >
                        <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
