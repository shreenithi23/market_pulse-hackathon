import React, { useState } from 'react';
import {
  PortfolioDiversificationData,
  DiversificationRecommendation,
  TopKStockPick,
  WatchlistRecord,
  StockQuote
} from '../types/market';
import {
  PieChart,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Plus,
  Target,
  Check,
  Info,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Layers,
  BarChart3
} from 'lucide-react';

interface PortfolioDiversificationPaneProps {
  diversification?: PortfolioDiversificationData;
  watchlist: WatchlistRecord[];
  stocks: StockQuote[];
  onAddStock: (symbol: string) => void;
  onOpenThresholdModal: (symbol: string) => void;
  onSelectStock: (symbol: string) => void;
}

export const PortfolioDiversificationPane: React.FC<PortfolioDiversificationPaneProps> = ({
  diversification,
  watchlist,
  stocks,
  onAddStock,
  onOpenThresholdModal,
  onSelectStock
}) => {
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  if (!diversification) {
    return (
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full font-body text-center">
        <div className="card-neu p-8">
          <p className="text-[#6B7280]">Analyzing sector distribution...</p>
        </div>
      </div>
    );
  }

  const {
    userSectorDistribution,
    dominantSector,
    concentrationRisk,
    concentrationSummary,
    recommendations,
    allSectorTopPicks
  } = diversification;

  const watchlistSymbolSet = new Set(watchlist.map(w => w.symbol));

  const formatPrice = (pick: TopKStockPick) => {
    if (currency === 'INR') {
      const inr = pick.priceINR || (pick.currency === 'INR' ? pick.price : pick.price * 85.20);
      return `₹${inr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const usd = pick.currency === 'USD' ? pick.price : pick.price / 85.20;
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatSecondaryPrice = (pick: TopKStockPick) => {
    if (currency === 'INR') {
      const usd = pick.currency === 'USD' ? pick.price : pick.price / 85.20;
      return `$${usd.toFixed(2)} USD`;
    }
    const inr = pick.priceINR || (pick.currency === 'INR' ? pick.price : pick.price * 85.20);
    return `₹${inr.toLocaleString(undefined, { maximumFractionDigits: 0 })} INR`;
  };

  // Unique sector list for explorer tab
  const allSectors = Object.keys(allSectorTopPicks || {});

  return (
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full font-body space-y-6">
      {/* 1. Header Banner & Currency Switcher */}
      <div className="card-neu p-6 rounded-[28px] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
              <PieChart className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display font-black text-2xl text-[#3D4852] tracking-tight">
                  Portfolio Diversification & Sector Gap Intelligence
                </h2>
                <span className={`px-3 py-0.5 text-xs font-display font-black uppercase rounded-xl ${
                  concentrationRisk === 'CRITICAL' || concentrationRisk === 'HIGH'
                    ? 'bg-[#E0E5EC] text-[#E53E3E] shadow-neu-inset-sm'
                    : concentrationRisk === 'MODERATE'
                    ? 'bg-[#E0E5EC] text-[#D97706] shadow-neu-inset-sm'
                    : 'bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset-sm'
                }`}>
                  {concentrationRisk} RISK
                </span>
              </div>
              <p className="font-body text-xs font-medium text-[#6B7280] mt-1 max-w-3xl leading-relaxed">
                {concentrationSummary}
              </p>
            </div>
          </div>

          {/* Currency Switcher */}
          <div className="self-end md:self-center shrink-0 bg-[#E0E5EC] shadow-neu-inset rounded-2xl p-1 flex items-center gap-1">
            <button
              onClick={() => setCurrency('INR')}
              className={`px-3 py-1.5 text-xs font-display font-black rounded-xl transition-all ${
                currency === 'INR'
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                  : 'text-[#6B7280] hover:text-[#3D4852]'
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 text-xs font-display font-black rounded-xl transition-all ${
                currency === 'USD'
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                  : 'text-[#6B7280] hover:text-[#3D4852]'
              }`}
            >
              $ USD
            </button>
          </div>
        </div>
      </div>

      {/* 2. Current Sector Allocation Bar & Cards */}
      <div className="card-neu p-6 rounded-[28px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#6C63FF]" strokeWidth={2.4} />
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
              Watchlist Sector Exposure Matrix
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-[#6B7280]">
            Dominant: <strong className="text-[#6C63FF]">{dominantSector}</strong>
          </span>
        </div>

        {/* Visual Stacked Progress Bar */}
        <div className="h-4 w-full bg-[#E0E5EC] rounded-full p-0.5 shadow-neu-inset overflow-hidden flex gap-0.5 mb-5">
          {userSectorDistribution.map((sec, idx) => {
            if (sec.weightPct === 0) return null;
            const colors = [
              'bg-[#6C63FF]',
              'bg-[#38B2AC]',
              'bg-[#D97706]',
              'bg-[#E53E3E]',
              'bg-[#805AD5]',
              'bg-[#319795]'
            ];
            return (
              <div
                key={sec.sector}
                className={`h-full ${colors[idx % colors.length]} transition-all`}
                style={{ width: `${sec.weightPct}%` }}
                title={`${sec.sector}: ${sec.weightPct}% (${sec.count} stocks)`}
              />
            );
          })}
        </div>

        {/* Sector Chips Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {userSectorDistribution.map((sec) => {
            const isOverweight = sec.status === 'OVERWEIGHT';
            const isMissing = sec.status === 'MISSING';
            const isUnderweight = sec.status === 'UNDERWEIGHT';

            return (
              <div
                key={sec.sector}
                className="bg-[#E0E5EC] p-3 rounded-2xl shadow-neu-inset-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display font-bold text-xs text-[#3D4852] truncate" title={sec.sector}>
                      {sec.sector}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg ${
                      isOverweight
                        ? 'bg-[#E53E3E]/15 text-[#E53E3E]'
                        : isMissing
                        ? 'bg-[#6B7280]/15 text-[#6B7280]'
                        : isUnderweight
                        ? 'bg-[#D97706]/15 text-[#D97706]'
                        : 'bg-[#38B2AC]/15 text-[#38B2AC]'
                    }`}>
                      {sec.weightPct}%
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#6B7280] block mt-0.5">
                    {sec.count} {sec.count === 1 ? 'stock' : 'stocks'} tracked
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-[#D1D9E6]/60 flex items-center justify-between text-[10px]">
                  <span className={`font-bold uppercase tracking-wider ${
                    isOverweight ? 'text-[#E53E3E]' : isMissing ? 'text-[#6B7280]' : 'text-[#38B2AC]'
                  }`}>
                    {sec.status}
                  </span>
                  {isMissing && (
                    <span className="text-[#6C63FF] font-bold">Needs entry</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Cross-Sector Recommendations & Top-K Stocks */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#6C63FF]" strokeWidth={2.4} />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#3D4852]">
              Top-K Diversification Recommendations
            </h3>
          </div>
          <span className="text-xs text-[#6B7280] hidden sm:inline">
            Ranked by volatility reduction, institutional quality, and low correlation
          </span>
        </div>

        <div className="space-y-6">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="card-neu p-6 rounded-[28px] border border-[#D1D9E6] relative hover:shadow-neu-extrude transition-all"
            >
              {/* Recommendation Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#D1D9E6]">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] text-[10px] font-black uppercase px-2.5 py-1 rounded-xl">
                      Target Sector: {rec.targetSector}
                    </span>
                    <span className={`text-[10px] font-display font-black uppercase px-2 py-0.5 rounded-lg ${
                      rec.urgency === 'HIGH'
                        ? 'bg-[#E53E3E]/15 text-[#E53E3E]'
                        : 'bg-[#D97706]/15 text-[#D97706]'
                    }`}>
                      {rec.urgency} PRIORITY HEDGE
                    </span>
                  </div>
                  <h4 className="font-display font-black text-lg text-[#3D4852] mt-1.5">
                    {rec.headline}
                  </h4>
                  <p className="font-body text-xs text-[#6B7280] mt-1 max-w-3xl leading-relaxed">
                    {rec.rationale}
                  </p>
                </div>

                {/* Quantitative Impact Capsule */}
                <div className="bg-[#E0E5EC] p-3 rounded-2xl shadow-neu-inset-sm shrink-0 md:text-right">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280] block">
                    Portfolio Correlation Impact
                  </span>
                  <span className="font-display font-black text-xs text-[#38B2AC] mt-0.5 block">
                    {rec.correlationImpact}
                  </span>
                  <span className="text-[10px] text-[#6B7280] mt-0.5 block">
                    {rec.diversificationBenefit}
                  </span>
                </div>
              </div>

              {/* Top-K Stock Cards (K=3) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Top-3 Recommended Stocks in {rec.targetSector}:
                  </span>
                  <span className="text-[11px] font-mono text-[#6C63FF]">
                    Sorted by Quality & Stability
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rec.topKStocks.map((stock) => {
                    const isTracked = watchlistSymbolSet.has(stock.symbol);

                    return (
                      <div
                        key={stock.symbol}
                        className="bg-[#E0E5EC] p-4.5 rounded-2xl shadow-neu-inset-sm flex flex-col justify-between hover:shadow-neu-inset transition-all"
                      >
                        {/* Top: Rank, Symbol, Sector, Tracking status */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-[#E0E5EC] shadow-neu-extrude-sm flex items-center justify-center font-display font-black text-[11px] text-[#6C63FF]">
                                #{stock.rank}
                              </span>
                              <span
                                onClick={() => onSelectStock(stock.symbol)}
                                className="font-display font-black text-base text-[#3D4852] hover:text-[#6C63FF] cursor-pointer transition-colors"
                              >
                                {stock.symbol}
                              </span>
                            </div>
                            <span className="bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-0.5 font-display text-[10px] font-bold text-[#6C63FF] rounded-lg">
                              Beta: {stock.beta.toFixed(2)}
                            </span>
                          </div>

                          <p className="font-body text-xs font-medium text-[#6B7280] line-clamp-1">
                            {stock.name}
                          </p>

                          {/* Price & Day Change */}
                          <div className="my-2.5 flex items-baseline justify-between">
                            <div>
                              <span className="font-mono font-black text-base text-[#3D4852]">
                                {formatPrice(stock)}
                              </span>
                              <span className="font-mono text-[10px] text-[#6B7280] block">
                                {formatSecondaryPrice(stock)}
                              </span>
                            </div>

                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-xl shadow-neu-inset-sm ${
                              stock.changePct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'
                            }`}>
                              {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                            </span>
                          </div>

                        </div>

                        {/* Actions: Add to Watchlist + Set Buy Reminder Target */}
                        <div className="pt-2 border-t border-[#D1D9E6] flex items-center gap-2">
                          {!isTracked ? (
                            <button
                              onClick={() => onAddStock(stock.symbol)}
                              className="btn-neu-primary flex-1 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                              <span>Track Stock</span>
                            </button>
                          ) : (
                            <div className="flex-1 py-1.5 text-xs font-bold text-[#38B2AC] flex items-center justify-center gap-1 shadow-neu-inset-sm rounded-xl">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                              <span>In Watchlist</span>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              if (!isTracked) onAddStock(stock.symbol);
                              onOpenThresholdModal(stock.symbol);
                            }}
                            className="btn-neu px-2.5 py-1.5 text-xs font-bold text-[#6C63FF] rounded-xl flex items-center gap-1 hover:text-[#4F46E5] transition-all"
                            title="Set Target Buy Price in ₹ Rupees"
                          >
                            <Target className="h-3.5 w-3.5" strokeWidth={2.2} />
                            <span>Buy Target (₹)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Complete Sector Explorer (Browse All Universe Sectors) */}
      <div className="card-neu p-6 rounded-[28px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6C63FF]" strokeWidth={2.4} />
            <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#3D4852]">
              All Sectors Top-K Catalog
            </h3>
          </div>
          <span className="text-xs text-[#6B7280]">
            Explore high-conviction leaders across global and Indian exchanges
          </span>
        </div>

        {/* Sector Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
          <button
            onClick={() => setSelectedSectorFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-display font-bold uppercase rounded-xl shrink-0 transition-all ${
              selectedSectorFilter === 'ALL'
                ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                : 'btn-neu text-[#6B7280]'
            }`}
          >
            All Sectors ({allSectors.length})
          </button>
          {allSectors.map((sector) => (
            <button
              key={sector}
              onClick={() => setSelectedSectorFilter(sector)}
              className={`px-3 py-1.5 text-xs font-display font-bold uppercase rounded-xl shrink-0 transition-all ${
                selectedSectorFilter === sector
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                  : 'btn-neu text-[#3D4852]'
              }`}
            >
              {sector} ({(allSectorTopPicks[sector] || []).length})
            </button>
          ))}
        </div>

        {/* Render Stocks for Selected Sector(s) */}
        <div className="space-y-5">
          {allSectors
            .filter(sec => selectedSectorFilter === 'ALL' || selectedSectorFilter === sec)
            .map(sec => {
              const picks = allSectorTopPicks[sec] || [];
              if (picks.length === 0) return null;

              return (
                <div key={sec} className="bg-[#E0E5EC] p-4.5 rounded-2xl shadow-neu-inset-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display font-bold text-xs uppercase tracking-wider text-[#6C63FF]">
                      {sec} Sector Leaders
                    </span>
                    <span className="text-[11px] text-[#6B7280]">
                      {picks.length} institutional picks
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {picks.map(p => {
                      const isTracked = watchlistSymbolSet.has(p.symbol);

                      return (
                        <div
                          key={p.symbol}
                          className="bg-[#E0E5EC] p-3 rounded-xl shadow-neu-extrude-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span
                                onClick={() => onSelectStock(p.symbol)}
                                className="font-display font-black text-sm text-[#3D4852] hover:text-[#6C63FF] cursor-pointer"
                              >
                                {p.symbol}
                              </span>
                              <span className="text-[10px] font-mono text-[#6B7280]">
                                Beta: {p.beta.toFixed(2)}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#6B7280] block truncate">{p.name}</span>

                            <div className="my-1.5 flex items-baseline justify-between">
                              <span className="font-mono font-bold text-xs text-[#3D4852]">
                                {formatPrice(p)}
                              </span>
                              <span className={`font-mono text-[10px] font-bold ${
                                p.changePct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'
                              }`}>
                                {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#D1D9E6] flex items-center justify-between gap-1">
                            {!isTracked ? (
                              <button
                                onClick={() => onAddStock(p.symbol)}
                                className="btn-neu text-[11px] font-bold px-2 py-1 rounded-lg text-[#6C63FF] hover:text-[#4F46E5]"
                              >
                                + Watch
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-[#38B2AC]">✓ Watched</span>
                            )}

                            <button
                              onClick={() => {
                                if (!isTracked) onAddStock(p.symbol);
                                onOpenThresholdModal(p.symbol);
                              }}
                              className="btn-neu text-[10px] font-bold px-2 py-1 rounded-lg text-[#6C63FF]"
                              title="Set target price in rupees"
                            >
                              🎯 Target
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
