import React, { useState } from 'react';
import { WatchlistRecord, StockQuote } from '../types/market';
import { X, Save, Sliders, Target, Bell, CheckCircle2, AlertCircle } from 'lucide-react';

interface StockThresholdModalProps {
  item: WatchlistRecord;
  quote?: StockQuote;
  onSave: (
    thresholds: {
      priceChangePct?: number;
      volumeMultiplier?: number;
      volatilityJumpPct?: number;
      targetBuyPrice?: number;
      targetBuyCurrency?: 'INR' | 'USD';
      targetBuyActive?: boolean;
      targetBuyNote?: string;
    },
    notes?: string
  ) => void;
  onClose: () => void;
  onDismissBuyTrigger?: (symbol: string) => void;
}

export const StockThresholdModal: React.FC<StockThresholdModalProps> = ({
  item,
  quote,
  onSave,
  onClose,
  onDismissBuyTrigger
}) => {
  const [pricePct, setPricePct] = useState<number>(item.customThresholds.priceChangePct ?? 2.5);
  const [volMult, setVolMult] = useState<number>(item.customThresholds.volumeMultiplier ?? 1.6);
  const [volatPct, setVolatPct] = useState<number>(item.customThresholds.volatilityJumpPct ?? 20);
  const [notes, setNotes] = useState<string>(item.userNotes ?? '');

  // Buy Reminder States
  const [targetBuyActive, setTargetBuyActive] = useState<boolean>(
    item.customThresholds.targetBuyActive ?? (item.customThresholds.targetBuyPrice ? true : false)
  );
  const [targetBuyCurrency, setTargetBuyCurrency] = useState<'INR' | 'USD'>(
    item.customThresholds.targetBuyCurrency || (quote?.currency === 'INR' ? 'INR' : 'INR')
  );
  const [targetBuyPrice, setTargetBuyPrice] = useState<string>(
    item.customThresholds.targetBuyPrice ? String(item.customThresholds.targetBuyPrice) : ''
  );
  const [targetBuyNote, setTargetBuyNote] = useState<string>(
    item.customThresholds.targetBuyNote || ''
  );

  const currentPriceInSelectedCurrency = quote
    ? (targetBuyCurrency === 'INR'
        ? (quote.priceINR || (quote.currency === 'INR' ? quote.price : Number((quote.price * 85.20).toFixed(2))))
        : (quote.currency === 'USD' ? quote.price : Number((quote.price / 85.20).toFixed(2))))
    : null;

  const numericTarget = parseFloat(targetBuyPrice);
  const isCurrentlyTriggered = !isNaN(numericTarget) && currentPriceInSelectedCurrency !== null && currentPriceInSelectedCurrency <= numericTarget;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      {
        priceChangePct: Number(pricePct),
        volumeMultiplier: Number(volMult),
        volatilityJumpPct: Number(volatPct),
        targetBuyPrice: targetBuyActive && !isNaN(numericTarget) && numericTarget > 0 ? numericTarget : undefined,
        targetBuyCurrency,
        targetBuyActive,
        targetBuyNote: targetBuyNote.trim() || undefined
      },
      notes
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D4852]/40 p-4 font-body backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#E0E5EC] p-6 md:p-8 rounded-[32px] shadow-neu-extrude-lg my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF]">
              <Sliders className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-[#3D4852] tracking-tight">
                Alert Rules & Reminders: {item.symbol}
              </h3>
              <p className="text-xs text-[#6B7280] font-medium">Buy target triggers & volatility limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-neu w-9 h-9 rounded-xl text-[#6B7280] hover:text-[#3D4852]"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        {/* Current Market Snapshot Card */}
        {quote && (
          <div className="bg-[#E0E5EC] p-4 rounded-2xl shadow-neu-inset mb-5 flex items-center justify-between">
            <div>
              <span className="font-display font-bold uppercase text-[10px] text-[#6B7280] block">Current Live Quote</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono font-black text-lg text-[#3D4852]">
                  ₹{(quote.priceINR || (quote.price * 85.20)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono text-xs text-[#6B7280]">
                  (${quote.price.toFixed(2)} USD)
                </span>
              </div>
            </div>
            <span className={`font-mono text-xs font-bold px-2 py-1 rounded-xl shadow-neu-inset-sm ${
              quote.changePct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'
            }`}>
              {quote.changePct >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* SECTION 1: TARGET BUY PRICE REMINDER (Highlighted Feature) */}
          <div className="bg-[#E0E5EC] p-4.5 rounded-2xl shadow-neu-extrude-sm border border-[#6C63FF]/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E0E5EC] shadow-neu-inset-sm flex items-center justify-center text-[#6C63FF]">
                  <Target className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Buy Target Price Reminder
                  </h4>
                  <span className="text-[11px] text-[#6B7280]">Get alerted when stock drops to or hits your buy level</span>
                </div>
              </div>

              {/* Active Toggle Switch */}
              <button
                type="button"
                onClick={() => setTargetBuyActive(!targetBuyActive)}
                className={`px-3 py-1 text-[11px] font-display font-bold rounded-xl transition-all ${
                  targetBuyActive
                    ? 'bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset'
                    : 'btn-neu text-[#6B7280]'
                }`}
              >
                {targetBuyActive ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {targetBuyActive && (
              <div className="space-y-3 pt-2">
                {/* Currency Selection: INR (₹) or USD ($) */}
                <div>
                  <label className="block font-display font-bold text-[11px] uppercase tracking-wider text-[#6B7280] mb-1.5">
                    Target Currency:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetBuyCurrency('INR')}
                      className={`py-1.5 text-xs font-display font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        targetBuyCurrency === 'INR'
                          ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                          : 'btn-neu text-[#6B7280]'
                      }`}
                    >
                      <span>₹ INR (Indian Rupees)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetBuyCurrency('USD')}
                      className={`py-1.5 text-xs font-display font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        targetBuyCurrency === 'USD'
                          ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                          : 'btn-neu text-[#6B7280]'
                      }`}
                    >
                      <span>$ USD (US Dollars)</span>
                    </button>
                  </div>
                </div>

                {/* Target Price Input */}
                <div>
                  <label className="block font-display font-bold text-[11px] uppercase tracking-wider text-[#3D4852] mb-1">
                    Target Buy Price ({targetBuyCurrency === 'INR' ? '₹ Rupees' : '$ USD'}):
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-[#6C63FF] pl-1">
                      {targetBuyCurrency === 'INR' ? '₹' : '$'}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required={targetBuyActive}
                      placeholder={targetBuyCurrency === 'INR' ? 'e.g. 11200 or 1500' : 'e.g. 130.00'}
                      value={targetBuyPrice}
                      onChange={e => setTargetBuyPrice(e.target.value)}
                      className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-2xl px-4 py-2.5 font-mono font-bold text-sm text-[#3D4852] focus:shadow-neu-inset-deep focus:outline-none"
                    />
                  </div>
                </div>

                {/* Live Trigger Status Comparison */}
                {currentPriceInSelectedCurrency !== null && !isNaN(numericTarget) && numericTarget > 0 && (
                  <div className={`p-3 rounded-xl text-xs font-body flex items-start gap-2 ${
                    isCurrentlyTriggered
                      ? 'bg-[#E0E5EC] shadow-neu-inset border border-[#38B2AC]/40 text-[#2C7A7B]'
                      : 'bg-[#E0E5EC] shadow-neu-inset-sm text-[#6B7280]'
                  }`}>
                    {isCurrentlyTriggered ? (
                      <CheckCircle2 className="h-4 w-4 text-[#38B2AC] shrink-0 mt-0.5" />
                    ) : (
                      <Bell className="h-4 w-4 text-[#6C63FF] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {isCurrentlyTriggered
                          ? `🎯 Target Met! Current price (${targetBuyCurrency === 'INR' ? '₹' : '$'}${currentPriceInSelectedCurrency.toLocaleString()}) is at or below your target.`
                          : `Monitoring price: Current is ${targetBuyCurrency === 'INR' ? '₹' : '$'}${currentPriceInSelectedCurrency.toLocaleString()} (${Math.abs(Number((((currentPriceInSelectedCurrency - numericTarget) / numericTarget) * 100).toFixed(1)))}% above target).`}
                      </p>
                      {item.customThresholds.targetBuyTriggered && onDismissBuyTrigger && (
                        <button
                          type="button"
                          onClick={() => onDismissBuyTrigger(item.symbol)}
                          className="mt-1.5 text-[11px] font-bold text-[#6C63FF] underline hover:text-[#4F46E5]"
                        >
                          Acknowledge & reset trigger status
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Reminder Note */}
                <div>
                  <label className="block font-display font-bold text-[11px] uppercase tracking-wider text-[#6B7280] mb-1">
                    Buy Reminder Note (Optional):
                  </label>
                  <input
                    type="text"
                    value={targetBuyNote}
                    onChange={e => setTargetBuyNote(e.target.value)}
                    placeholder="e.g., Allocate 50k capital on breakout dip or swing entry"
                    className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-xl px-3 py-2 text-xs font-body text-[#3D4852] placeholder-[#A0AEC0] focus:shadow-neu-inset-deep focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: QUANTITATIVE ATTENTION THRESHOLDS */}
          <div className="space-y-4 pt-1">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#6B7280]">
              Market Drift & Volatility Limits
            </h4>

            {/* Price Change Threshold */}
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] mb-1">
                Price Move Sensitivity (±% from Baseline):
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="25"
                  value={pricePct}
                  onChange={e => setPricePct(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-2xl px-4 py-2 font-mono font-bold text-sm text-[#3D4852] focus:shadow-neu-inset-deep focus:outline-none"
                />
                <span className="font-display font-extrabold text-base text-[#3D4852]">%</span>
              </div>
              <span className="font-body text-[10px] text-[#6B7280] mt-0.5 block">Default: 2.5% deviation</span>
            </div>

            {/* Volume Spike Multiplier */}
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] mb-1">
                Volume Surge Threshold (x 20D Avg):
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="10.0"
                  value={volMult}
                  onChange={e => setVolMult(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-2xl px-4 py-2 font-mono font-bold text-sm text-[#3D4852] focus:shadow-neu-inset-deep focus:outline-none"
                />
                <span className="font-display font-extrabold text-base text-[#3D4852]">x</span>
              </div>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] mb-1">
                Trader Strategy Notes:
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g., Watching earnings consolidation or post-breakout test..."
                className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-2xl p-3 font-body text-xs text-[#3D4852] placeholder-[#A0AEC0] focus:shadow-neu-inset-deep focus:outline-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-[#D1D9E6] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-neu px-4 py-2 text-xs font-bold rounded-2xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-neu-primary px-5 py-2 text-xs font-bold rounded-2xl flex items-center gap-2"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>Save Rules & Reminders</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
