import React, { useState, useMemo } from 'react';
import { WatchlistRecord, StockQuote, TargetBuyType } from '../types/market';
import { X, Save, Sliders, Target, Bell, CheckCircle2, AlertTriangle, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

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
      targetType?: TargetBuyType;
      hysteresisBufferPct?: number;
      cooldownMinutes?: number;
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

  // Edge Cases: Target Type (Dip vs Breakout), Hysteresis Band (0.5%), Cooldown (30 min)
  const [targetType, setTargetType] = useState<TargetBuyType>(
    item.customThresholds.targetType || 'DIP_BUY'
  );
  const [hysteresisBufferPct, setHysteresisBufferPct] = useState<number>(
    item.customThresholds.hysteresisBufferPct ?? 0.5
  );
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(
    item.customThresholds.cooldownMinutes ?? 30
  );
  const [showAdvancedAntiWhipsaw, setShowAdvancedAntiWhipsaw] = useState<boolean>(false);

  const currentPriceInSelectedCurrency = useMemo(() => {
    if (!quote) return null;
    if (targetBuyCurrency === 'INR') {
      return quote.priceINR || (quote.currency === 'INR' ? quote.price : Number((quote.price * 85.20).toFixed(2)));
    }
    return quote.currency === 'USD' ? quote.price : Number((quote.price / 85.20).toFixed(2));
  }, [quote, targetBuyCurrency]);

  // Clean auto-formatting input (remove commas, currency signs, spaces)
  const handlePriceInput = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setTargetBuyPrice(cleaned);
  };

  const numericTarget = parseFloat(targetBuyPrice);

  // Validation Checks
  const isInvalidNumber = targetBuyActive && (isNaN(numericTarget) || numericTarget <= 0);
  const isNegativeOrZero = targetBuyActive && !isNaN(numericTarget) && numericTarget <= 0;

  // Distance from spot price (% deviation)
  const deviationPct = useMemo(() => {
    if (isNaN(numericTarget) || numericTarget <= 0 || !currentPriceInSelectedCurrency) return 0;
    return Math.abs(currentPriceInSelectedCurrency - numericTarget) / currentPriceInSelectedCurrency * 100;
  }, [numericTarget, currentPriceInSelectedCurrency]);

  const isExtremeDeviation = targetBuyActive && !isNaN(numericTarget) && numericTarget > 0 && deviationPct > 30;

  // Inversion Check: Dip Buy target above spot, or Breakout target below spot
  const isInvertedTarget = useMemo(() => {
    if (!targetBuyActive || isNaN(numericTarget) || numericTarget <= 0 || !currentPriceInSelectedCurrency) return false;
    if (targetType === 'DIP_BUY' && numericTarget > currentPriceInSelectedCurrency) return true;
    if (targetType === 'BREAKOUT_BUY' && numericTarget < currentPriceInSelectedCurrency) return true;
    return false;
  }, [targetBuyActive, numericTarget, currentPriceInSelectedCurrency, targetType]);

  // Trigger check based on mode
  const isCurrentlyTriggered = useMemo(() => {
    if (isNaN(numericTarget) || numericTarget <= 0 || !currentPriceInSelectedCurrency) return false;
    if (targetType === 'DIP_BUY') {
      return currentPriceInSelectedCurrency <= numericTarget;
    } else {
      return currentPriceInSelectedCurrency >= numericTarget;
    }
  }, [numericTarget, currentPriceInSelectedCurrency, targetType]);

  // Calculate Hysteresis Rebound Price
  const hysteresisReboundPrice = useMemo(() => {
    if (isNaN(numericTarget) || numericTarget <= 0) return null;
    if (targetType === 'DIP_BUY') {
      return Number((numericTarget * (1 + hysteresisBufferPct / 100)).toFixed(2));
    } else {
      return Number((numericTarget * (1 - hysteresisBufferPct / 100)).toFixed(2));
    }
  }, [numericTarget, targetType, hysteresisBufferPct]);

  const suppressedCount = item.customThresholds?.suppressedOscillationsCount || 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetBuyActive && isInvalidNumber) {
      return;
    }

    onSave(
      {
        priceChangePct: Number(pricePct),
        volumeMultiplier: Number(volMult),
        volatilityJumpPct: Number(volatPct),
        targetBuyPrice: targetBuyActive && !isNaN(numericTarget) && numericTarget > 0 ? numericTarget : undefined,
        targetBuyCurrency,
        targetBuyActive,
        targetBuyNote: targetBuyNote.trim() || undefined,
        targetType,
        hysteresisBufferPct,
        cooldownMinutes
      },
      notes
    );
  };

  const currSign = targetBuyCurrency === 'INR' ? '₹' : '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D4852]/40 p-3 sm:p-4 font-body backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#E0E5EC] p-4 sm:p-6 md:p-8 rounded-[28px] sm:rounded-[32px] shadow-neu-extrude-lg my-4 sm:my-6 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-5 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
              <Sliders className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base sm:text-lg text-[#3D4852] tracking-tight">
                Alert Rules & Reminders: {item.symbol}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#6B7280] font-medium">Hysteresis anti-whipsaw guard & sensitivity limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-neu w-9 h-9 rounded-xl text-[#6B7280] hover:text-[#3D4852] shrink-0 min-h-[38px] min-w-[38px] touch-manipulation flex items-center justify-center"
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
          {/* SECTION 1: TARGET BUY PRICE REMINDER WITH EDGE CASE PROTECTION */}
          <div className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm border border-[#6C63FF]/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E0E5EC] shadow-neu-inset-sm flex items-center justify-center text-[#6C63FF]">
                  <Target className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Target Price Reminder & Whipsaw Guard
                  </h4>
                  <span className="text-[11px] text-[#6B7280]">Automatic hysteresis band & anti-spam cooldown</span>
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
              <div className="space-y-4 pt-1">
                {/* 1. Target Strategy Type: Dip Buy vs Breakout */}
                <div>
                  <label className="block font-display font-bold text-[11px] uppercase tracking-wider text-[#6B7280] mb-1.5">
                    Trigger Mode:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetType('DIP_BUY')}
                      className={`py-2 px-3 text-xs font-display font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        targetType === 'DIP_BUY'
                          ? 'bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset'
                          : 'btn-neu text-[#6B7280]'
                      }`}
                    >
                      <ArrowDownRight className="h-4 w-4 shrink-0" />
                      <span>Dip-Buy (≤ Target)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType('BREAKOUT_BUY')}
                      className={`py-2 px-3 text-xs font-display font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        targetType === 'BREAKOUT_BUY'
                          ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                          : 'btn-neu text-[#6B7280]'
                      }`}
                    >
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                      <span>Breakout Buy (≥ Target)</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-[#6B7280] mt-1">
                    {targetType === 'DIP_BUY'
                      ? 'Triggers when stock pulls back or dips to bargain purchase level.'
                      : 'Triggers when momentum pushes stock through resistance breakout.'}
                  </p>
                </div>

                {/* 2. Currency Selection: INR (₹) or USD ($) */}
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

                {/* 3. Target Price Input with In-Line Formatting */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-display font-bold text-[11px] uppercase tracking-wider text-[#3D4852]">
                      Target Price ({currSign} {targetBuyCurrency}):
                    </label>
                    {currentPriceInSelectedCurrency && (
                      <span className="text-[11px] font-mono text-[#6B7280]">
                        Spot: {currSign}{currentPriceInSelectedCurrency.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-[#6C63FF] pl-1">
                      {currSign}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required={targetBuyActive}
                      placeholder={targetBuyCurrency === 'INR' ? 'e.g. 11200 or 1500' : 'e.g. 130.00'}
                      value={targetBuyPrice}
                      onChange={e => handlePriceInput(e.target.value)}
                      className={`w-full bg-[#E0E5EC] rounded-2xl px-4 py-2.5 font-mono font-bold text-sm text-[#3D4852] focus:outline-none transition-all ${
                        isNegativeOrZero
                          ? 'border border-[#E53E3E] shadow-neu-inset text-[#E53E3E]'
                          : isExtremeDeviation
                          ? 'border border-[#D97706] shadow-neu-inset'
                          : 'shadow-neu-inset focus:shadow-neu-inset-deep'
                      }`}
                    />
                  </div>

                  {/* Secondary Currency Conversion Preview */}
                  {!isNaN(numericTarget) && numericTarget > 0 && (
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#6B7280] mt-1 px-1">
                      <span>
                        Equivalent: {targetBuyCurrency === 'INR'
                          ? `$${(numericTarget / 85.20).toFixed(2)} USD`
                          : `₹${(numericTarget * 85.20).toLocaleString(undefined, { maximumFractionDigits: 0 })} INR`}
                      </span>
                      {currentPriceInSelectedCurrency && (
                        <span className={deviationPct > 30 ? 'text-[#D97706] font-bold' : 'text-[#6C63FF]'}>
                          {numericTarget > currentPriceInSelectedCurrency ? '+' : '-'}
                          {deviationPct.toFixed(1)}% from spot
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* EDGE CASE HANDLING 1: Impossible / Zero or Negative Value Error */}
                {isNegativeOrZero && (
                  <div className="p-3 bg-[#E0E5EC] shadow-neu-inset rounded-xl border border-[#E53E3E]/40 text-[#E53E3E] flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-bold">Invalid Price: Target price must be a positive number greater than 0.</span>
                  </div>
                )}

                {/* EDGE CASE HANDLING 2: Inverted Target Confirmation / Prompt */}
                {isInvertedTarget && (
                  <div className="p-3 bg-[#E0E5EC] shadow-neu-inset rounded-xl border border-[#6C63FF]/40 text-[#3D4852] space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-[#6C63FF] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-[#6C63FF]">
                          {targetType === 'DIP_BUY'
                            ? `Inverted Target Notice: Target (${currSign}${numericTarget.toLocaleString()}) is above spot (${currSign}${currentPriceInSelectedCurrency?.toLocaleString()}).`
                            : `Inverted Target Notice: Breakout target (${currSign}${numericTarget.toLocaleString()}) is below spot (${currSign}${currentPriceInSelectedCurrency?.toLocaleString()}).`}
                        </p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {targetType === 'DIP_BUY'
                            ? 'Dip-buying targets typically sit below current price to alert on market pullbacks.'
                            : 'Breakout targets typically sit above current resistance levels to alert on upside momentum.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTargetType(targetType === 'DIP_BUY' ? 'BREAKOUT_BUY' : 'DIP_BUY')}
                      className="btn-neu px-3 py-1 text-[11px] font-bold text-[#6C63FF] rounded-lg hover:text-[#4F46E5] flex items-center gap-1"
                    >
                      <span>Switch mode to {targetType === 'DIP_BUY' ? '🚀 Upside Breakout Target' : '📉 Dip-Buying Target'}</span>
                    </button>
                  </div>
                )}

                {/* EDGE CASE HANDLING 3: >30% Deviation Warning (Typo / Currency Check) */}
                {isExtremeDeviation && (
                  <div className="p-3 bg-[#E0E5EC] shadow-neu-inset rounded-xl border border-[#D97706]/40 text-[#B45309] flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        ⚠️ High Deviation Warning ({deviationPct.toFixed(1)}% away from spot)
                      </p>
                      <p className="text-[11px] text-[#92400E] mt-0.5">
                        Your target is {deviationPct.toFixed(1)}% away from the current market price of {currSign}{currentPriceInSelectedCurrency?.toLocaleString()}.
                        Please confirm you did not accidentally enter extra digits (e.g. 120000 vs 120) or mismatch currency ($ vs ₹).
                      </p>
                    </div>
                  </div>
                )}

                {/* EDGE CASE HANDLING 4: Whipsaw & Hysteresis Protection */}
                <div className="bg-[#E0E5EC] shadow-neu-inset-sm p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#38B2AC]" />
                      <span className="text-xs font-bold text-[#3D4852]">Anti-Whipsaw & Hovering Protection</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedAntiWhipsaw(!showAdvancedAntiWhipsaw)}
                      className="text-[10px] font-bold text-[#6C63FF] underline"
                    >
                      {showAdvancedAntiWhipsaw ? 'Hide Parameters' : 'Adjust Guard'}
                    </button>
                  </div>

                  <p className="text-[11px] text-[#6B7280]">
                    Protected by a <strong className="text-[#38B2AC]">{hysteresisBufferPct}% Hysteresis Band</strong> and a{' '}
                    <strong className="text-[#38B2AC]">{cooldownMinutes}m Cooldown</strong>. Redundant alerts are automatically suppressed when price hovers at the boundary.
                  </p>

                  {hysteresisReboundPrice && (
                    <div className="text-[10px] font-mono text-[#2C7A7B] bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-1 rounded-lg">
                      {targetType === 'DIP_BUY'
                        ? `Price must rebound to ≥ ${currSign}${hysteresisReboundPrice.toLocaleString()} (+${hysteresisBufferPct}%) before re-arming alert.`
                        : `Price must pull back to ≤ ${currSign}${hysteresisReboundPrice.toLocaleString()} (-${hysteresisBufferPct}%) before re-arming alert.`}
                    </div>
                  )}

                  {suppressedCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#38B2AC] pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38B2AC] animate-pulse" />
                      <span>{suppressedCount} whipsaw crossings successfully suppressed so far</span>
                    </div>
                  )}

                  {showAdvancedAntiWhipsaw && (
                    <div className="pt-2 border-t border-[#D1D9E6] grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] mb-1">
                          Hysteresis Buffer:
                        </label>
                        <select
                          value={hysteresisBufferPct}
                          onChange={e => setHysteresisBufferPct(parseFloat(e.target.value))}
                          className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-xl px-2 py-1.5 text-xs font-mono text-[#3D4852] focus:outline-none"
                        >
                          <option value={0.25}>0.25% (Tight)</option>
                          <option value={0.5}>0.50% (Standard / Recommended)</option>
                          <option value={1.0}>1.00% (Wide Band)</option>
                          <option value={2.0}>2.00% (High Volatility)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#6B7280] mb-1">
                          Cooldown Throttling:
                        </label>
                        <select
                          value={cooldownMinutes}
                          onChange={e => setCooldownMinutes(parseInt(e.target.value, 10))}
                          className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-xl px-2 py-1.5 text-xs font-mono text-[#3D4852] focus:outline-none"
                        >
                          <option value={10}>10 Minutes</option>
                          <option value={30}>30 Minutes (Recommended)</option>
                          <option value={60}>60 Minutes</option>
                          <option value={120}>2 Hours</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Trigger Status Comparison Box */}
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
                    <div className="flex-1">
                      <p className="font-bold">
                        {isCurrentlyTriggered
                          ? `🎯 Target Met! Current price (${currSign}${currentPriceInSelectedCurrency.toLocaleString()}) has reached your ${targetType === 'DIP_BUY' ? 'dip-buy' : 'breakout'} level.`
                          : `Monitoring price: Current is ${currSign}${currentPriceInSelectedCurrency.toLocaleString()} (${Math.abs(Number((((currentPriceInSelectedCurrency - numericTarget) / numericTarget) * 100).toFixed(1)))}% from target).`}
                      </p>
                      {item.customThresholds.targetBuyTriggered && onDismissBuyTrigger && (
                        <button
                          type="button"
                          onClick={() => onDismissBuyTrigger(item.symbol)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#6C63FF] hover:text-[#4F46E5] bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-0.5 rounded-lg"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Acknowledge & reset trigger status</span>
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

            {/* Volatility Jump % */}
            <div>
              <label className="block font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] mb-1">
                Volatility Jump Sensitivity (+% ATR):
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="100"
                  value={volatPct}
                  onChange={e => setVolatPct(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-2xl px-4 py-2 font-mono font-bold text-sm text-[#3D4852] focus:shadow-neu-inset-deep focus:outline-none"
                />
                <span className="font-display font-extrabold text-base text-[#3D4852]">%</span>
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
          <div className="flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 border-t border-[#D1D9E6] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-neu px-4 py-2 text-xs font-bold rounded-2xl min-h-[38px] touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={targetBuyActive && isInvalidNumber}
              className={`px-5 py-2 text-xs font-bold rounded-2xl flex items-center gap-2 transition-all min-h-[38px] touch-manipulation ${
                targetBuyActive && isInvalidNumber
                  ? 'bg-[#CBD5E0] text-[#A0AEC0] cursor-not-allowed shadow-none'
                  : 'btn-neu-primary'
              }`}
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
