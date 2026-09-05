/**
 * authRouter.ts
 * All /api/auth/* endpoints — fully backed by SQLite via marketRepository.
 * OTP state remains in-memory (short-lived, 10-min TTL, no persistence needed).
 */

import { Router } from "express";
import crypto from "crypto";
import { marketRepository } from "../../src/services/storage/SqliteMarketRepository.ts";
import { UserRecord } from "../../src/services/storage/IMarketRepository.ts";
import { UserProfile, EmailDispatchRecord } from "../../src/types/auth.ts";
import { extractToken } from "../middleware/authMiddleware.ts";
import { SESSION_TTL_MS } from "../config/environment.ts";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory OTP store (intentionally short-lived, never persisted)
// ---------------------------------------------------------------------------
interface PendingOtp {
  email: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  pendingUser: UserRecord; // hold unsaved user until verified
}
const pendingOtps = new Map<string, PendingOtp>();
const emailDispatchLogs: EmailDispatchRecord[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

function toUserProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    currencyPreference: user.currencyPreference,
    riskTolerance: user.riskTolerance,
    investmentHorizon: user.investmentHorizon,
    defaultTargetBuyAlertChannel: user.defaultTargetBuyAlertChannel,
    growwClientId: user.growwClientId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// POST /api/auth/register — generate OTP, stage user record
// ---------------------------------------------------------------------------
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if already registered and verified in DB
  const existingUser = await marketRepository.getUserByEmail(normalizedEmail);
  if (existingUser && existingUser.emailVerified) {
    return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const pwdHash = hashPassword(password, salt);

  const pendingUser: UserRecord = {
    id: existingUser?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split("@")[0],
    passwordSalt: salt,
    passwordHash: pwdHash,
    emailVerified: false,
    currencyPreference: "INR",
    riskTolerance: "MODERATE",
    investmentHorizon: "SWING",
    defaultTargetBuyAlertChannel: "APP_AND_EMAIL",
    createdAt: existingUser?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  pendingOtps.set(normalizedEmail, { email: normalizedEmail, otp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0, pendingUser });

  const dispatchRecord: EmailDispatchRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    subject: "Your Smart Market Watchlist Registration OTP",
    otp,
    sentAt: Date.now(),
    status: "SENT",
  };
  emailDispatchLogs.unshift(dispatchRecord);
  if (emailDispatchLogs.length > 30) emailDispatchLogs.pop();

  console.log(`[AUTH] 📧 Verification OTP [${otp}] dispatched to ${normalizedEmail}`);

  res.json({ success: true, message: `Verification code sent to ${normalizedEmail}.`, debugOtp: otp, expiresInSeconds: 600 });
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-otp — verify OTP, persist user, create session
// ---------------------------------------------------------------------------
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and 6-digit OTP are required" });

  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingOtps.get(normalizedEmail);

  if (!pending) return res.status(400).json({ error: "No active verification code found. Please request a new OTP." });
  if (Date.now() > pending.expiresAt) {
    pendingOtps.delete(normalizedEmail);
    return res.status(400).json({ error: "Verification code has expired. Please request a new OTP." });
  }
  if (pending.otp.trim() !== String(otp).trim()) {
    pending.attempts++;
    if (pending.attempts >= 5) {
      pendingOtps.delete(normalizedEmail);
      return res.status(400).json({ error: "Too many incorrect attempts. Please request a new OTP code." });
    }
    return res.status(400).json({ error: `Invalid OTP code. ${5 - pending.attempts} attempt(s) remaining.` });
  }

  // OTP valid — persist user to DB
  const verifiedUser: UserRecord = { ...pending.pendingUser, emailVerified: true, updatedAt: Date.now() };
  await marketRepository.upsertUser(verifiedUser);
  pendingOtps.delete(normalizedEmail);

  const sessionToken = crypto.randomBytes(32).toString("hex");
  await marketRepository.createSession(sessionToken, verifiedUser.id, Date.now() + SESSION_TTL_MS);

  console.log(`[AUTH] ✅ User ${normalizedEmail} verified and logged in.`);
  res.json({ success: true, message: "Registration completed successfully!", token: sessionToken, user: toUserProfile(verifiedUser) });
});

// ---------------------------------------------------------------------------
// POST /api/auth/resend-otp
// ---------------------------------------------------------------------------
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  const normalizedEmail = email.toLowerCase().trim();

  const user = await marketRepository.getUserByEmail(normalizedEmail);
  if (!user) return res.status(404).json({ error: "No account found with this email. Please register first." });
  if (user.emailVerified) return res.status(400).json({ error: "Your email is already verified. Please log in." });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const pending = pendingOtps.get(normalizedEmail);
  pendingOtps.set(normalizedEmail, {
    email: normalizedEmail,
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    pendingUser: pending?.pendingUser || user,
  });

  const dispatchRecord: EmailDispatchRecord = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    subject: "Resent: Your Smart Watchlist Verification OTP",
    otp,
    sentAt: Date.now(),
    status: "SENT",
  };
  emailDispatchLogs.unshift(dispatchRecord);
  console.log(`[AUTH] 📧 Resent OTP [${otp}] to ${normalizedEmail}`);

  res.json({ success: true, message: `A fresh OTP has been sent to ${normalizedEmail}.`, debugOtp: otp, expiresInSeconds: 600 });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const normalizedEmail = email.toLowerCase().trim();
  const user = await marketRepository.getUserByEmail(normalizedEmail);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const computedHash = hashPassword(password, user.passwordSalt);
  if (computedHash !== user.passwordHash) return res.status(401).json({ error: "Invalid email or password" });

  if (!user.emailVerified) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingOtps.set(normalizedEmail, { email: normalizedEmail, otp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0, pendingUser: user });
    return res.status(403).json({ error: "Email verification required. A new OTP has been dispatched.", requiresOtp: true, email: normalizedEmail, debugOtp: otp });
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  await marketRepository.createSession(sessionToken, user.id, Date.now() + SESSION_TTL_MS);

  console.log(`[AUTH] 🔑 User ${normalizedEmail} logged in.`);
  res.json({ success: true, message: "Logged in successfully", token: sessionToken, user: toUserProfile(user) });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get("/me", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated", authenticated: false });

  const userId = await marketRepository.getSessionUserId(token);
  if (!userId) return res.status(401).json({ error: "Session expired or invalid", authenticated: false });

  const user = await marketRepository.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found", authenticated: false });

  res.json({ success: true, authenticated: true, user: toUserProfile(user) });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/profile
// ---------------------------------------------------------------------------
router.put("/profile", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });

  const userId = await marketRepository.getSessionUserId(token);
  if (!userId) return res.status(401).json({ error: "Session expired or invalid" });

  const user = await marketRepository.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  const { name, avatarUrl, currencyPreference, riskTolerance, investmentHorizon, defaultTargetBuyAlertChannel, growwClientId } = req.body;

  if (name && typeof name === "string" && name.trim().length > 0) user.name = name.trim();
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (currencyPreference === "INR" || currencyPreference === "USD") user.currencyPreference = currencyPreference;
  if (riskTolerance && ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"].includes(riskTolerance)) user.riskTolerance = riskTolerance;
  if (investmentHorizon && ["INTRADAY", "SWING", "LONG_TERM"].includes(investmentHorizon)) user.investmentHorizon = investmentHorizon;
  if (defaultTargetBuyAlertChannel && ["APP_AND_EMAIL", "APP_ONLY"].includes(defaultTargetBuyAlertChannel)) user.defaultTargetBuyAlertChannel = defaultTargetBuyAlertChannel;
  if (growwClientId !== undefined) user.growwClientId = typeof growwClientId === "string" ? growwClientId.trim() : undefined;
  user.updatedAt = Date.now();

  await marketRepository.upsertUser(user);
  console.log(`[AUTH] 👤 Updated profile for ${user.email}`);
  res.json({ success: true, message: "Profile updated successfully", user: toUserProfile(user) });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post("/logout", async (req, res) => {
  const token = extractToken(req);
  if (token) await marketRepository.deleteSession(token);
  res.json({ success: true, message: "Logged out successfully" });
});

// ---------------------------------------------------------------------------
// GET /api/auth/debug/recent-otps (sandbox only)
// ---------------------------------------------------------------------------
router.get("/debug/recent-otps", (_req, res) => {
  res.json({ recentDispatches: emailDispatchLogs.slice(0, 10), activePendingCount: pendingOtps.size });
});

export default router;
