import React from 'react';
import { SlidersHorizontal, Zap, Clock, ShieldAlert, RotateCcw, X } from 'lucide-react';

interface SimulationControlsModalProps {
  onSimulateScenario: (scenario: string) => void;
  onSelectOffset: (hours: number) => void;
  onResetBaseline: () => void;
  onClose: () => void;
}

export const SimulationControlsModal: React.FC<SimulationControlsModalProps> = ({
  onSimulateScenario,
  onSelectOffset,
  onResetBaseline,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D4852]/40 p-4 font-body backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#E0E5EC] p-6 md:p-8 rounded-[32px] shadow-neu-extrude-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF]">
              <SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-[#3D4852] tracking-tight">
                Simulation Lab & Time Machine
              </h3>
              <p className="text-xs text-[#6B7280] font-medium">Test real-time anomaly detection & return-later states</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-neu w-9 h-9 rounded-xl text-[#6B7280] hover:text-[#3D4852]"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Section 1: Time Displacement / Return Later */}
          <div className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm">
            <div className="flex items-center gap-2.5 font-display font-extrabold text-sm text-[#3D4852] mb-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] text-xs font-bold">
                1
              </span>
              <span>Time Machine ("Return Later" Mode)</span>
            </div>
            <p className="font-body text-xs font-medium text-[#6B7280] mb-3.5">
              Fast-forward your memory baseline backward to test how the Smart Watchlist highlights what changed while you were away:
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => {
                  onSelectOffset(1);
                  onClose();
                }}
                className="btn-neu py-2.5 text-center font-display font-bold text-xs rounded-2xl"
              >
                +1 Hour Ago
              </button>
              <button
                onClick={() => {
                  onSelectOffset(4);
                  onClose();
                }}
                className="btn-neu py-2.5 text-center font-display font-bold text-xs rounded-2xl"
              >
                +4 Hours Ago
              </button>
              <button
                onClick={() => {
                  onSelectOffset(24);
                  onClose();
                }}
                className="btn-neu py-2.5 text-center font-display font-bold text-xs rounded-2xl"
              >
                Yesterday (24h)
              </button>
            </div>
          </div>

          {/* Section 2: Market Shocks & Sector Runs */}
          <div className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm">
            <div className="flex items-center gap-2.5 font-display font-extrabold text-sm text-[#3D4852] mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] text-xs font-bold">
                2
              </span>
              <span>Market Impulses & Shocks</span>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  onSimulateScenario('TECH_SECTOR_RALLY');
                  onClose();
                }}
                className="w-full bg-[#E0E5EC] p-3.5 text-left rounded-2xl shadow-neu-extrude-sm hover:shadow-neu-extrude active:shadow-neu-inset transition-all duration-300 flex justify-between items-center group"
              >
                <div>
                  <div className="font-display font-extrabold text-xs text-[#38B2AC]">
                    Simulate Tech Sector Rally (+4.2%)
                  </div>
                  <div className="font-body text-[11px] text-[#6B7280] font-medium mt-0.5">
                    Triggers coordinated multi-stock breakout in NVDA, AMD, MSFT
                  </div>
                </div>
                <span className="font-display font-bold text-[10px] text-[#38B2AC] bg-[#E0E5EC] shadow-neu-inset-sm px-3 py-1 rounded-xl">
                  Trigger
                </span>
              </button>

              <button
                onClick={() => {
                  onSimulateScenario('ENERGY_PULLBACK');
                  onClose();
                }}
                className="w-full bg-[#E0E5EC] p-3.5 text-left rounded-2xl shadow-neu-extrude-sm hover:shadow-neu-extrude active:shadow-neu-inset transition-all duration-300 flex justify-between items-center group"
              >
                <div>
                  <div className="font-display font-extrabold text-xs text-[#E53E3E]">
                    Simulate Energy Sector Drawdown
                  </div>
                  <div className="font-body text-[11px] text-[#6B7280] font-medium mt-0.5">
                    Triggers coordinated liquidations in XOM, CVX with elevated volume
                  </div>
                </div>
                <span className="font-display font-bold text-[10px] text-[#E53E3E] bg-[#E0E5EC] shadow-neu-inset-sm px-3 py-1 rounded-xl">
                  Trigger
                </span>
              </button>

              <button
                onClick={() => {
                  onSimulateScenario('NVDA_BREAKOUT');
                  onClose();
                }}
                className="w-full bg-[#E0E5EC] p-3.5 text-left rounded-2xl shadow-neu-extrude-sm hover:shadow-neu-extrude active:shadow-neu-inset transition-all duration-300 flex justify-between items-center group"
              >
                <div>
                  <div className="font-display font-extrabold text-xs text-[#6C63FF]">
                    Simulate NVDA Earnings Surge (+5.8%)
                  </div>
                  <div className="font-body text-[11px] text-[#6B7280] font-medium mt-0.5">
                    Breaches 3.0% threshold, 2.8x volume, spikes attention score to 90+
                  </div>
                </div>
                <span className="font-display font-bold text-[10px] text-[#6C63FF] bg-[#E0E5EC] shadow-neu-inset-sm px-3 py-1 rounded-xl">
                  Trigger
                </span>
              </button>
            </div>
          </div>

          {/* Section 3: Data Resilience & Feed Conflicts */}
          <div className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm">
            <div className="flex items-center gap-2.5 font-display font-extrabold text-sm text-[#3D4852] mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] text-xs font-bold">
                3
              </span>
              <span>Data Feed Resilience & Resolution</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  onSimulateScenario('FEED_ARBITRAGE_CONFLICT');
                  onClose();
                }}
                className="btn-neu p-3.5 text-left rounded-2xl"
              >
                <div className="font-display font-bold text-xs text-[#E53E3E]">Simulate Feed Conflict</div>
                <div className="font-body text-[#6B7280] text-[11px] font-medium mt-0.5">Exchange divergence & median resolution</div>
              </button>

              <button
                onClick={() => {
                  onSimulateScenario('RESOLVE_EVENTS');
                  onClose();
                }}
                className="btn-neu p-3.5 text-left rounded-2xl"
              >
                <div className="font-display font-bold text-xs text-[#38B2AC]">Resolve Active Events</div>
                <div className="font-body text-[#6B7280] text-[11px] font-medium mt-0.5">Advances anomalies to RESOLVED state</div>
              </button>
            </div>
          </div>

          {/* Reset button & footer */}
          <div className="flex justify-between items-center border-t border-[#D1D9E6] pt-4">
            <button
              onClick={() => {
                onResetBaseline();
                onClose();
              }}
              className="btn-neu px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#6C63FF]" strokeWidth={2.2} />
              <span>Reset Baseline to Now</span>
            </button>

            <button
              onClick={onClose}
              className="btn-neu-primary px-5 py-2 text-xs font-bold rounded-2xl"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
