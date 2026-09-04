import React from 'react';
import { MarketMemoryState } from '../types/market';
import { Clock, Camera, AlertCircle, Bookmark, CheckCircle2 } from 'lucide-react';

interface MemoryBaselineBannerProps {
  memory: MarketMemoryState;
  needsAttentionCount: number;
  worthKnowingCount: number;
  onTakeSnapshot: () => void;
  onSelectOffset: (hours: number) => void;
  isTakingSnapshot: boolean;
}

export const MemoryBaselineBanner: React.FC<MemoryBaselineBannerProps> = ({
  memory,
  needsAttentionCount,
  worthKnowingCount,
  onTakeSnapshot,
  onSelectOffset,
  isTakingSnapshot
}) => {
  const currentSnap = memory.currentBaseline;

  return (
    <div className="relative bg-[#E0E5EC] px-4 py-3.5 font-body shadow-neu-extrude-sm z-10">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Memory Baseline & Elapsed Time */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Baseline Note Tag (Inset Well) */}
          <div className="flex items-center gap-2.5 bg-[#E0E5EC] px-3.5 py-1.5 rounded-2xl shadow-neu-inset-sm text-[#3D4852]">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm">
              <Bookmark className="h-3 w-3" strokeWidth={2.2} />
            </span>
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#6B7280]">
              BASELINE:
            </span>
            <span className="font-display font-bold text-xs text-[#3D4852]">
              {currentSnap.label}
            </span>
          </div>

          {/* Time Elapsed Tag (Inset Well) */}
          <div className="flex items-center gap-2 bg-[#E0E5EC] px-3.5 py-1.5 font-body text-xs text-[#3D4852] rounded-2xl shadow-neu-inset-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm">
              <Clock className="h-3 w-3" strokeWidth={2.2} />
            </span>
            <span className="text-[#6B7280] font-medium">Away For:</span>
            <span className="font-mono font-bold text-[#6C63FF]">
              +{memory.timeSinceBaselineFormatted}
            </span>
          </div>

          {/* Attention Counts / Neumorphic Tactile Badges */}
          <div className="flex items-center gap-2">
            {needsAttentionCount > 0 && (
              <span className="flex items-center gap-2 bg-[#E0E5EC] text-[#E53E3E] px-3.5 py-1.5 text-xs font-display font-bold rounded-2xl shadow-neu-extrude-sm">
                <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>{needsAttentionCount} NEED ATTENTION</span>
              </span>
            )}
            {worthKnowingCount > 0 && (
              <span className="flex items-center gap-2 bg-[#E0E5EC] text-[#D97706] px-3.5 py-1.5 text-xs font-display font-bold rounded-2xl shadow-neu-extrude-sm">
                <span>⚡ {worthKnowingCount} WORTH KNOWING</span>
              </span>
            )}
            {needsAttentionCount === 0 && worthKnowingCount === 0 && (
              <span className="flex items-center gap-2 bg-[#E0E5EC] text-[#38B2AC] px-3.5 py-1.5 text-xs font-display font-bold rounded-2xl shadow-neu-extrude-sm">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Zero Critical Shifts</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Fast Simulation of Return Later & Reset Baseline */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Return Later simulation buttons */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-display font-bold uppercase tracking-wider text-[#6B7280]">
              Return Later:
            </span>
            <button
              onClick={() => onSelectOffset(1)}
              className="btn-neu px-3 py-1 font-mono text-xs font-bold rounded-xl text-[#3D4852] hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
              title="Fast-forward: Compare against 1 hour ago"
            >
              +1h
            </button>
            <button
              onClick={() => onSelectOffset(4)}
              className="btn-neu px-3 py-1 font-mono text-xs font-bold rounded-xl text-[#3D4852] hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
              title="Fast-forward: Compare against 4 hours ago"
            >
              +4h
            </button>
            <button
              onClick={() => onSelectOffset(24)}
              className="btn-neu px-3 py-1 font-mono text-xs font-bold rounded-xl text-[#3D4852] hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
              title="Fast-forward: Compare against yesterday (24h ago)"
            >
              +24h
            </button>
          </div>

          {/* Reset Baseline Button */}
          <button
            id="btn-take-snapshot"
            onClick={onTakeSnapshot}
            disabled={isTakingSnapshot}
            className="btn-neu-teal px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
            title="Anchor new baseline: all change detection will measure from this moment"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span>Reset Baseline to Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
