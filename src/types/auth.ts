export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  currencyPreference: 'INR' | 'USD';
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  investmentHorizon: 'INTRADAY' | 'SWING' | 'LONG_TERM';
  defaultTargetBuyAlertChannel: 'APP_AND_EMAIL' | 'APP_ONLY';
  growwClientId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResendOtpRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  message?: string;
  debugOtp?: string;
}

export interface EmailDispatchRecord {
  id: string;
  email: string;
  subject: string;
  otp: string;
  sentAt: number;
  status: 'SENT' | 'SIMULATED_DEV_MAILBOX';
}
