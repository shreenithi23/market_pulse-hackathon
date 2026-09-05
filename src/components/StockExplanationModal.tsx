import React from 'react';
import {
  StockQuote,
  AttentionScoreData,
  WatchlistRecord,
  MarketEvent,
  MemoryBaselineSnapshot
} from '../types/market';
import {
  X,
  Sliders,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronRight,
  Trash2,
  Target,
  Bell
} from 'lucide-react';

interface StockExplanationModalProps {
  stock: StockQuote;
  scoreData?: AttentionScoreData;
  watchlistRecord?: WatchlistRecord;
  baselineSnapshot?: MemoryBaselineSnapshot;
  activeEvents?: MarketEvent[];
  onOpenThresholdModal: (symbol: string) => void;
  onRemoveStock: (symbol: string) => void;
  onClose: () => void;
}

export const StockExplanationModal: React.FC<StockExplanationModalProps> = ({
  stock,
  scoreData,
  watchlistRecord,
  baselineSnapshot,
  activeEvents = [],
  onOpenThresholdModal,
  onRemoveStock,
  onClose
}) => {
  const isCritical = scoreData?.category === 'NEEDS_ATTENTION';
  const isWarning = scoreData?.category === 'WORTH_KNOWING';
  const baselineQuote = baselineSnapshot?.quotes?.[stock.symbol];

  const baselinePrice = baselineQuote?.price ?? stock.price;
  const priceVsBaselinePct = baselinePrice
    ? (((stock.price - baselinePrice) / baselinePrice) * 100).toFixed(2)
    : '0.00';

  const volumeVsAvgRatio = stock.avgVolume > 0
    ? (stock.volume / stock.avgVolume).toFixed(2)
    : '1.00';

  // Ascii Sparkline for intraday ticks
  const renderAsciiSparkline = (ticks: Array<{ price: number }>) => {
    if (!ticks || ticks.length < 2) return '[--]';
    const prices = ticks.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const glyphs = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    return prices
      .slice(-12)
      .map(p => {
        const idx = Math.min(
          glyphs.length - 1,
          Math.max(0, Math.floor(((p - min) / range) * (glyphs.length - 1)))
        );
        return glyphs[idx];
      })
      .join('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D4852]/40 p-3 sm:p-4 font-body backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#E0E5EC] p-4 sm:p-6 md:p-8 rounded-[28px] sm:rounded-[32px] shadow-neu-extrude-lg my-4 sm:my-8 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-[#D1D9E6] gap-2.5 sm:gap-3">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center font-display font-black text-base sm:text-lg text-[#6C63FF] shrink-0">
              {stock.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-xl sm:text-2xl text-[#3D4852] tracking-tight">
                  {stock.symbol}
                </h3>
                <span className="bg-[#E0E5EC] shadow-neu-extrude-sm px-2 sm:px-2.5 py-0.5 font-display text-[10px] sm:text-[11px] font-bold text-[#6C63FF] rounded-xl">
                  {stock.sector}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#6B7280] font-medium mt-0.5">{stock.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenThresholdModal(stock.symbol)}
              className="btn-neu px-3 sm:px-3.5 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 min-h-[38px] touch-manipulation"
              title="Configure sensitivity rules"
            >
              <Sliders className="h-3.5 w-3.5 text-[#6C63FF]" strokeWidth={2.2} />
              <span>Alert Rules</span>
            </button>

            <button
              onClick={onClose}
              className="btn-neu w-9 h-9 rounded-2xl text-[#6B7280] hover:text-[#3D4852] min-h-[38px] min-w-[38px] touch-manipulation flex items-center justify-center"
              title="Close explanation"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Top Score Banner: Inset Well with Extruded Key Badges */}
          <div className="bg-[#E0E5EC] p-5 rounded-[24px] shadow-neu-inset">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <span className="font-display font-bold uppercase tracking-wider text-[11px] text-[#6B7280]">
                  ATTENTION CATEGORY & DIAGNOSIS
                </span>
                <div className="flex items-center gap-2.5 mt-1">
                  {isCritical && (
                    <span className="bg-[#E0E5EC] text-[#E53E3E] shadow-neu-inset-sm px-3.5 py-1 font-display text-xs font-bold rounded-xl flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#E53E3E] animate-pulse" />
                      <span>CRITICAL ATTENTION REQUIRED</span>
                    </span>
                  )}
                  {isWarning && (
                    <span className="bg-[#E0E5EC] text-[#D97706] shadow-neu-inset-sm px-3.5 py-1 font-display text-xs font-bold rounded-xl">
                      ⚡ WORTH KNOWING
                    </span>
                  )}
                  {!isCritical && !isWarning && (
                    <span className="bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset-sm px-3.5 py-1 font-display text-xs font-bold rounded-xl">
                      ✓ STABLE / ORDERLY DRIFT
                    </span>
                  )}
                </div>
              </div>

              {/* Score Display */}
              <div className="text-right">
                <span className="font-display font-bold uppercase tracking-wider text-[11px] text-[#6B7280] block">
                  EXPLAINABLE SCORE
                </span>
                <span
                  className={`font-display font-black text-2xl ${
                    isCritical
                      ? 'text-[#E53E3E]'
                      : isWarning
                      ? 'text-[#D97706]'
                      : 'text-[#6C63FF]'
                  }`}
                >
                  {scoreData ? `${scoreData.totalScore} / 100` : '--'}
                </span>
              </div>
            </div>

            {/* Score Track */}
            <div className="h-3.5 w-full bg-[#E0E5EC] rounded-full p-0.5 shadow-neu-inset overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCritical
                    ? 'bg-[#E53E3E]'
                    : isWarning
                    ? 'bg-[#D97706]'
                    : 'bg-[#6C63FF]'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(6, scoreData?.totalScore || 0))}%`
                }}
              />
            </div>
          </div>

          {/* Mathematical Point Allocation */}
          <div>
            <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#3D4852] mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] text-[11px]">
                1
              </span>
              <span>Exact Mathematical Point Allocation:</span>
            </h4>

            {scoreData && scoreData.signals.length > 0 ? (
              <div className="space-y-2.5">
                {scoreData.signals.map((sig, idx) => (
                  <div
                    key={idx}
                    className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-extrude-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 font-display text-[10px] font-bold uppercase rounded-lg shadow-neu-inset-sm ${
                            sig.severity === 'CRIT'
                              ? 'bg-[#E0E5EC] text-[#E53E3E]'
                              : 'bg-[#E0E5EC] text-[#6C63FF]'
                          }`}
                        >
                          {sig.type}
                        </span>
                        <span className="font-display font-bold text-xs text-[#3D4852]">
                          {sig.label}
                        </span>
                      </div>
                      <p className="font-body text-[11px] text-[#6B7280] font-medium mt-1">
                        {sig.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="bg-[#E0E5EC] shadow-neu-inset-sm px-3 py-1 font-mono font-bold text-xs text-[#6C63FF] rounded-xl inline-block">
                        +{sig.points} pts
                      </span>
                      <div className="font-mono text-[10px] text-[#6B7280] mt-0.5">
                        max {sig.maxPoints} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#E0E5EC] shadow-neu-inset p-4 rounded-2xl text-xs text-[#6B7280] font-medium">
                Zero anomaly signal points allocated.
              </div>
            )}
          </div>

          {/* Section 3: Baseline vs. Live Market Snapshot */}
          <div>
            <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#3D4852] mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] text-[11px]">
                3
              </span>
              <span>Baseline vs. Live Metrics:</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Current Price */}
              <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-extrude-sm">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-[#6B7280] block">
                  CURRENT PRICE
                </span>
                <span className="font-mono font-extrabold text-lg text-[#3D4852]">
                  ${stock.price.toFixed(2)}
                </span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-[11px] font-bold text-[#6C63FF]">
                    ₹{(stock.priceINR || (stock.currency === 'INR' ? stock.price : stock.price * 85.20)).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      stock.changePct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'
                    }`}
                  >
                    {stock.changePct >= 0 ? '+' : ''}
                    {stock.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Memory Baseline Delta */}
              <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-extrude-sm">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-[#6B7280] block">
                  VS BASELINE
                </span>
                <span className="font-mono font-extrabold text-lg text-[#6C63FF]">
                  {Number(priceVsBaselinePct) >= 0 ? '+' : ''}
                  {priceVsBaselinePct}%
                </span>
                <span className="block font-mono text-[10px] text-[#6B7280]">
                  Base: ${baselinePrice.toFixed(2)}
                </span>
              </div>

              {/* Volume Multiplier */}
              <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-extrude-sm">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-[#6B7280] block">
                  VOLUME PACE
                </span>
                <span className="font-mono font-extrabold text-lg text-[#3D4852]">
                  {volumeVsAvgRatio}x
                </span>
                <span className="block font-mono text-[10px] text-[#6B7280]">
                  {(stock.volume / 1_000_000).toFixed(1)}M shares
                </span>
              </div>

              {/* Intraday Volatility */}
              <div className="bg-[#E0E5EC] p-3.5 rounded-2xl shadow-neu-extrude-sm">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-[#6B7280] block">
                  VOLATILITY (ATR)
                </span>
                <span className="font-mono font-extrabold text-lg text-[#3D4852]">
                  {stock.volatility.toFixed(1)}%
                </span>
                <span className="block font-mono text-[10px] text-[#6B7280]">
                  Day: ${stock.dayLow.toFixed(2)} - ${stock.dayHigh.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Sparkline track */}
            <div className="mt-3 bg-[#E0E5EC] shadow-neu-inset-sm p-3 rounded-2xl flex items-center justify-between text-xs font-mono">
              <span className="text-[#6B7280] font-medium">Recent Intraday Ticks:</span>
              <span className="tracking-widest font-extrabold text-[#6C63FF] bg-[#E0E5EC] shadow-neu-inset-sm px-3 py-1 rounded-xl">
                {renderAsciiSparkline(stock.ticks)}
              </span>
            </div>
          </div>

          {/* Section 4: Custom Rules, Buy Reminder Target & Notes */}
          {watchlistRecord && (
            <div className="bg-[#E0E5EC] p-4.5 rounded-2xl shadow-neu-extrude-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                  Alert Rules & Buy Price Reminder for {stock.symbol}:
                </span>
                <button
                  onClick={() => onOpenThresholdModal(stock.symbol)}
                  className="btn-neu px-3 py-1 text-xs text-[#6C63FF] font-bold rounded-xl flex items-center gap-1 hover:text-[#4F46E5]"
                >
                  <Target className="h-3 w-3" strokeWidth={2.2} />
                  <span>Configure Limits & Buy Target</span>
                </button>
              </div>

              {/* Target Buy Price Reminder Status Box */}
              {watchlistRecord.customThresholds?.targetBuyPrice && (
                <div className="p-3 bg-[#E0E5EC] shadow-neu-inset-sm rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#E0E5EC] shadow-neu-extrude-sm flex items-center justify-center text-[#6C63FF]">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#3D4852]">
                          Buy Target: {watchlistRecord.customThresholds.targetBuyCurrency === 'INR' ? '₹' : '$'}{watchlistRecord.customThresholds.targetBuyPrice.toLocaleString()}
                        </span>
                        {watchlistRecord.customThresholds.targetBuyTriggered ? (
                          <span className="bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset-sm text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 animate-pulse" />
                            TARGET REACHED
                          </span>
                        ) : (
                          <span className="bg-[#E0E5EC] text-[#6B7280] shadow-neu-inset-sm text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            ACTIVE WATCH
                          </span>
                        )}
                      </div>
                      {watchlistRecord.customThresholds.targetBuyNotes && (
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          Strategy Note: {watchlistRecord.customThresholds.targetBuyNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-[#6C63FF] self-end sm:self-center">
                    Current: ₹{(stock.priceINR || (stock.currency === 'INR' ? stock.price : stock.price * 85.20)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="bg-[#E0E5EC] shadow-neu-inset-sm p-2.5 rounded-xl">
                  <span className="text-[#6B7280] block text-[10px]">Price Move Limit:</span>
                  <span className="font-bold text-[#3D4852]">
                    ±{watchlistRecord.customThresholds.priceChangePct ?? 2.5}%
                  </span>
                </div>
                <div className="bg-[#E0E5EC] shadow-neu-inset-sm p-2.5 rounded-xl">
                  <span className="text-[#6B7280] block text-[10px]">Volume Surge Limit:</span>
                  <span className="font-bold text-[#3D4852]">
                    {watchlistRecord.customThresholds.volumeMultiplier ?? 1.6}x avg
                  </span>
                </div>
                <div className="bg-[#E0E5EC] shadow-neu-inset-sm p-2.5 rounded-xl">
                  <span className="text-[#6B7280] block text-[10px]">Volatility Jump:</span>
                  <span className="font-bold text-[#3D4852]">
                    +{watchlistRecord.customThresholds.volatilityJumpPct ?? 20}%
                  </span>
                </div>
              </div>

              {watchlistRecord.userNotes && (
                <div className="mt-2.5 text-xs text-[#6B7280] font-body bg-[#E0E5EC] shadow-neu-inset-sm p-2.5 rounded-xl">
                  <span className="font-bold text-[#3D4852]">Notes: </span>
                  {watchlistRecord.userNotes}
                </div>
              )}
            </div>
          )}

          {/* Section 5: Associated Market Event (if any) */}
          {activeEvents.filter(e => e.symbol === stock.symbol).map(evt => (
            <div key={evt.id} className="bg-[#E0E5EC] p-4 rounded-2xl shadow-neu-extrude-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="bg-[#E0E5EC] shadow-neu-inset-sm text-[#E53E3E] text-[10px] font-display font-bold px-2.5 py-0.5 rounded-lg">
                  Active Anomaly: {evt.currentState}
                </span>
                <span className="font-mono text-[10px] text-[#6B7280]">
                  Peak: {evt.peakDeviationPct > 0 ? '+' : ''}{evt.peakDeviationPct}%
                </span>
              </div>
              <p className="font-body text-xs text-[#3D4852] font-semibold">{evt.title}</p>
              <p className="font-body text-xs text-[#6B7280] mt-0.5">{evt.summary}</p>
            </div>
          ))}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D1D9E6] pt-4">
            <button
              onClick={() => {
                onRemoveStock(stock.symbol);
                onClose();
              }}
              className="btn-neu text-[#E53E3E] hover:text-[#C53030] px-3.5 sm:px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 min-h-[38px] touch-manipulation"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>Remove from Watchlist</span>
            </button>

            <button
              onClick={onClose}
              className="btn-neu-primary px-5 sm:px-6 py-2 text-xs font-bold rounded-2xl min-h-[38px] touch-manipulation"
            >
              Close Explanation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
