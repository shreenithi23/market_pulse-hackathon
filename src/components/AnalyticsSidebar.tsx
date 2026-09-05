import React, { useEffect } from 'react';
import {
  FileText,
  PieChart,
  Compass,
  Layers,
  GitBranch,
  List,
  X,
  ChevronRight,
  Sparkles,
  Shield,
  Activity
} from 'lucide-react';
import { MarketOverviewResponse } from '../types/market';
import { ActiveAppTab } from '../App';

interface AnalyticsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveAppTab;
  onSelectTab: (tab: ActiveAppTab) => void;
  data: MarketOverviewResponse | null;
}

export const AnalyticsSidebar: React.FC<AnalyticsSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  data
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Order requested: Executive Briefing first, then Diversification, Correlated Changes, Dynamic Clusters, Event Lifecycle
  const analyticalModules = [
    {
      id: 'EXECUTIVE_BRIEFING' as ActiveAppTab,
      label: 'Executive Briefing',
      subtitle: 'Synthesized intelligence memo & urgent spotlight',
      icon: FileText,
      iconColor: 'text-[#6C63FF]',
      badge: data?.systemSummary?.needsAttentionCount
        ? `${data.systemSummary.needsAttentionCount} Critical`
        : 'Active',
      badgeColor: data?.systemSummary?.needsAttentionCount
        ? 'text-[#E53E3E] bg-[#E0E5EC]'
        : 'text-[#38B2AC] bg-[#E0E5EC]'
    },
    {
      id: 'PORTFOLIO_DIVERSIFICATION' as ActiveAppTab,
      label: 'Portfolio Diversification',
      subtitle: 'Sector weights & cross-sector top-K picks',
      icon: PieChart,
      iconColor: 'text-[#8B5CF6]',
      badge: data?.diversification?.recommendations
        ? `${data.diversification.recommendations.length} Top-K`
        : undefined,
      badgeColor: 'text-[#6C63FF] bg-[#E0E5EC]'
    },
    {
      id: 'CORRELATED_CHANGES' as ActiveAppTab,
      label: 'Correlated Changes',
      subtitle: 'Sector correlation radar & cross-sector drift',
      icon: Compass,
      iconColor: 'text-[#38B2AC]',
      badge: data?.sectorMovements?.length
        ? `${data.sectorMovements.length} Sectors`
        : undefined,
      badgeColor: 'text-[#38B2AC] bg-[#E0E5EC]'
    },
    {
      id: 'DYNAMIC_CLUSTERS' as ActiveAppTab,
      label: 'Dynamic Clusters',
      subtitle: 'Unsupervised co-movement equity groups',
      icon: Layers,
      iconColor: 'text-[#D97706]',
      badge: data?.dynamicGroups?.length
        ? `${data.dynamicGroups.length} Clusters`
        : undefined,
      badgeColor: 'text-[#D97706] bg-[#E0E5EC]'
    },
    {
      id: 'EVENT_LIFECYCLE' as ActiveAppTab,
      label: 'Event Lifecycle',
      subtitle: 'Developing, escalated & mean-reversion states',
      icon: GitBranch,
      iconColor: 'text-[#E53E3E]',
      badge: data?.events?.length ? `${data.events.length} Events` : 'Stable',
      badgeColor: data?.events?.length
        ? 'text-[#E53E3E] bg-[#E0E5EC]'
        : 'text-[#38B2AC] bg-[#E0E5EC]'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar Drawer */}
      <aside
        id="analytics-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Market Intelligence Modules"
        className={`fixed top-0 left-0 bottom-0 w-84 sm:w-96 max-w-[85vw] bg-[#E0E5EC] z-50 shadow-2xl border-r border-[#D1D9E6] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#D1D9E6] flex items-center justify-between bg-[#E0E5EC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF]">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-black text-base text-[#3D4852] tracking-wide">
                Intelligence Hub
              </h2>
              <p className="text-[11px] font-body text-[#6B7280] font-medium">
                Analytical Modules & Radar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl btn-neu flex items-center justify-center text-[#6B7280] hover:text-[#3D4852] transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <div className="px-2 pt-1 pb-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-[#6B7280]">
              Market Analytics
            </span>
          </div>

          {analyticalModules.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center gap-3.5 group ${
                  isSelected
                    ? 'bg-[#E0E5EC] shadow-neu-inset border border-[#6C63FF]/30'
                    : 'btn-neu text-[#3D4852] hover:text-[#6C63FF]'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-[#E0E5EC] shadow-neu-inset text-[#6C63FF]'
                      : 'bg-[#E0E5EC] shadow-neu-inset-sm ' + item.iconColor
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <span
                      className={`font-display font-bold text-sm truncate ${
                        isSelected ? 'text-[#6C63FF]' : 'text-[#3D4852]'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-neu-inset-sm shrink-0 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-body text-[#6B7280] line-clamp-1">
                    {item.subtitle}
                  </p>
                </div>

                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isSelected ? 'text-[#6C63FF] translate-x-0.5' : 'text-[#A0AEC0] group-hover:translate-x-0.5'
                  }`}
                />
              </button>
            );
          })}

          {/* Quick Return to Watchlist */}
          <div className="pt-4 border-t border-[#D1D9E6]/60">
            <div className="px-2 pb-2">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-[#6B7280]">
                Main Views
              </span>
            </div>

            <button
              onClick={() => {
                onSelectTab('WATCHLIST');
                onClose();
              }}
              className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center gap-3.5 group ${
                activeTab === 'WATCHLIST'
                  ? 'bg-[#E0E5EC] shadow-neu-inset border border-[#6C63FF]/30'
                  : 'btn-neu text-[#3D4852] hover:text-[#6C63FF]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === 'WATCHLIST'
                    ? 'bg-[#E0E5EC] shadow-neu-inset text-[#6C63FF]'
                    : 'bg-[#E0E5EC] shadow-neu-inset-sm text-[#3D4852]'
                }`}
              >
                <List className="h-5 w-5" strokeWidth={2.2} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                  <span
                    className={`font-display font-bold text-sm truncate ${
                      activeTab === 'WATCHLIST' ? 'text-[#6C63FF]' : 'text-[#3D4852]'
                    }`}
                  >
                    Main Watchlist
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-neu-inset-sm text-[#6C63FF] bg-[#E0E5EC] shrink-0">
                    {data?.watchlist?.length || 0} Stocks
                  </span>
                </div>
                <p className="text-[11px] font-body text-[#6B7280] line-clamp-1">
                  Primary watchlist table, drift & targets
                </p>
              </div>

              <ChevronRight
                className={`h-4 w-4 shrink-0 transition-transform ${
                  activeTab === 'WATCHLIST' ? 'text-[#6C63FF]' : 'text-[#A0AEC0] group-hover:translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D1D9E6] bg-[#E0E5EC] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B7280] font-mono">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#38B2AC]" />
              <span>Tick Simulator</span>
            </span>
            <span className="text-[#38B2AC] font-bold">3s Live</span>
          </div>

          <div className="flex items-center justify-between text-xs text-[#6B7280] font-mono">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[#6C63FF]" />
              <span>Hysteresis Guard</span>
            </span>
            <span className="text-[#6C63FF] font-bold">0.5% Active</span>
          </div>
        </div>
      </aside>
    </>
  );
};
