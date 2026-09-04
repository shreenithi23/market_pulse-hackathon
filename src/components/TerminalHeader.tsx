import React from 'react';
import { DataFeedHealth } from '../types/market';
import { UserProfile } from '../types/auth';
import { RefreshCw, SlidersHorizontal, Shield, Sparkles, Activity, User, CheckCircle2, LogOut, KeyRound } from 'lucide-react';

interface TerminalHeaderProps {
  feedHealth: DataFeedHealth;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSimModal: () => void;
  crtEnabled: boolean;
  onToggleCrt: () => void;
  currentUser?: UserProfile | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
  onGoToAuthPage?: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  feedHealth,
  onRefresh,
  isRefreshing,
  onOpenSimModal,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  onGoToAuthPage
}) => {
  return (
    <header className="relative bg-[#E0E5EC] px-4 py-4 shadow-neu-extrude z-20">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-[#E0E5EC] text-[#3D4852] px-4 py-2 rounded-2xl shadow-neu-extrude-sm hover:-translate-y-0.5 hover:shadow-neu-extrude transition-all duration-300">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm">
              <Sparkles className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="font-display font-extrabold text-base tracking-tight text-[#3D4852]">
              SMART WATCHLIST
            </span>
          </div>

          <span className="hidden text-[#6B7280] font-medium text-lg sm:inline">•</span>

          <span className="hidden sm:inline font-body text-sm font-medium text-[#6B7280]">
            What meaningfully changed since you last checked?
          </span>
        </div>

        {/* Live Feed Status & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Feed Health Pill (Inset Well) */}
          <div className="flex items-center gap-2 bg-[#E0E5EC] px-3.5 py-1.5 font-body text-xs font-medium rounded-full shadow-neu-inset-sm text-[#3D4852]">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                feedHealth.status === 'LIVE' ? 'bg-[#38B2AC]' : 'bg-[#D97706]'
              } animate-pulse`}
            />
            <span className="font-display font-bold tracking-wide">FEED: {feedHealth.status}</span>
            <span className="font-mono text-[11px] text-[#6B7280]">({feedHealth.latencyMs}ms)</span>
          </div>

          {/* Arbitrage Conflicts Tag */}
          {feedHealth.conflictsResolvedCount > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 bg-[#E0E5EC] px-3 py-1.5 font-body text-xs font-medium text-[#6B7280] rounded-full shadow-neu-inset-sm">
              <Shield className="h-3.5 w-3.5 text-[#6C63FF]" strokeWidth={2} />
              <span>{feedHealth.conflictsResolvedCount} Conflicts Resolved</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              id="btn-open-sim"
              onClick={onOpenSimModal}
              className="btn-neu px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
              title="Test Return Later scenarios & market shocks"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm">
                <SlidersHorizontal className="h-3 w-3" strokeWidth={2} />
              </span>
              <span>Simulation Lab</span>
            </button>

            <button
              id="btn-refresh-feed"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="btn-neu-primary px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-2 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
              title="Synchronize Live Market Data"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                strokeWidth={2.2}
              />
              <span>Sync Feed</span>
            </button>

            {/* Profile / Auth Button */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  id="btn-open-profile"
                  onClick={onOpenProfile}
                  className="btn-neu px-3.5 py-1.5 text-xs font-bold rounded-2xl flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300 border border-[#6C63FF]/20"
                  title="View & Edit User Profile"
                >
                  <div className="relative flex h-6 w-6 items-center justify-center rounded-xl bg-[#6C63FF] text-white text-[11px] font-extrabold shadow-sm">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
                    {currentUser.emailVerified && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#38B2AC] border border-[#E0E5EC]" />
                    )}
                  </div>
                  <span className="font-display font-bold text-[#3D4852] max-w-[110px] truncate hidden sm:inline">
                    {currentUser.name || currentUser.email.split('@')[0]}
                  </span>
                </button>

                {onLogout && (
                  <button
                    id="btn-logout-header"
                    onClick={onLogout}
                    className="btn-neu px-2.5 py-2 text-xs font-bold text-[#6B7280] hover:text-rose-600 rounded-2xl flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
                    title="Sign Out & Return to Login"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline text-[11px]">Sign Out</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider rounded-full bg-[#E0E5EC] shadow-neu-inset-sm text-[#6B7280]">
                  GUEST
                </span>
                <button
                  id="btn-open-auth-page"
                  onClick={onGoToAuthPage || onOpenAuth}
                  className="btn-neu px-3.5 py-2 text-xs font-bold text-[#6C63FF] rounded-2xl flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
                  title="Sign in or register account"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Sign In / Register</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
