import React, { useState } from 'react';
import { StockQuote } from '../types/market';
import { Plus, Search, Check, X } from 'lucide-react';

interface AddStockModalProps {
  availableStocks: StockQuote[];
  watchlistSymbols: string[];
  onAddStock: (symbol: string) => void;
  onClose: () => void;
}

export const AddStockModal: React.FC<AddStockModalProps> = ({
  availableStocks,
  watchlistSymbols,
  onAddStock,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customTicker, setCustomTicker] = useState('');

  const filtered = availableStocks.filter(s =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTicker.trim()) return;
    onAddStock(customTicker.toUpperCase().trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D4852]/40 p-4 font-body backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#E0E5EC] p-6 md:p-8 rounded-[32px] shadow-neu-extrude-lg">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF]">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-[#3D4852] tracking-tight">
                Track Stock in Watchlist
              </h3>
              <p className="text-xs text-[#6B7280] font-medium">Add tickers to monitor anomaly triggers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-neu w-9 h-9 rounded-xl text-[#6B7280] hover:text-[#3D4852]"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-[#6B7280]" strokeWidth={2.2} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company name, or sector..."
              className="w-full bg-[#E0E5EC] shadow-neu-inset rounded-2xl py-3 pl-11 pr-4 text-xs font-medium text-[#3D4852] placeholder-[#A0AEC0] focus:shadow-neu-inset-deep focus:outline-none"
              autoFocus
            />
          </div>

          {/* Available stock list */}
          <div className="max-h-60 overflow-y-auto space-y-2.5 bg-[#E0E5EC] shadow-neu-inset p-3.5 rounded-[24px]">
            {filtered.map(stock => {
              const isAlreadyAdded = watchlistSymbols.includes(stock.symbol);
              return (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between bg-[#E0E5EC] px-4 py-3 rounded-2xl shadow-neu-extrude-sm hover:shadow-neu-extrude transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-base text-[#3D4852]">
                        {stock.symbol}
                      </span>
                      <span className="font-body text-xs font-medium text-[#6B7280]">
                        {stock.name}
                      </span>
                    </div>
                    <div className="font-body text-[11px] text-[#6C63FF] font-medium">
                      {stock.sector} • {(stock.avgVolume / 1_000_000).toFixed(1)}M avg vol
                    </div>
                  </div>

                  <div>
                    {isAlreadyAdded ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-display font-bold text-[#38B2AC] bg-[#E0E5EC] shadow-neu-inset-sm px-3 py-1 rounded-xl">
                        <Check className="h-3 w-3 text-[#38B2AC]" strokeWidth={2.5} />
                        <span>Tracked</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onAddStock(stock.symbol);
                          onClose();
                        }}
                        className="btn-neu-primary px-3.5 py-1.5 text-xs font-bold rounded-xl"
                      >
                        + Track
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom ticker input */}
          <form
            onSubmit={handleCustomSubmit}
            className="border-t border-[#D1D9E6] pt-4"
          >
            <div className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] mb-2">
              Or Enter Any Custom Symbol:
            </div>
            <div className="flex gap-2.5">
              <input
                type="text"
                value={customTicker}
                onChange={e => setCustomTicker(e.target.value.toUpperCase())}
                placeholder="e.g. SPY, QQQ, PLTR, BABA..."
                className="flex-1 bg-[#E0E5EC] shadow-neu-inset rounded-2xl px-4 py-2.5 text-xs font-mono font-bold uppercase text-[#3D4852] placeholder-[#A0AEC0] focus:shadow-neu-inset-deep focus:outline-none"
              />
              <button
                type="submit"
                className="btn-neu-primary px-5 py-2.5 text-xs font-bold rounded-2xl"
              >
                Track Symbol
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
