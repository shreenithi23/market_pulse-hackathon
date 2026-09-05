import React, { useState, useEffect, useCallback } from 'react';
import {
  MarketOverviewResponse,
  AttentionCategory,
  WatchlistRecord
} from './types/market';
import { TerminalHeader } from './components/TerminalHeader';
import { ExecutiveBriefing } from './components/ExecutiveBriefing';
import { WatchlistPane } from './components/WatchlistPane';
import { EventLifecyclePane } from './components/EventLifecyclePane';
import { SectorCorrelationPane } from './components/SectorCorrelationPane';
import { DynamicClustersPane } from './components/DynamicClustersPane';
import { PortfolioDiversificationPane } from './components/PortfolioDiversificationPane';
import { StockExplanationModal } from './components/StockExplanationModal';
import { StockThresholdModal } from './components/StockThresholdModal';
import { AddStockModal } from './components/AddStockModal';
import { SimulationControlsModal } from './components/SimulationControlsModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MainAuthPage } from './components/MainAuthPage';
import { AnalyticsSidebar } from './components/AnalyticsSidebar';
import { UserProfile } from './types/auth';
import {
  Sparkles,
  AlertTriangle,
  RefreshCw,
  List,
  Compass,
  Layers,
  GitBranch,
  FileText,
  PieChart,
  Target,
  Menu,
  ArrowLeft
} from 'lucide-react';

export type ActiveAppTab =
  | 'WATCHLIST'
  | 'PORTFOLIO_DIVERSIFICATION'
  | 'CORRELATED_CHANGES'
  | 'DYNAMIC_CLUSTERS'
  | 'EVENT_LIFECYCLE'
  | 'EXECUTIVE_BRIEFING';

export default function App() {
  const [data, setData] = useState<MarketOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab Navigation: Main Page is 'WATCHLIST'
  const [activeTab, setActiveTab] = useState<ActiveAppTab>('WATCHLIST');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Watchlist Category Filter
  const [selectedCategory, setSelectedCategory] = useState<AttentionCategory | 'ALL'>('ALL');

  // Stock Explanation Modal State
  const [explainingSymbol, setExplainingSymbol] = useState<string | null>(null);

  // Other Modals & UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [isSimModalOpen, setIsSimModalOpen] = useState<boolean>(false);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready • Polling live market changes');

  // View Router: Main Authentication/Landing Page vs Live Terminal Dashboard
  const [currentView, setCurrentView] = useState<'AUTH_PAGE' | 'DASHBOARD'>(() => {
    return localStorage.getItem('market_auth_token') ? 'DASHBOARD' : 'AUTH_PAGE';
  });

  // User Authentication & Profile States
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('market_auth_token'));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Check authenticated session on mount
  useEffect(() => {
    const token = localStorage.getItem('market_auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.user) {
            setCurrentUser(resData.user);
          } else {
            localStorage.removeItem('market_auth_token');
            setAuthToken(null);
          }
        })
        .catch(err => {
          console.warn('Session restoration skipped:', err?.message || err);
        });
    }
  }, []);

  // Main Page Auth Success: Transitions directly to Dashboard!
  const handleMainAuthSuccess = (user: UserProfile, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('market_auth_token', token);
    setCurrentView('DASHBOARD');
    setIsAuthModalOpen(false);
    flashStatus(`Welcome, ${user.name || user.email}! Connected to live market dashboard.`);
  };

  // Continue as Guest from Main Page
  const handleContinueAsGuest = () => {
    setCurrentView('DASHBOARD');
    flashStatus('Entered live dashboard in Guest mode. Sign in anytime from the top bar.');
  };

  const handleAuthSuccess = (user: UserProfile, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('market_auth_token', token);
    setIsAuthModalOpen(false);
    setCurrentView('DASHBOARD');
    setIsProfileModalOpen(true); // Direct navigation into profile as requested!
    flashStatus(`Welcome, ${user.name || user.email}! Registration verified and logged in.`);
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
    setAuthToken(null);
    localStorage.removeItem('market_auth_token');
    setIsProfileModalOpen(false);
    setIsAuthModalOpen(false);
    setCurrentView('AUTH_PAGE'); // Return user back to the main login/register page!
    flashStatus('Logged out successfully. Returned to main authentication portal.');
  };

  // Load Overview Data
  const fetchData = useCallback(async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/market/overview');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText || 'Service unavailable'}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON payload during startup');
      }
      const json: MarketOverviewResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      console.warn('Market overview feed status:', err?.message || err);
      // Only display full-page error if no data was ever loaded
      setData(current => {
        if (!current) {
          setError(err?.message || 'Failed to connect to backend market engine');
        }
        return current;
      });
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  }, []);

  // Initial fetch and auto-refresh interval (every 3 seconds)
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Flash status message helper
  const flashStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage('Ready • Polling live market changes');
    }, 4500);
  };

  // Watchlist Actions
  const handleAddStock = async (symbol: string) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (res.ok) {
        flashStatus(`Added ${symbol} to Watchlist`);
        fetchData();
      }
    } catch (err) {
      flashStatus(`Error adding ${symbol}`);
    }
  };

  const handleRemoveStock = async (symbol: string) => {
    try {
      const res = await fetch(`/api/watchlist/${symbol}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        flashStatus(`Removed ${symbol} from Watchlist`);
        if (explainingSymbol === symbol) setExplainingSymbol(null);
        fetchData();
      }
    } catch (err) {
      flashStatus(`Error removing ${symbol}`);
    }
  };

  const handleSaveThreshold = async (
    symbol: string,
    thresholds: Partial<WatchlistRecord['customThresholds']>,
    notes?: string
  ) => {
    try {
      const res = await fetch(`/api/watchlist/${symbol}/threshold`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...thresholds, userNotes: notes })
      });
      const resData = await res.json();
      if (res.ok) {
        if (resData.warning) {
          flashStatus(`⚠️ Note: ${resData.warning}`);
        } else {
          flashStatus(`Updated alert rules & buy target for ${symbol}`);
        }
        setEditingSymbol(null);
        fetchData();
      } else {
        flashStatus(`Error: ${resData.error || 'Failed to update sensitivity'}`);
      }
    } catch (err) {
      flashStatus(`Error updating sensitivity`);
    }
  };

  const handleDismissBuyReminder = async (symbol: string) => {
    try {
      const res = await fetch(`/api/watchlist/${symbol}/buy-reminder/dismiss`, {
        method: 'POST'
      });
      if (res.ok) {
        flashStatus(`Dismissed buy reminder for ${symbol}`);
        fetchData();
      }
    } catch (err) {
      flashStatus(`Error dismissing buy reminder`);
    }
  };

  // Memory Snapshot Actions
  const handleTakeSnapshot = async () => {
    try {
      const res = await fetch('/api/memory/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `Manual Review (${new Date().toLocaleTimeString()})`,
          notes: 'User captured snapshot from UI'
        })
      });
      if (res.ok) {
        flashStatus('Baseline reset to current market quotes');
        fetchData();
      }
    } catch (err) {
      flashStatus('Failed to reset memory baseline');
    }
  };

  const handleSelectOffset = async (hours: number) => {
    try {
      const res = await fetch('/api/memory/select-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offsetHours: hours })
      });
      if (res.ok) {
        flashStatus(`Comparing against baseline from ${hours}h ago`);
        fetchData();
      }
    } catch (err) {
      flashStatus('Failed to shift baseline');
    }
  };

  // Simulation Triggers
  const handleSimulateScenario = async (scenario: string) => {
    try {
      const res = await fetch('/api/simulation/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      if (res.ok) {
        flashStatus(`Triggered simulation scenario: ${scenario}`);
        fetchData();
      }
    } catch (err) {
      flashStatus(`Simulation trigger failed`);
    }
  };

  // 1. If currently on Main Authentication & Landing Gateway Page, render MainAuthPage immediately
  if (currentView === 'AUTH_PAGE') {
    return (
      <MainAuthPage
        onAuthSuccess={handleMainAuthSuccess}
        onContinueAsGuest={handleContinueAsGuest}
      />
    );
  }

  if (loading && !data) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#E0E5EC] p-4 font-body">
        <div className="card-neu p-8 text-center max-w-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0E5EC] shadow-neu-inset text-[#6C63FF] mb-4">
            <Sparkles className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h2 className="font-display font-extrabold text-2xl text-[#3D4852]">
            Calibrating Market Radar...
          </h2>
          <p className="font-body text-xs font-medium text-[#6B7280] mt-2 leading-relaxed">
            Initializing change detection algorithms, sector correlation metrics, and memory baselines.
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#E0E5EC] p-4 font-body">
        <div className="card-neu p-8 text-center max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0E5EC] shadow-neu-inset text-[#E53E3E] mb-4">
            <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h2 className="font-display font-extrabold text-2xl text-[#3D4852]">
            Connection Interrupted
          </h2>
          <p className="font-body text-xs font-medium text-[#6B7280] mt-2">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="btn-neu-primary mt-5 px-6 py-2.5 text-xs font-bold rounded-2xl"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const currentEditingRecord = editingSymbol
    ? data.watchlist.find(w => w.symbol === editingSymbol)
    : null;

  const currentExplainingStock = explainingSymbol
    ? data.stocks.find(s => s.symbol === explainingSymbol)
    : null;

  const currentExplainingScore = explainingSymbol
    ? data.attentionScores[explainingSymbol]
    : undefined;

  const currentExplainingWatchlistRecord = explainingSymbol
    ? data.watchlist.find(w => w.symbol === explainingSymbol)
    : undefined;

  return (
    <div className="relative min-h-screen bg-[#E0E5EC] font-body text-[#3D4852] antialiased flex flex-col">
      {/* 1. Terminal Header */}
      <TerminalHeader
        feedHealth={data.feedHealth}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
        onOpenSimModal={() => setIsSimModalOpen(true)}
        crtEnabled={crtEnabled}
        onToggleCrt={() => setCrtEnabled(prev => !prev)}
        currentUser={currentUser}
        onOpenAuth={() => setCurrentView('AUTH_PAGE')}
        onOpenProfile={() => {
          if (currentUser) {
            setIsProfileModalOpen(true);
          } else {
            setCurrentView('AUTH_PAGE');
          }
        }}
        onLogout={handleLogout}
        onGoToAuthPage={() => setCurrentView('AUTH_PAGE')}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      {/* Top-Level Tab Navigation: Simple Main Watchlist vs. Dedicated Specialized Tabs */}
      <nav className="border-b border-[#D1D9E6] bg-[#E0E5EC] px-3 sm:px-4 py-2.5 sm:py-3 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 py-0.5">
            {/* 1. Main Watchlist Tab Button */}
            <button
              id="tab-nav-watchlist"
              onClick={() => setActiveTab('WATCHLIST')}
              className={`px-3.5 sm:px-4 py-2 text-xs font-display font-bold uppercase tracking-wider rounded-2xl flex items-center gap-2 whitespace-nowrap shrink-0 transition-all duration-300 min-h-[40px] touch-manipulation ${
                activeTab === 'WATCHLIST'
                  ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset'
                  : 'btn-neu text-[#3D4852]'
              }`}
            >
              <List className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>Watchlist</span>
              <span className="bg-[#E0E5EC] shadow-neu-inset-sm px-2 py-0.5 text-[10px] rounded-lg">
                {data.watchlist.length}
              </span>
              {data.buyReminders?.some(b => b.triggered) && (
                <span className="w-2 h-2 rounded-full bg-[#38B2AC] animate-ping" title="Buy target reached!" />
              )}
            </button>

            {/* 2. Active Module Breadcrumb (When an analytical module is selected from sidebar) */}
            {activeTab !== 'WATCHLIST' && (
              <div className="flex items-center gap-2 pl-2 border-l border-[#D1D9E6]">
                <span className="bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset px-3 py-1.5 text-xs font-display font-bold uppercase rounded-xl flex items-center gap-1.5 shrink-0">
                  {activeTab === 'EXECUTIVE_BRIEFING' && <FileText className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  {activeTab === 'PORTFOLIO_DIVERSIFICATION' && <PieChart className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  {activeTab === 'CORRELATED_CHANGES' && <Compass className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  {activeTab === 'DYNAMIC_CLUSTERS' && <Layers className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  {activeTab === 'EVENT_LIFECYCLE' && <GitBranch className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  <span>
                    {activeTab === 'EXECUTIVE_BRIEFING' && 'Executive Briefing'}
                    {activeTab === 'PORTFOLIO_DIVERSIFICATION' && 'Portfolio Diversification'}
                    {activeTab === 'CORRELATED_CHANGES' && 'Correlated Changes'}
                    {activeTab === 'DYNAMIC_CLUSTERS' && 'Dynamic Clusters'}
                    {activeTab === 'EVENT_LIFECYCLE' && 'Event Lifecycle'}
                  </span>
                </span>

                <button
                  onClick={() => setActiveTab('WATCHLIST')}
                  className="btn-neu px-3 py-1.5 text-xs font-bold text-[#6B7280] hover:text-[#3D4852] rounded-xl flex items-center gap-1 min-h-[36px] shrink-0"
                  title="Return to Main Watchlist"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Back to Watchlist</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Stats Pill */}
          <div className="hidden xl:flex items-center gap-2 text-xs font-display font-bold text-[#6B7280] shrink-0">
            <span className="text-[#E53E3E] bg-[#E0E5EC] shadow-neu-inset-sm px-2.5 py-1 rounded-xl">
              {data.systemSummary.needsAttentionCount} Critical
            </span>
            <span className="text-[#D97706] bg-[#E0E5EC] shadow-neu-inset-sm px-2.5 py-1 rounded-xl">
              {data.systemSummary.worthKnowingCount} Worth Knowing
            </span>
          </div>
        </div>
      </nav>

      {/* 5. Main Area (Active Tab) */}
      <main className="flex-1 flex flex-col py-4">
        {/* TAB 1: MAIN PAGE - WATCHLIST (Clean, Simple, All Added Stocks) */}
        {activeTab === 'WATCHLIST' && (
          <WatchlistPane
            stocks={data.stocks}
            watchlist={data.watchlist}
            attentionScores={data.attentionScores}
            selectedCategory={selectedCategory}
            buyReminders={data.buyReminders}
            onSelectCategory={setSelectedCategory}
            onSelectStock={(sym) => setExplainingSymbol(sym)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenThresholdModal={(sym) => setEditingSymbol(sym)}
            onRemoveStock={handleRemoveStock}
            onDismissBuyReminder={handleDismissBuyReminder}
            onNavigateToDiversification={() => setActiveTab('PORTFOLIO_DIVERSIFICATION')}
          />
        )}

        {/* TAB 2: PORTFOLIO DIVERSIFICATION & CROSS-SECTOR TOP-K */}
        {activeTab === 'PORTFOLIO_DIVERSIFICATION' && (
          <PortfolioDiversificationPane
            diversification={data.diversification}
            watchlist={data.watchlist}
            stocks={data.stocks}
            onAddStock={handleAddStock}
            onOpenThresholdModal={(sym) => setEditingSymbol(sym)}
            onSelectStock={(sym) => setExplainingSymbol(sym)}
          />
        )}

        {/* TAB 3: CORRELATED CHANGE DETECTION (Sector Radar) */}
        {activeTab === 'CORRELATED_CHANGES' && (
          <SectorCorrelationPane sectorMovements={data.sectorMovements} />
        )}

        {/* TAB 4: DYNAMIC CLUSTERS */}
        {activeTab === 'DYNAMIC_CLUSTERS' && (
          <DynamicClustersPane
            dynamicGroups={data.dynamicGroups}
            stocks={data.stocks}
            attentionScores={data.attentionScores}
            onSelectStock={(sym) => setExplainingSymbol(sym)}
          />
        )}

        {/* TAB 5: EVENT LIFECYCLE STATE MACHINE */}
        {activeTab === 'EVENT_LIFECYCLE' && (
          <EventLifecyclePane
            events={data.events}
            onSimulateEventResolve={() => handleSimulateScenario('RESOLVE_EVENTS')}
          />
        )}

        {/* TAB 6: EXECUTIVE BRIEFING & 4-STAGE PIPELINE */}
        {activeTab === 'EXECUTIVE_BRIEFING' && (
          <ExecutiveBriefing
            briefing={data.personalizedExecutiveBriefing}
            compressedInsights={data.compressedInsights}
            totalTracked={data.systemSummary.totalTracked}
            attentionScores={data.attentionScores}
            events={data.events}
            systemSummary={data.systemSummary}
            memory={data.memory}
            stocks={data.stocks}
            onSelectStock={(sym) => setExplainingSymbol(sym)}
            onResetSnapshot={handleTakeSnapshot}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* 6. Status Bar / Footer */}
      <footer className="border-t border-[#D1D9E6] bg-[#E0E5EC] px-6 py-4 text-xs text-[#6B7280] z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-[#E0E5EC] shadow-neu-inset-sm text-[#6C63FF] px-3 py-1 font-display text-[11px] font-bold rounded-xl">
              STATUS
            </span>
            <span className="font-body text-xs font-semibold text-[#3D4852]">
              {statusMessage}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-body text-xs font-medium">
            <span>
              Tracked: <strong className="text-[#3D4852]">{data.systemSummary.totalTracked}</strong> Stocks
            </span>
            <span className="text-[#A0AEC0]">•</span>
            <span className="text-[#E53E3E] font-bold">
              Critical: {data.systemSummary.needsAttentionCount}
            </span>
            <span className="text-[#A0AEC0]">•</span>
            <span className="text-[#D97706] font-bold">
              Worth Knowing: {data.systemSummary.worthKnowingCount}
            </span>
            <span className="text-[#A0AEC0]">•</span>
            <span className="font-mono text-[11px] text-[#6B7280]">
              Latency: {data.feedHealth.latencyMs}ms
            </span>
          </div>
        </div>
      </footer>

      {/* Analytics Sidebar Drawer: Opens only when toggled */}
      <AnalyticsSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        data={data}
      />

      {/* MODAL 1: Stock Explanation Modal (When clicking any stock) */}
      {currentExplainingStock && (
        <StockExplanationModal
          stock={currentExplainingStock}
          scoreData={currentExplainingScore}
          watchlistRecord={currentExplainingWatchlistRecord}
          baselineSnapshot={data.memory.currentBaseline}
          activeEvents={data.events}
          onOpenThresholdModal={(sym) => {
            setEditingSymbol(sym);
          }}
          onRemoveStock={handleRemoveStock}
          onClose={() => setExplainingSymbol(null)}
        />
      )}

      {/* MODAL 2: Add Stock Modal */}
      {isAddModalOpen && (
        <AddStockModal
          availableStocks={data.stocks}
          watchlistSymbols={data.watchlist.map(w => w.symbol)}
          onAddStock={handleAddStock}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* MODAL 3: Stock Threshold Modal */}
      {currentEditingRecord && (
        <StockThresholdModal
          item={currentEditingRecord}
          quote={data?.stocks.find(s => s.symbol === currentEditingRecord.symbol)}
          onSave={(thresholds, notes) => handleSaveThreshold(currentEditingRecord.symbol, thresholds, notes)}
          onClose={() => setEditingSymbol(null)}
          onDismissBuyTrigger={handleDismissBuyReminder}
        />
      )}

      {/* MODAL 4: Simulation Controls Modal */}
      {isSimModalOpen && (
        <SimulationControlsModal
          onSimulateScenario={handleSimulateScenario}
          onSelectOffset={handleSelectOffset}
          onResetBaseline={handleTakeSnapshot}
          onClose={() => setIsSimModalOpen(false)}
        />
      )}

      {/* MODAL 5: User Registration, OTP Verification & Login Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* MODAL 6: User Profile & Preferences Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          user={currentUser}
          token={authToken || ''}
          onClose={() => setIsProfileModalOpen(false)}
          onUpdateUser={(updatedUser) => {
            setCurrentUser(updatedUser);
            flashStatus('Profile updated successfully');
          }}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
