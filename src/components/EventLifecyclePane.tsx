import React, { useState } from 'react';
import { MarketEvent, EventLifecycleState, EventScope } from '../types/market';
import { GitBranch, Clock, ArrowRight, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

interface EventLifecyclePaneProps {
  events: MarketEvent[];
  onSimulateEventResolve?: () => void;
}

export const EventLifecyclePane: React.FC<EventLifecyclePaneProps> = ({
  events
}) => {
  const [filterState, setFilterState] = useState<EventLifecycleState | 'ALL'>('ALL');
  const [filterScope, setFilterScope] = useState<EventScope | 'ALL'>('ALL');

  const filteredEvents = events.filter(evt => {
    if (filterState !== 'ALL' && evt.currentState !== filterState) return false;
    if (filterScope !== 'ALL' && evt.scope !== filterScope) return false;
    return true;
  });

  const getStateBadge = (state: EventLifecycleState) => {
    switch (state) {
      case 'DEVELOPING':
        return {
          label: '⚡ DEVELOPING',
          classes: 'bg-[#E0E5EC] text-[#D97706] shadow-neu-inset-sm'
        };
      case 'ESCALATED':
        return {
          label: '🚨 ESCALATED',
          classes: 'bg-[#E0E5EC] text-[#E53E3E] shadow-neu-inset-sm'
        };
      case 'RECOVERING':
        return {
          label: '🩹 RECOVERING',
          classes: 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm'
        };
      case 'RESOLVED':
        return {
          label: '✅ RESOLVED',
          classes: 'bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset-sm'
        };
    }
  };

  return (
    <section className="px-4 py-5 max-w-7xl mx-auto w-full font-body">
      <div className="card-neu p-6 md:p-8 relative">
        {/* Header bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D1D9E6]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
              <GitBranch className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-[#3D4852] tracking-tight">
                Event Lifecycle State Machine
              </h2>
              <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                Tracks anomalies from initial trigger through escalation and post-shock equilibrium
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-display font-bold uppercase tracking-wider text-[#6B7280] text-[11px] mr-1">
              Stage:
            </span>
            {(['ALL', 'DEVELOPING', 'ESCALATED', 'RECOVERING', 'RESOLVED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterState(s)}
                className={`px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider rounded-2xl transition-all duration-300 ${
                  filterState === s
                    ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                    : 'btn-neu'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="bg-[#E0E5EC] shadow-neu-inset p-8 text-center text-[#6B7280] rounded-[24px] font-medium">
            No anomalies currently match this lifecycle stage filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {filteredEvents.map((evt) => {
              const badge = getStateBadge(evt.currentState);

              return (
                <div
                  key={evt.id}
                  className="bg-[#E0E5EC] p-6 rounded-2xl flex flex-col justify-between shadow-neu-extrude-sm hover:-translate-y-1 hover:shadow-neu-extrude transition-all duration-300"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`px-3 py-1 font-display text-[11px] font-bold uppercase rounded-xl ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                      <span className="bg-[#E0E5EC] shadow-neu-extrude-sm px-2.5 py-1 font-mono text-[10px] font-bold text-[#6B7280] rounded-lg">
                        {evt.scope.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="font-display font-extrabold text-base text-[#3D4852] mb-1.5">
                      <span className="text-[#6C63FF] mr-1">[{evt.symbol}]</span>
                      {evt.title}
                    </div>

                    <p className="font-body text-xs font-medium text-[#6B7280] leading-relaxed mb-4">
                      {evt.summary}
                    </p>

                    {/* Metrics Box (Inset Well) */}
                    <div className="grid grid-cols-2 gap-3 bg-[#E0E5EC] shadow-neu-inset-sm p-3.5 rounded-xl mb-4 font-mono text-xs">
                      <div>
                        <span className="font-body text-[#6B7280] block text-[10px] font-bold uppercase">
                          Current Delta:
                        </span>
                        <span
                          className={`font-extrabold text-sm ${
                            evt.currentDeviationPct >= 0 ? 'text-[#38B2AC]' : 'text-[#E53E3E]'
                          }`}
                        >
                          {evt.currentDeviationPct >= 0 ? '+' : ''}
                          {evt.currentDeviationPct}%
                        </span>
                      </div>
                      <div>
                        <span className="font-body text-[#6B7280] block text-[10px] font-bold uppercase">
                          Peak Impulse:
                        </span>
                        <span className="font-extrabold text-sm text-[#6C63FF]">
                          {evt.peakDeviationPct >= 0 ? '+' : ''}
                          {evt.peakDeviationPct}%
                        </span>
                      </div>
                    </div>

                    {/* Progression Timeline Log */}
                    <div className="space-y-2">
                      <div className="font-display font-bold text-[11px] uppercase tracking-wider text-[#3D4852]">
                        Lifecycle History Log:
                      </div>
                      {evt.stateHistory.map((step, sIdx) => (
                        <div key={sIdx} className="bg-[#E0E5EC] shadow-neu-inset-sm p-2.5 rounded-xl flex items-start gap-2 font-body text-xs text-[#3D4852]">
                          <span className="flex h-4 w-4 items-center justify-center rounded-lg bg-[#E0E5EC] shadow-neu-extrude-sm text-[#6C63FF] font-mono text-[10px] font-bold shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <div>
                            <span className="font-display font-bold text-[#6C63FF]">[{step.state}]</span>{' '}
                            <span className="font-mono font-bold text-[#3D4852]">
                              {step.metricSummary}
                            </span>{' '}
                            <span className="text-[#6B7280]">- {step.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[#D1D9E6] pt-3 flex items-center justify-between font-mono text-[10px] text-[#6B7280] font-medium">
                    <span>Detected: {new Date(evt.detectedAt).toLocaleTimeString()}</span>
                    <span className="text-[#6C63FF] font-bold">{evt.signalsInvolved.length} Signals</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
