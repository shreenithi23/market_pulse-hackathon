import React from 'react';
import { SectorMovement } from '../types/market';
import { TrendingDown, Zap, Compass, Activity } from 'lucide-react';

interface SectorCorrelationPaneProps {
  sectorMovements: SectorMovement[];
}

export const SectorCorrelationPane: React.FC<SectorCorrelationPaneProps> = ({
  sectorMovements
}) => {
  return (
    <section className="px-4 py-5 max-w-7xl mx-auto w-full font-body">
      <div className="card-neu p-6 md:p-8 relative">
        {/* Header bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#38B2AC] shrink-0">
              <Compass className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-[#3D4852] tracking-tight">
                Correlated Change Detection (Sector Radar)
              </h2>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                Detects sector basket runs vs. idiosyncratic stock-specific news
              </p>
            </div>
          </div>

          <span className="font-display font-bold uppercase text-[11px] tracking-wider bg-[#E0E5EC] shadow-neu-inset-sm text-[#6B7280] px-3.5 py-1.5 rounded-full">
            Real-Time Co-Movement
          </span>
        </div>

        {/* Sector Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sectorMovements.map((sec) => {
            const isSurge = sec.isCorrelatedSurge;
            const isDrop = sec.isCorrelatedDrop;

            return (
              <div
                key={sec.sector}
                className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm hover:-translate-y-1 hover:shadow-neu-extrude transition-all duration-300"
              >
                {/* Sector Name & Avg Change */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-extrabold text-base text-[#3D4852]">
                    {sec.sector}
                  </span>
                  <span
                    className={`font-mono font-bold text-xs px-2.5 py-1 rounded-xl shadow-neu-inset-sm ${
                      sec.avgChangePct >= 0
                        ? 'text-[#38B2AC]'
                        : 'text-[#E53E3E]'
                    }`}
                  >
                    {sec.avgChangePct >= 0 ? '+' : ''}
                    {sec.avgChangePct}% avg
                  </span>
                </div>

                {/* Coordinated Alert Badges */}
                {isSurge && (
                  <div className="mb-3 flex items-center gap-2 bg-[#E0E5EC] text-[#38B2AC] px-3.5 py-1.5 text-xs font-display font-bold rounded-xl shadow-neu-inset-sm">
                    <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
                    <span>COORDINATED SECTOR SURGE</span>
                  </div>
                )}
                {isDrop && (
                  <div className="mb-3 flex items-center gap-2 bg-[#E0E5EC] text-[#E53E3E] px-3.5 py-1.5 text-xs font-display font-bold rounded-xl shadow-neu-inset-sm">
                    <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.2} />
                    <span>COORDINATED SECTOR LIQUIDATION</span>
                  </div>
                )}

                {/* Directional Consensus Bar */}
                <div className="space-y-2 mt-3 font-body text-xs text-[#6B7280]">
                  <div className="flex justify-between font-medium">
                    <span>Directional Consensus:</span>
                    <span className="font-mono font-bold text-[#3D4852]">
                      {Math.round(sec.correlationScore * 100)}%
                    </span>
                  </div>

                  <div className="h-3 w-full bg-[#E0E5EC] rounded-full p-0.5 shadow-neu-inset overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        sec.avgChangePct >= 0 ? 'bg-[#38B2AC]' : 'bg-[#E53E3E]'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(10, sec.correlationScore * 100))}%`
                      }}
                    />
                  </div>

                  <div className="flex justify-between pt-1 font-mono text-[11px] text-[#3D4852] font-medium">
                    <span>
                      {sec.advancersCount} Up / {sec.declinersCount} Down ({sec.totalStocks} stocks)
                    </span>
                    <span className="text-[#6C63FF]">
                      {sec.volumeMultiplier}x vol pace
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
