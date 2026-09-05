import dotenv from "dotenv";
dotenv.config();

export const PORT = Number(process.env.PORT) || 3000;
export const USD_INR_EXCHANGE_RATE = 85.20;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Session TTL: 7 days in ms
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
