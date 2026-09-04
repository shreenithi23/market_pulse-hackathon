import React, { useState, useEffect } from 'react';
import { UserProfile, AuthResponse } from '../types/auth';
import {
  X,
  Mail,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Inbox,
  ArrowLeft
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'LOGIN' | 'REGISTER' | 'VERIFY_OTP';
  onClose: () => void;
  onSuccess: (user: UserProfile, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'REGISTER',
  onClose,
  onSuccess
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY_OTP'>(initialMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Sync mode when initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setInfoMessage(null);
    }
  }, [isOpen, initialMode]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Handle Registration -> Dispatches OTP
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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

      setInfoMessage(data.message || 'OTP dispatched to your email.');
      if (data.debugOtp) {
        setDebugOtp(data.debugOtp);
      }
      setResendCooldown(60);
      setMode('VERIFY_OTP');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit registration');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification -> Completes Registration & Logs In
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
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
        throw new Error(data.error || 'Verification failed');
      }

      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
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
        throw new Error(data.error || 'Failed to resend OTP');
      }
      setInfoMessage('A fresh 6-digit OTP has been sent to your email.');
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

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
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
          setInfoMessage('Email verification is required. We have sent a verification code to your mail.');
          if (data.debugOtp) setDebugOtp(data.debugOtp);
          setResendCooldown(60);
          setMode('VERIFY_OTP');
          return;
        }
        throw new Error(data.error || 'Invalid email or password');
      }

      if (data.token && data.user) {
        onSuccess(data.user, data.token);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Autofill demo account for quick evaluation
  const fillDemoAccount = () => {
    setEmail('trader@marketradar.io');
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[#E0E5EC] p-6 shadow-neu-extrude sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-2 text-[#6B7280] hover:text-[#3D4852] bg-[#E0E5EC] shadow-neu-extrude-sm active:shadow-neu-inset-sm transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0E5EC] shadow-neu-inset text-[#6C63FF] mb-3">
            {mode === 'VERIFY_OTP' ? (
              <KeyRound className="h-7 w-7 animate-pulse" />
            ) : mode === 'LOGIN' ? (
              <ShieldCheck className="h-7 w-7" />
            ) : (
              <User className="h-7 w-7" />
            )}
          </div>
          <h2 className="font-display font-extrabold text-2xl text-[#3D4852]">
            {mode === 'REGISTER' && 'Create Your Profile'}
            {mode === 'VERIFY_OTP' && 'Verify Email with OTP'}
            {mode === 'LOGIN' && 'Welcome Back'}
          </h2>
          <p className="font-body text-xs text-[#6B7280] mt-1">
            {mode === 'REGISTER' && 'Register to track watchlist alerts, custom buy targets, and profile preferences.'}
            {mode === 'VERIFY_OTP' && `We sent a 6-digit confirmation code to ${email}`}
            {mode === 'LOGIN' && 'Sign in to access your portfolio profile and saved target buy reminders.'}
          </p>
        </div>

        {/* Mode Switcher Tabs (Login vs Register) */}
        {mode !== 'VERIFY_OTP' && (
          <div className="flex bg-[#E0E5EC] shadow-neu-inset p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-display font-bold rounded-xl transition-all ${
                mode === 'REGISTER'
                  ? 'bg-[#E0E5EC] shadow-neu-extrude-sm text-[#6C63FF]'
                  : 'text-[#6B7280] hover:text-[#3D4852]'
              }`}
            >
              Register Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-display font-bold rounded-xl transition-all ${
                mode === 'LOGIN'
                  ? 'bg-[#E0E5EC] shadow-neu-extrude-sm text-[#6C63FF]'
                  : 'text-[#6B7280] hover:text-[#3D4852]'
              }`}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Status / Error Alerts */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#E0E5EC] p-3 text-xs font-medium text-[#E53E3E] shadow-neu-inset-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#E0E5EC] p-3 text-xs font-medium text-[#38B2AC] shadow-neu-inset-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* 📬 Dev Mailbox / Instant Code Helper Banner */}
        {debugOtp && mode === 'VERIFY_OTP' && (
          <div className="mb-5 rounded-2xl bg-[#E0E5EC] p-3 shadow-neu-extrude-sm border border-[#6C63FF]/30">
            <div className="flex items-center justify-between text-xs font-bold text-[#6C63FF] mb-1">
              <span className="flex items-center gap-1.5">
                <Inbox className="h-3.5 w-3.5" />
                <span>Simulated Mailbox Dispatch:</span>
              </span>
              <span className="bg-[#6C63FF]/10 px-2 py-0.5 rounded-lg text-[10px]">PREVIEW</span>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              Sent to <strong className="text-[#3D4852]">{email}</strong>: OTP is{' '}
              <strong className="font-mono text-sm tracking-wider text-[#6C63FF]">{debugOtp}</strong>
            </p>
            <button
              type="button"
              onClick={() => setOtp(debugOtp)}
              className="mt-2 w-full py-1 text-[11px] font-bold text-[#6C63FF] bg-[#E0E5EC] shadow-neu-inset-sm rounded-xl hover:text-[#4F46E5]"
            >
              Autofill Code: {debugOtp}
            </button>
          </div>
        )}

        {/* FORM 1: REGISTER */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1.5">
                Full Name (Optional)
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Arjun Mehta"
                  className="input-neu w-full pl-10 pr-4 py-2.5 text-xs text-[#3D4852] rounded-2xl font-body placeholder-[#A0AEC0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1.5">
                Email Address *
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.name@example.com"
                  className="input-neu w-full pl-10 pr-4 py-2.5 text-xs text-[#3D4852] rounded-2xl font-body placeholder-[#A0AEC0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1.5">
                Password * (min 6 chars)
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-neu w-full pl-10 pr-10 py-2.5 text-xs text-[#3D4852] rounded-2xl font-body placeholder-[#A0AEC0]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 text-[#6B7280] hover:text-[#3D4852]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-neu-primary w-full py-3 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Send Verification OTP</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-[#6B7280]">Already have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setError(null);
                }}
                className="text-xs font-bold text-[#6C63FF] hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* FORM 2: VERIFY OTP */}
        {mode === 'VERIFY_OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280]">
                  Enter 6-Digit Verification Code
                </label>
                <span className="text-[10px] font-mono text-[#6C63FF]">Expires in 10 mins</span>
              </div>

              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="input-neu w-full pl-10 pr-4 py-3 text-center text-lg tracking-[0.35em] font-mono font-extrabold text-[#3D4852] rounded-2xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="btn-neu-primary w-full py-3 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verify Email & Finish Registration</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setMode('REGISTER')}
                className="text-[#6B7280] hover:text-[#3D4852] flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change Email</span>
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="font-bold text-[#6C63FF] hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* FORM 3: LOGIN */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1.5">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.name@example.com"
                  className="input-neu w-full pl-10 pr-4 py-2.5 text-xs text-[#3D4852] rounded-2xl font-body placeholder-[#A0AEC0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#6B7280] mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-[#6B7280]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-neu w-full pl-10 pr-10 py-2.5 text-xs text-[#3D4852] rounded-2xl font-body placeholder-[#A0AEC0]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 text-[#6B7280] hover:text-[#3D4852]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-neu-primary w-full py-3 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Sign In to Profile</span>
                </>
              )}
            </button>

            {/* Quick Demo Fill Button */}
            <div className="pt-2 border-t border-[#D1D9E6]/60 flex items-center justify-between">
              <button
                type="button"
                onClick={fillDemoAccount}
                className="text-[11px] text-[#6C63FF] font-bold hover:underline"
              >
                Use Demo Account (Arjun Mehta)
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setError(null);
                }}
                className="text-xs text-[#6B7280] hover:text-[#3D4852]"
              >
                Need an account? <strong className="text-[#6C63FF]">Register</strong>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
