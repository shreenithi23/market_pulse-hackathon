/**
 * geminiService.ts
 * Lazy Gemini AI client with auth-error backoff and retry suppression.
 */

import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config/environment.ts";

let geminiClient: GoogleGenAI | null = null;
let geminiAuthFailed = false;
let geminiRetryAfter = 0;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  const now = Date.now();
  if (geminiAuthFailed && now < geminiRetryAfter) {
    return null;
  }
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });
    } catch (e) {
      console.warn("[GEMINI] Failed to initialize GoogleGenAI client:", e);
      return null;
    }
  }
  return geminiClient;
}

export function markGeminiAuthFailed() {
  geminiAuthFailed = true;
  geminiRetryAfter = Date.now() + 15 * 60 * 1000; // 15-min backoff
  console.warn("[GEMINI] Authentication unavailable; operating in deterministic briefing mode.");
}

export function clearGeminiAuthFailed() {
  geminiAuthFailed = false;
  geminiRetryAfter = 0;
}
