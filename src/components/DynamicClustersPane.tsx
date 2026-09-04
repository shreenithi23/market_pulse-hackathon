import React, { useState } from 'react';
import { DynamicGroup, StockQuote, AttentionScoreData } from '../types/market';
import { Layers, ChevronRight, Zap, AlertTriangle, TrendingUp, Sparkles, Activity } from 'lucide-react';

interface DynamicClustersPaneProps {
  dynamicGroups: DynamicGroup[];
  stocks: StockQuote[];
  attentionScores: Record<string, AttentionScoreData>;
  onSelectStock: (symbol: string) => void;
}

export const DynamicClustersPane: React.FC<DynamicClustersPaneProps> = ({
  dynamicGroups,
  stocks,
  attentionScores,
  onSelectStock
}) => {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const stockMap = new Map<string, StockQuote>();
  stocks.forEach(s => stockMap.set(s.symbol, s));

  const getBadgeStyles = (color: string) => {
    switch (color) {
      case 'red':
        return 'text-[#E53E3E] bg-[#E0E5EC] shadow-neu-inset-sm';
      case 'amber':
        return 'text-[#D97706] bg-[#E0E5EC] shadow-neu-inset-sm';
      case 'green':
        return 'text-[#38B2AC] bg-[#E0E5EC] shadow-neu-inset-sm';
      case 'purple':
        return 'text-[#6C63FF] bg-[#E0E5EC] shadow-neu-inset-sm';
      default:
        return 'text-[#3182CE] bg-[#E0E5EC] shadow-neu-inset-sm';
    }
  };

  const activeClusters = selectedClusterId
    ? dynamicGroups.filter(g => g.id === selectedClusterId)
    : dynamicGroups;

  return (
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full font-body">
      {/* Header bar */}
      <div className="card-neu p-6 md:p-8 mb-6 relative">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
              <Layers className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-[#3D4852] tracking-tight">
                Dynamic Algorithmic Clusters
              </h2>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                Real-time clustering based on synchronous momentum, abnormal velocity, and shared anomaly regimes
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setSelectedClusterId(null)}
              className={`px-3.5 py-1.5 font-display text-xs font-bold rounded-2xl transition-all duration-300 ${
                selectedClusterId === null
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                  : 'btn-neu'
              }`}
            >
              All Clusters ({dynamicGroups.length})
            </button>
            {dynamicGroups.map(grp => (
              <button
                key={grp.id}
                onClick={() => setSelectedClusterId(grp.id === selectedClusterId ? null : grp.id)}
                className={`px-3 py-1.5 font-display text-xs font-bold rounded-2xl transition-all duration-300 ${
                  selectedClusterId === grp.id
                    ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                    : 'btn-neu'
                }`}
              >
                {grp.name} ({grp.symbols.length})
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Groups Grid */}
        <div className="space-y-6 mt-6">
          {activeClusters.map(group => {
            const badgeClass = getBadgeStyles(group.badgeColor);

            return (
              <div
                key={group.id}
                className="bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-extrude-sm"
              >
                {/* Cluster Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#D1D9E6]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className={`px-3 py-1 font-display text-xs font-bold uppercase rounded-xl ${badgeClass}`}>
                        {group.code}
                      </span>
                      <h3 className="font-display font-black text-lg text-[#3D4852]">
                        {group.name}
                      </h3>
                    </div>
                    <p className="font-body text-xs font-medium text-[#6B7280] mt-1">
                      {group.description}
                    </p>
                  </div>

                  <div className="bg-[#E0E5EC] shadow-neu-inset-sm px-4 py-1.5 rounded-2xl font-mono text-xs font-bold text-[#6C63FF]">
                    {group.metricHighlight}
                  </div>
                </div>

                {/* Stocks within this Cluster */}
                {group.symbols.length === 0 ? (
                  <div className="bg-[#E0E5EC] shadow-neu-inset p-4 rounded-2xl text-center text-xs text-[#6B7280]">
                    No assets currently match this cluster definition.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.symbols.map(sym => {
                      const quote = stockMap.get(sym);
                      const scoreData = attentionScores[sym];
                      if (!quote) return null;

                      const isCritical = scoreData?.category === 'NEEDS_ATTENTION';
                      const isWarning = scoreData?.category === 'WORTH_KNOWING';

                      return (
                        <div
                          key={sym}
                          onClick={() => onSelectStock(sym)}
                          className="card-neu p-4 cursor-pointer hover:-translate-y-1 hover:shadow-neu-extrude transition-all duration-300 group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-black text-base text-[#3D4852] group-hover:text-[#6C63FF] transition-colors">
                                {quote.symbol}
                              </span>
                              <span className="bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-0.5 text-[10px] font-bold text-[#6B7280] rounded-lg">
                                {quote.sector}
                              </span>
                            </div>

                            <span
                              className={`font-mono font-bold text-xs px-2 py-0.5 rounded-xl shadow-neu-inset-sm ${
                                quote.changePct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'
                              }`}
                            >
                              {quote.changePct >= 0 ? '+' : ''}
                              {quote.changePct.toFixed(2)}%
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between font-mono text-xs mb-2">
                            <span className="font-extrabold text-[#3D4852] text-sm">
                              ${quote.price.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-[#6B7280]">
                              {(quote.volume / quote.avgVolume).toFixed(1)}x vol
                            </span>
                          </div>

                          {/* Score and click prompt */}
                          <div className="pt-2 border-t border-[#D1D9E6] flex items-center justify-between text-[11px]">
                            <span
                              className={`font-display font-bold ${
                                isCritical ? 'text-[#E53E3E]' : isWarning ? 'text-[#D97706]' : 'text-[#6C63FF]'
                              }`}
                            >
                              Score: {scoreData ? scoreData.totalScore : '--'}
                            </span>
                            <span className="text-[#6C63FF] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              <span>Explanation</span>
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
