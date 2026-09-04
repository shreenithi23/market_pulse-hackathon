import React, { useState, useEffect } from 'react';
import { UserProfile, AuthResponse } from '../types/auth';
import {
  Sparkles,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Target,
  Layers,
  Inbox,
  ArrowLeft,
  ChevronRight,
  Activity
} from 'lucide-react';

interface MainAuthPageProps {
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onContinueAsGuest: () => void;
}

export const MainAuthPage: React.FC<MainAuthPageProps> = ({
  onAuthSuccess,
  onContinueAsGuest
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY_OTP'>('LOGIN');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [currencyPreference, setCurrencyPreference] = useState<'INR' | 'USD'>('INR');
  const [otp, setOtp] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setError('Please provide both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data: AuthResponse & { error?: string; requiresOtp?: boolean } = await res.json();

      if (!res.ok) {
        if (data.requiresOtp) {
          setInfoMessage('Account requires email verification. We have dispatched a fresh 6-digit code.');
          if (data.debugOtp) setDebugOtp(data.debugOtp);
          setResendCooldown(60);
          setAuthMode('VERIFY_OTP');
          return;
        }
        throw new Error(data.error || 'Invalid credentials');
      }

      if (data.token && data.user) {
        onAuthSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid work or personal email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined
        })
      });

      const data: AuthResponse & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Registration failed');
      }

      setInfoMessage(data.message || 'Verification code dispatched to your email.');
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
      }
      setResendCooldown(60);
      setAuthMode('VERIFY_OTP');
    } catch (err: any) {
      setError(err?.message || 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: cleanOtp
        })
      });

      const data: AuthResponse & { error?: string } = await res.json();
      if (!res.ok || data.error || !data.token || !data.user) {
        throw new Error(data.error || 'Verification code invalid or expired');
      }

      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data: AuthResponse & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to dispatch new OTP');
      }
      setInfoMessage('A new 6-digit verification code has been dispatched.');
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
      }
      setResendCooldown(60);
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-Click Demo Login
  const handleQuickDemoLogin = () => {
    setEmail('trader@marketradar.io');
    setPassword('password123');
    setError(null);
    setInfoMessage('Credentials loaded. Click Sign In or press Enter.');
  };

  return (
    <div className="min-h-screen bg-[#E0E5EC] flex flex-col justify-between selection:bg-[#6C63FF]/30 selection:text-[#3D4852]">
      {/* Top Navigation Bar */}
      <header className="px-6 py-4 border-b border-[#D1D9E6]/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm">
              <Sparkles className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg tracking-tight text-[#3D4852]">
                DELTATRACE
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">
                Market Anomaly Intelligence
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#E0E5EC] px-3.5 py-1.5 rounded-full shadow-neu-inset-sm text-xs font-mono text-[#3D4852]">
              <span className="h-2 w-2 rounded-full bg-[#38B2AC] animate-pulse" />
              <span>LIVE FEED: CONNECTED</span>
            </div>
            <button
              id="btn-guest-direct-nav"
              onClick={onContinueAsGuest}
              className="btn-neu px-4 py-2 text-xs font-bold rounded-2xl flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0.5 transition-all text-[#6B7280] hover:text-[#3D4852]"
            >
              <span>Explore as Guest</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          
          {/* Left Column: Product Showcase & Value Narrative */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0E5EC] shadow-neu-inset-sm text-xs font-bold text-[#6C63FF]">
              <Activity className="h-3.5 w-3.5" />
              <span>INTELLIGENT WATCHLIST ENGINE</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#3D4852] tracking-tight leading-tight">
              Know what changed while you were away.
            </h1>

            <p className="font-body text-base text-[#6B7280] leading-relaxed max-w-xl">
              Traditional watchlists bombard you with raw noise. DeltaTrace anchors your baseline memory, isolates statistical price & volume anomalies, and alerts you when your target buy triggers align.
            </p>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#E0E5EC] shadow-neu-extrude-sm">
                <div className="flex items-center gap-2.5 mb-2 text-[#6C63FF]">
                  <Clock className="h-4 w-4" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Memory Baselines
                  </span>
                </div>
                <p className="font-body text-xs text-[#6B7280] leading-relaxed">
                  Anchor a snapshot and simulate returning in 1h, 4h, or 24h to spot high-conviction shifts.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#E0E5EC] shadow-neu-extrude-sm">
                <div className="flex items-center gap-2.5 mb-2 text-[#38B2AC]">
                  <Target className="h-4 w-4" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Target Buy Alerts
                  </span>
                </div>
                <p className="font-body text-xs text-[#6B7280] leading-relaxed">
                  Set disciplined execution prices in ₹ INR & $ USD with verified email notifications.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#E0E5EC] shadow-neu-extrude-sm">
                <div className="flex items-center gap-2.5 mb-2 text-[#D97706]">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Attention Tiers
                  </span>
                </div>
                <p className="font-body text-xs text-[#6B7280] leading-relaxed">
                  Algorithmic sorting separates genuine catalyst breakouts from standard market oscillations.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#E0E5EC] shadow-neu-extrude-sm">
                <div className="flex items-center gap-2.5 mb-2 text-[#6C63FF]">
                  <Layers className="h-4 w-4" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-[#3D4852]">
                    Dynamic Clusters
                  </span>
                </div>
                <p className="font-body text-xs text-[#6B7280] leading-relaxed">
                  Detect sector contagion across tech, energy, pharma, and banking in real time.
                </p>
              </div>
            </div>

            {/* Micro stats banner */}
            <div className="flex items-center gap-6 pt-2 font-mono text-xs text-[#6B7280]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#38B2AC]" />
                <span>12 Assets Tracked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#6C63FF]" />
                <span>OTP Authenticated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                <span>Multi-Currency (₹/$)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Authentication Card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-3xl bg-[#E0E5EC] p-6 sm:p-8 shadow-neu-extrude border border-[#D1D9E6]/40 relative">
              
              {/* Card Header & Mode Switcher */}
              {authMode !== 'VERIFY_OTP' ? (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold text-[#3D4852]">
                        {authMode === 'LOGIN' ? 'Welcome Back' : 'Create an Account'}
                      </h2>
                      <p className="font-body text-xs text-[#6B7280] mt-1">
                        {authMode === 'LOGIN'
                          ? 'Sign in to access your portfolio radar & target alerts'
                          : 'Set up your trading profile and personal watchlists'}
                      </p>
                    </div>
                  </div>

                  {/* Mode Tabs */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                    <button
                      id="tab-btn-signin"
                      type="button"
                      onClick={() => {
                        setAuthMode('LOGIN');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className={`py-2 text-xs font-bold rounded-xl transition-all ${
                        authMode === 'LOGIN'
                          ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                          : 'text-[#6B7280] hover:text-[#3D4852]'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      id="tab-btn-register"
                      type="button"
                      onClick={() => {
                        setAuthMode('REGISTER');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className={`py-2 text-xs font-bold rounded-xl transition-all ${
                        authMode === 'REGISTER'
                          ? 'bg-[#E0E5EC] text-[#6C63FF] shadow-neu-extrude-sm'
                          : 'text-[#6B7280] hover:text-[#3D4852]'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>
                </div>
              ) : (
                /* OTP Header */
                <div className="mb-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0E5EC] shadow-neu-inset text-[#6C63FF] mb-3">
                    <KeyRound className="h-7 w-7 animate-pulse" />
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-[#3D4852]">
                    Verify Your Email
                  </h2>
                  <p className="font-body text-xs text-[#6B7280] mt-1">
                    Enter the 6-digit confirmation code dispatched to{' '}
                    <span className="font-mono font-bold text-[#3D4852]">{email}</span>
                  </p>
                </div>
              )}

              {/* Status & Error Alerts */}
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-rose-500/10 p-3.5 text-xs text-rose-600 border border-rose-500/20 font-body">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-[#38B2AC]/10 p-3.5 text-xs text-[#38B2AC] border border-[#38B2AC]/20 font-body">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* Simulated Mailbox Notification (Debug & Easy Testing) */}
              {debugOtp && authMode === 'VERIFY_OTP' && (
                <div className="mb-5 rounded-2xl bg-[#6C63FF]/10 p-3.5 border border-[#6C63FF]/30 font-body">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#6C63FF]">
                      <Inbox className="h-4 w-4" />
                      <span>Simulated Inbox Preview</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#6C63FF]/20 text-[#6C63FF] font-semibold">
                      TEST OTP
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5563] mb-2.5">
                    For local testing, your verification code is:
                  </p>
                  <div className="flex items-center justify-between gap-2 bg-[#E0E5EC] p-2 rounded-xl shadow-neu-inset-sm">
                    <span className="font-mono text-base font-extrabold tracking-widest text-[#3D4852] px-2">
                      {debugOtp}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtp(debugOtp)}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-[#6C63FF] text-white shadow-sm hover:bg-[#5851df] transition-all"
                    >
                      Autofill Code
                    </button>
                  </div>
                </div>
              )}

              {/* Form Render Based on Mode */}
              {authMode === 'LOGIN' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-email-input"
                      className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider mb-1.5 font-display"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        id="login-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm text-sm text-[#3D4852] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 font-body"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="login-password-input"
                        className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider font-display"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError('To reset your password in this preview, register a new account or sign in with the instant demo credentials.');
                        }}
                        className="text-[11px] text-[#6C63FF] hover:underline font-body font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm text-sm text-[#3D4852] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 font-body"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6B7280] hover:text-[#3D4852]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-[#6B7280] text-[#6C63FF] focus:ring-[#6C63FF]"
                      />
                      <span className="text-xs text-[#6B7280] font-body">Remember my session</span>
                    </label>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    id="btn-submit-login"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#6C63FF] text-white font-display font-bold text-sm shadow-neu-extrude-sm hover:bg-[#5851df] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Sign In to Terminal</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Quick Demo Fill & Guest Options */}
                  <div className="pt-3 space-y-2.5">
                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-[#D1D9E6]" />
                      <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider font-mono text-[#6B7280]">
                        Or Quick Access
                      </span>
                      <div className="flex-grow border-t border-[#D1D9E6]" />
                    </div>

                    <button
                      id="btn-quick-demo-fill"
                      type="button"
                      onClick={handleQuickDemoLogin}
                      className="w-full py-2.5 px-3 rounded-2xl bg-[#E0E5EC] shadow-neu-extrude-sm hover:-translate-y-0.5 active:translate-y-0.5 text-xs font-bold text-[#6C63FF] flex items-center justify-center gap-2 transition-all"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>⚡ 1-Click Demo Account (trader@marketradar.io)</span>
                    </button>

                    <button
                      id="btn-guest-access"
                      type="button"
                      onClick={onContinueAsGuest}
                      className="w-full py-2 px-3 text-xs text-[#6B7280] hover:text-[#3D4852] font-body font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>Continue to live dashboard as guest</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>
              )}

              {authMode === 'REGISTER' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label
                      htmlFor="register-name-input"
                      className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider mb-1.5 font-display"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        id="register-name-input"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm text-sm text-[#3D4852] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 font-body"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="register-email-input"
                      className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider mb-1.5 font-display"
                    >
                      Email Address <span className="text-[#6C63FF]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        id="register-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="trader@domain.com"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm text-sm text-[#3D4852] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 font-body"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="register-password-input"
                      className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider mb-1.5 font-display"
                    >
                      Create Password <span className="text-[#6C63FF]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        id="register-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-11 py-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm text-sm text-[#3D4852] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 font-body"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6B7280] hover:text-[#3D4852]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Currency Preference Selector */}
                  <div>
                    <label className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider mb-1.5 font-display">
                      Preferred Target Currency
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrencyPreference('INR')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          currencyPreference === 'INR'
                            ? 'bg-[#38B2AC] text-white shadow-sm'
                            : 'bg-[#E0E5EC] text-[#6B7280] shadow-neu-extrude-sm hover:text-[#3D4852]'
                        }`}
                      >
                        <span>₹ INR (Indian Rupee)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrencyPreference('USD')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          currencyPreference === 'USD'
                            ? 'bg-[#6C63FF] text-white shadow-sm'
                            : 'bg-[#E0E5EC] text-[#6B7280] shadow-neu-extrude-sm hover:text-[#3D4852]'
                        }`}
                      >
                        <span>$ USD (US Dollar)</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    id="btn-submit-register"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#38B2AC] text-white font-display font-bold text-sm shadow-neu-extrude-sm hover:bg-[#319795] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Create Account & Send OTP</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-[#6B7280] font-body pt-1">
                    By signing up, you agree to market risk disclosures and terminal alerts.
                  </p>
                </form>
              )}

              {authMode === 'VERIFY_OTP' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="otp-code-input"
                      className="block text-xs font-bold text-[#3D4852] uppercase tracking-wider mb-1.5 font-display text-center"
                    >
                      6-Digit Security Code
                    </label>
                    <input
                      id="otp-code-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full py-3.5 text-center font-mono text-2xl tracking-[0.5em] font-extrabold rounded-2xl bg-[#E0E5EC] shadow-neu-inset text-[#3D4852] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]"
                    />
                  </div>

                  <button
                    id="btn-submit-verify-otp"
                    type="submit"
                    disabled={loading || otp.trim().length !== 6}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#6C63FF] text-white font-display font-bold text-sm shadow-neu-extrude-sm hover:bg-[#5851df] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify & Enter Dashboard</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs font-body pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('LOGIN')}
                      className="text-[#6B7280] hover:text-[#3D4852] flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to Sign In</span>
                    </button>

                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleResendOtp}
                      className="text-[#6C63FF] hover:underline font-bold disabled:opacity-50 disabled:no-underline"
                    >
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-[#D1D9E6]/60">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-body text-[#6B7280]">
          <div>
            <span>DeltaTrace Market Radar • Intelligent Baseline Memory & Anomaly Tracking</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Server: Active</span>
            <span>•</span>
            <span>Port: 3000</span>
            <span>•</span>
            <span>Secure Token Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
