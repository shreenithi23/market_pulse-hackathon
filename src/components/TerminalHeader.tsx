import React, { useState, useRef, useEffect } from 'react';
import { DataFeedHealth } from '../types/market';
import { UserProfile } from '../types/auth';
import {
  RefreshCw,
  SlidersHorizontal,
  Shield,
  Sparkles,
  User,
  CheckCircle2,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  Menu
} from 'lucide-react';

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
  onToggleSidebar?: () => void;
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
  onGoToAuthPage,
  onToggleSidebar
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuthAction = () => {
    setIsMenuOpen(false);
    if (onGoToAuthPage) {
      onGoToAuthPage();
    } else {
      onOpenAuth();
    }
  };

  const handleProfileClick = () => {
    setIsMenuOpen(false);
    onOpenProfile();
  };

  const handleSignOutClick = () => {
    setIsMenuOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <header className="relative bg-[#E0E5EC] px-4 py-3.5 shadow-neu-extrude z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Circular Analytics Sidebar Toggle (Opposite side of Profile Circle) + Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {onToggleSidebar && (
            <button
              id="btn-toggle-sidebar"
              onClick={onToggleSidebar}
              className="w-10 h-10 rounded-full bg-[#E0E5EC] shadow-neu-extrude hover:shadow-neu-inset active:shadow-neu-inset-sm flex items-center justify-center transition-all duration-300 relative border border-[#6C63FF]/30 hover:border-[#6C63FF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 group touch-manipulation text-[#6C63FF] shrink-0"
              title="Open Analytics Modules"
              aria-label="Open Analytics Modules"
            >
              <Menu className="h-5 w-5 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
            </button>
          )}

          <div className="flex items-center gap-2.5 bg-[#E0E5EC] text-[#3D4852] px-3.5 py-2 rounded-2xl shadow-neu-extrude-sm hover:-translate-y-0.5 hover:shadow-neu-extrude transition-all duration-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-[#3D4852]">
              SMART WATCHLIST
            </span>
          </div>

          <span className="hidden text-[#6B7280] font-medium text-lg lg:inline">•</span>

          <span className="hidden lg:inline font-body text-xs xl:text-sm font-medium text-[#6B7280]">
            What meaningfully changed since you last checked?
          </span>
        </div>

        {/* Right Section: Controls + Circular Profile / Auth Button */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 ml-auto">
          {/* Feed Health Pill (Inset Well) */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-[#E0E5EC] px-2.5 sm:px-3 py-1.5 font-body text-xs font-medium rounded-full shadow-neu-inset-sm text-[#3D4852] shrink-0">
            <span
              className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${
                feedHealth.status === 'LIVE' ? 'bg-[#38B2AC]' : 'bg-[#D97706]'
              } animate-pulse shrink-0`}
            />
            <span className="font-display font-bold tracking-wide text-[10px] sm:text-xs">
              <span className="hidden sm:inline">FEED: </span>{feedHealth.status}
            </span>
            <span className="font-mono text-[10px] sm:text-[11px] text-[#6B7280] hidden md:inline">
              ({feedHealth.latencyMs}ms)
            </span>
          </div>

          {/* Arbitrage Conflicts Tag */}
          {feedHealth.conflictsResolvedCount > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 bg-[#E0E5EC] px-3 py-1.5 font-body text-xs font-medium text-[#6B7280] rounded-full shadow-neu-inset-sm shrink-0">
              <Shield className="h-3.5 w-3.5 text-[#6C63FF]" strokeWidth={2} />
              <span>{feedHealth.conflictsResolvedCount} Conflicts</span>
            </div>
          )}

          {/* Action Buttons: Simulation Lab & Sync Feed */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="btn-open-sim"
              onClick={onOpenSimModal}
              className="btn-neu p-2 sm:px-3 sm:py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300 min-h-[38px] min-w-[38px] justify-center"
              title="Test Return Later scenarios & market shocks"
              aria-label="Simulation Lab"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-lg bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm shrink-0">
                <SlidersHorizontal className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
              <span className="hidden sm:inline">Simulation</span>
            </button>

            <button
              id="btn-refresh-feed"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="btn-neu-primary p-2 sm:px-3 sm:py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300 min-h-[38px] min-w-[38px] justify-center"
              title="Synchronize Live Market Data"
              aria-label="Sync Feed"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''} shrink-0`}
                strokeWidth={2.2}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>

          {/* Subtle Vertical Divider */}
          <div className="h-6 w-[1px] bg-[#D1D9E6] mx-0.5 shrink-0" />

          {/* Far Right: Circular Profile / Sign In Button */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              id={currentUser ? "btn-open-profile" : "btn-open-auth-page"}
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="w-10 h-10 rounded-full bg-[#E0E5EC] shadow-neu-extrude hover:shadow-neu-inset active:shadow-neu-inset-sm flex items-center justify-center transition-all duration-300 relative border border-[#6C63FF]/30 hover:border-[#6C63FF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 group touch-manipulation"
              title={currentUser ? `Profile: ${currentUser.name || currentUser.email}` : "Sign In / Register"}
              aria-label={currentUser ? "User Profile Menu" : "Sign In / Register"}
              aria-expanded={isMenuOpen}
            >
              {currentUser ? (
                /* Authenticated User Initial / Avatar */
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#6C63FF] to-[#818cf8] text-white flex items-center justify-center font-display font-extrabold text-sm shadow-inner overflow-hidden group-hover:scale-105 transition-transform">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
                </div>
              ) : (
                /* Guest Profile Icon */
                <div className="w-full h-full rounded-full flex items-center justify-center text-[#6C63FF] group-hover:text-[#4F46E5] transition-colors">
                  <User className="h-5 w-5 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
                </div>
              )}

              {/* Status Indicator Badge on the Circle Edge */}
              {currentUser ? (
                currentUser.emailVerified && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#38B2AC] border-2 border-[#E0E5EC]"
                    title="Verified Account"
                  />
                )
              ) : (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#6C63FF] border-2 border-[#E0E5EC] flex items-center justify-center"
                  title="Guest Mode - Sign In / Register"
                >
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                </span>
              )}
            </button>

            {/* Profile & Auth Dropdown Popover */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-3 w-[min(288px,calc(100vw-24px))] bg-[#E0E5EC] p-4 rounded-3xl shadow-neu-extrude border border-[#D1D9E6] z-50 animate-in fade-in zoom-in-95 duration-200">
                {currentUser ? (
                  /* Authenticated User Profile Summary */
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3 pb-3 border-b border-[#D1D9E6]">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#6C63FF] to-[#818cf8] text-white flex items-center justify-center font-display font-black text-base shadow-inner shrink-0">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-display font-extrabold text-sm text-[#3D4852] truncate">
                          {currentUser.name || 'Trader'}
                        </div>
                        <div className="font-mono text-xs text-[#6B7280] truncate">
                          {currentUser.email}
                        </div>
                        {currentUser.emailVerified ? (
                          <div className="flex items-center gap-1 text-[10px] text-[#38B2AC] font-bold mt-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified Trader</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#D97706] font-bold">Unverified</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={handleProfileClick}
                        className="btn-neu w-full py-2 px-3 text-xs font-display font-bold text-[#3D4852] hover:text-[#6C63FF] rounded-xl flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-[#6C63FF]" />
                          <span>Profile & Preferences</span>
                        </span>
                        <span className="font-mono text-[10px] text-[#6B7280]">
                          {currentUser.currencyPreference || 'INR'}
                        </span>
                      </button>

                      {onLogout && (
                        <button
                          onClick={handleSignOutClick}
                          className="btn-neu w-full py-2 px-3 text-xs font-display font-bold text-rose-600 hover:text-rose-700 rounded-xl flex items-center gap-2 transition-all"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Guest / Unauthenticated Popover with Direct Sign In / Register Actions */
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3 pb-3 border-b border-[#D1D9E6]">
                      <div className="w-11 h-11 rounded-full bg-[#E0E5EC] shadow-neu-inset flex items-center justify-center text-[#6C63FF] shrink-0">
                        <User className="h-6 w-6" strokeWidth={2} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-extrabold text-sm text-[#3D4852]">
                            Guest Profile
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[#E0E5EC] shadow-neu-inset-sm text-[#6B7280] rounded-full">
                            GUEST
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-[#6B7280] mt-0.5">
                          Not signed in to a portfolio
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] font-body text-[#6B7280] leading-relaxed">
                      Sign in or create an account to save custom price alert thresholds, persist baseline snapshots, and sync across devices.
                    </p>

                    <div className="space-y-2 pt-1">
                      <button
                        onClick={handleAuthAction}
                        className="btn-neu-primary w-full py-2 px-3 text-xs font-display font-bold rounded-xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Sign In</span>
                      </button>

                      <button
                        onClick={handleAuthAction}
                        className="btn-neu w-full py-2 px-3 text-xs font-display font-bold text-[#6C63FF] hover:text-[#4F46E5] rounded-xl flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Register New Account</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
