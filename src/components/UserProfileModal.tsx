import React, { useState } from 'react';
import { UserProfile } from '../types/auth';
import {
  X,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  LogOut,
  Sliders,
  DollarSign,
  TrendingUp,
  Bell,
  Link,
  Save,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  user: UserProfile;
  token: string;
  onClose: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  user,
  token,
  onClose,
  onUpdateUser,
  onLogout
}) => {
  const [name, setName] = useState<string>(user.name);
  const [currencyPreference, setCurrencyPreference] = useState<'INR' | 'USD'>(user.currencyPreference || 'INR');
  const [riskTolerance, setRiskTolerance] = useState<'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'>(user.riskTolerance || 'MODERATE');
  const [investmentHorizon, setInvestmentHorizon] = useState<'INTRADAY' | 'SWING' | 'LONG_TERM'>(user.investmentHorizon || 'SWING');
  const [defaultAlertChannel, setDefaultAlertChannel] = useState<'APP_AND_EMAIL' | 'APP_ONLY'>(user.defaultTargetBuyAlertChannel || 'APP_AND_EMAIL');
  const [growwClientId, setGrowwClientId] = useState<string>(user.growwClientId || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          currencyPreference,
          riskTolerance,
          investmentHorizon,
          defaultTargetBuyAlertChannel: defaultAlertChannel,
          growwClientId: growwClientId.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.user) {
        throw new Error(data.error || 'Failed to save profile changes');
      }

      onUpdateUser(data.user);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const initialLetter = (name.trim() || user.email).charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#E0E5EC] p-6 shadow-neu-extrude sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-2 text-[#6B7280] hover:text-[#3D4852] bg-[#E0E5EC] shadow-neu-extrude-sm active:shadow-neu-inset-sm transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6 pb-6 border-b border-[#D1D9E6]">
          {/* Avatar Icon */}
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-[#E0E5EC] shadow-neu-inset text-2xl font-extrabold text-[#6C63FF]">
            {initialLetter}
            {user.emailVerified && (
              <span
                className="absolute -bottom-1 -right-1 bg-[#38B2AC] text-white p-1 rounded-full shadow-md"
                title="Verified Email"
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
            )}
          </div>

          {/* User Identity Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-display font-extrabold text-2xl text-[#3D4852]">
                {name || user.name}
              </h2>
              {user.emailVerified && (
                <span className="bg-[#E0E5EC] text-[#38B2AC] shadow-neu-inset-sm px-2.5 py-0.5 text-[11px] font-bold rounded-lg flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>

            <p className="font-mono text-xs text-[#6B7280] mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <span>{user.email}</span>
            </p>

            <p className="font-body text-[11px] text-[#A0AEC0] mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#E0E5EC] p-3 text-xs font-medium text-[#E53E3E] shadow-neu-inset-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#E0E5EC] p-3 text-xs font-medium text-[#38B2AC] shadow-neu-inset-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Profile and trading preferences saved successfully!</span>
          </div>
        )}

        {/* Profile Settings Form */}
        <form onSubmit={handleSaveProfile} className="space-y-5">
          {/* Section 1: Basic Info */}
          <div className="bg-[#E0E5EC] p-4.5 rounded-2xl shadow-neu-extrude-sm space-y-3.5">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[#6C63FF]" />
              Personal Details
            </span>

            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your Name"
                className="input-neu w-full px-3.5 py-2 text-xs text-[#3D4852] rounded-xl font-body"
              />
            </div>

            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                Registered Email (Verified via OTP)
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3.5 py-2 text-xs text-[#6B7280] bg-[#E0E5EC] shadow-neu-inset-sm rounded-xl font-mono cursor-not-allowed"
              />
            </div>
          </div>

          {/* Section 2: Trading & Market Preferences */}
          <div className="bg-[#E0E5EC] p-4.5 rounded-2xl shadow-neu-extrude-sm space-y-3.5">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852] flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-[#6C63FF]" />
              Market & Watchlist Preferences
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Currency Preference */}
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                  Default Currency
                </label>
                <div className="flex bg-[#E0E5EC] shadow-neu-inset p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCurrencyPreference('INR')}
                    className={`flex-1 py-1.5 text-xs font-display font-bold rounded-lg transition-all ${
                      currencyPreference === 'INR'
                        ? 'bg-[#E0E5EC] shadow-neu-extrude-sm text-[#6C63FF]'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    ₹ INR (Rupees)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyPreference('USD')}
                    className={`flex-1 py-1.5 text-xs font-display font-bold rounded-lg transition-all ${
                      currencyPreference === 'USD'
                        ? 'bg-[#E0E5EC] shadow-neu-extrude-sm text-[#6C63FF]'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    $ USD (Dollars)
                  </button>
                </div>
              </div>

              {/* Risk Tolerance */}
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                  Risk Tolerance
                </label>
                <select
                  value={riskTolerance}
                  onChange={e => setRiskTolerance(e.target.value as any)}
                  className="input-neu w-full px-3 py-2 text-xs text-[#3D4852] rounded-xl font-display font-bold"
                >
                  <option value="CONSERVATIVE">Conservative (Low Volatility)</option>
                  <option value="MODERATE">Moderate (Balanced)</option>
                  <option value="AGGRESSIVE">Aggressive (High Growth / Beta)</option>
                </select>
              </div>

              {/* Investment Horizon */}
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                  Trading Horizon
                </label>
                <select
                  value={investmentHorizon}
                  onChange={e => setInvestmentHorizon(e.target.value as any)}
                  className="input-neu w-full px-3 py-2 text-xs text-[#3D4852] rounded-xl font-display font-bold"
                >
                  <option value="INTRADAY">Intraday (Day Trading)</option>
                  <option value="SWING">Swing (Days to Weeks)</option>
                  <option value="LONG_TERM">Long-Term (Position Investing)</option>
                </select>
              </div>

              {/* Alert Channel */}
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                  Target Buy Alerts Channel
                </label>
                <select
                  value={defaultAlertChannel}
                  onChange={e => setDefaultAlertChannel(e.target.value as any)}
                  className="input-neu w-full px-3 py-2 text-xs text-[#3D4852] rounded-xl font-display font-bold"
                >
                  <option value="APP_AND_EMAIL">Terminal & Email OTP Alerts</option>
                  <option value="APP_ONLY">Terminal Alerts Only</option>
                </select>
              </div>
            </div>

            {/* Broker Account Linked */}
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1 flex items-center justify-between">
                <span>Linked Broker ID (Groww / Kite / Angel)</span>
                <span className="text-[10px] text-[#6C63FF] font-mono">Optional</span>
              </label>
              <input
                type="text"
                value={growwClientId}
                onChange={e => setGrowwClientId(e.target.value)}
                placeholder="e.g. GW_8829104"
                className="input-neu w-full px-3.5 py-2 text-xs text-[#3D4852] rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="btn-neu text-[#E53E3E] hover:text-[#C53030] px-4 py-2.5 text-xs font-bold rounded-2xl flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-neu-primary px-6 py-2.5 text-xs font-bold rounded-2xl flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
