import React, { useState } from 'react';
import { CompressedInsight } from '../types/market';
import { Layers, ChevronDown, ChevronUp, FileText, Sparkles, Zap } from 'lucide-react';

interface ExecutiveBriefingProps {
  briefing: string;
  compressedInsights: CompressedInsight[];
  totalTracked: number;
}

export const ExecutiveBriefing: React.FC<ExecutiveBriefingProps> = ({
  briefing,
  compressedInsights
}) => {
  const [showPipeline, setShowPipeline] = useState(false);

  return (
    <section className="relative px-4 py-5 max-w-7xl mx-auto w-full font-body">
      {/* Neumorphic Soft Card */}
      <div className="card-neu p-6 md:p-8 relative">
        {/* Header bar of note */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
              <FileText className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-[#3D4852] tracking-tight">
                Executive Briefing: What Meaningfully Changed
              </h2>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                AI-synthesized memo prioritizing high-signal shifts over repetitive market noise
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowPipeline(prev => !prev)}
            className="btn-neu px-4 py-2.5 text-xs font-bold rounded-2xl flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm">
              <Layers className="h-3 w-3" strokeWidth={2} />
            </span>
            <span>
              Compression Pipeline ({compressedInsights.length} Clusters)
            </span>
            {showPipeline ? (
              <ChevronUp className="h-3.5 w-3.5 ml-0.5 text-[#6B7280]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-0.5 text-[#6B7280]" />
            )}
          </button>
        </div>

        {/* The Briefing Text in Deep Inset Well */}
        <div className="font-body text-base text-[#3D4852] leading-relaxed whitespace-pre-line bg-[#E0E5EC] p-6 rounded-2xl shadow-neu-inset">
          {briefing}
        </div>

        {/* Compression Pipeline Visualizer with Nested Depth */}
        {showPipeline && (
          <div className="mt-6 bg-[#E0E5EC] p-6 rounded-[28px] shadow-neu-inset transition-all duration-300">
            {/* Pipeline Stage Header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D1D9E6]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E0E5EC] text-[#D97706] shadow-neu-extrude-sm">
                  <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#3D4852]">
                  ALERT COMPRESSION PIPELINE: RAW EVENTS ➔ SYNTHESIZED CLUSTERS
                </span>
              </div>
              <span className="font-body text-xs font-medium text-[#6B7280]">
                Deduplicates repetitive tick events into actionable takeaways
              </span>
            </div>

            {/* Compressed Insights Grid: Extruded tiles nested inside Inset well */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {compressedInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="bg-[#E0E5EC] p-5 rounded-2xl shadow-neu-extrude-sm flex flex-col justify-between hover:-translate-y-1 hover:shadow-neu-extrude transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-display font-bold text-sm text-[#6C63FF]">
                        {insight.headline}
                      </span>
                      <span className="font-mono text-[10px] font-bold bg-[#E0E5EC] text-[#6B7280] shadow-neu-inset-sm px-2.5 py-1 rounded-xl shrink-0">
                        {insight.deduplicatedCount} collapsed
                      </span>
                    </div>

                    <p className="font-body text-xs text-[#3D4852] leading-relaxed mb-4">
                      {insight.executiveSummary}
                    </p>
                  </div>

                  <div className="border-t border-[#D1D9E6] pt-3 font-body text-xs text-[#6B7280] flex items-center gap-2">
                    <span className="font-display font-bold text-[#3D4852] uppercase text-[10px]">
                      Context:
                    </span>
                    <span className="text-[#3D4852] font-medium">{insight.actionableContext}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
