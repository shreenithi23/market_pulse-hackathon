export interface StockSeed {
  symbol: string;
  name: string;
  sector: string;
  basePrice: number;
  avgVolume: number;
  beta: number;
  currency?: "INR" | "USD";
  marketCapTier?: "MEGA" | "LARGE" | "MID";
  peRatio?: number;
  whyPick?: string;
}

export const STOCK_UNIVERSE: StockSeed[] = [
  // --- Semiconductors & Hardware ---
  { symbol: "NVDA", name: "NVIDIA Corp", sector: "Semiconductors", basePrice: 128.50, avgVolume: 52_000_000, beta: 1.85, currency: "USD", marketCapTier: "MEGA", peRatio: 48.2, whyPick: "Dominant AI accelerator platform with 88% data center GPU market share." },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors", basePrice: 154.60, avgVolume: 38_000_000, beta: 1.75, currency: "USD", marketCapTier: "LARGE", peRatio: 42.1, whyPick: "High-growth MI300 architecture challenging enterprise cloud space." },
  { symbol: "TSM", name: "Taiwan Semiconductor", sector: "Semiconductors", basePrice: 172.40, avgVolume: 22_000_000, beta: 1.25, currency: "USD", marketCapTier: "MEGA", peRatio: 26.4, whyPick: "Global foundry leader manufacturing 90% of advanced sub-5nm chips." },

  // --- Cloud & Enterprise Software ---
  { symbol: "MSFT", name: "Microsoft Corp", sector: "Cloud/Software", basePrice: 442.80, avgVolume: 21_000_000, beta: 1.12, currency: "USD", marketCapTier: "MEGA", peRatio: 35.8, whyPick: "Azure cloud compounding revenue with OpenAI Copilot integration." },
  { symbol: "PLTR", name: "Palantir Tech", sector: "Cloud/Software", basePrice: 31.25, avgVolume: 42_000_000, beta: 2.05, currency: "USD", marketCapTier: "LARGE", peRatio: 88.0, whyPick: "AIP commercial adoption expanding institutional enterprise contracts." },
  { symbol: "INFY", name: "Infosys Ltd", sector: "Cloud/Software", basePrice: 1820.00, avgVolume: 8_500_000, beta: 0.82, currency: "INR", marketCapTier: "LARGE", peRatio: 26.5, whyPick: "Tier-1 Indian IT services leader with steady dividend payout and enterprise cloud digital transformation." },

  // --- Consumer Tech & Digital Media ---
  { symbol: "AAPL", name: "Apple Inc", sector: "Consumer Tech", basePrice: 224.20, avgVolume: 48_000_000, beta: 1.05, currency: "USD", marketCapTier: "MEGA", peRatio: 33.5, whyPick: "Unrivaled global ecosystem with 2.2B active hardware devices generating high-margin services." },
  { symbol: "AMZN", name: "Amazon.com Inc", sector: "Consumer Tech", basePrice: 186.30, avgVolume: 31_000_000, beta: 1.25, currency: "USD", marketCapTier: "MEGA", peRatio: 41.2, whyPick: "AWS cloud reacceleration and high-margin retail advertising engine." },
  { symbol: "GOOGL", name: "Alphabet Inc", sector: "Digital Media", basePrice: 178.10, avgVolume: 24_000_000, beta: 1.15, currency: "USD", marketCapTier: "MEGA", peRatio: 24.1, whyPick: "Search monopoly economics paired with Gemini multi-modal infrastructure growth." },
  { symbol: "META", name: "Meta Platforms", sector: "Digital Media", basePrice: 512.00, avgVolume: 16_000_000, beta: 1.35, currency: "USD", marketCapTier: "MEGA", peRatio: 27.6, whyPick: "Unmatched social attention monetization and open-source Llama AI ecosystem." },

  // --- Automotive / Clean EV ---
  { symbol: "TSLA", name: "Tesla Inc", sector: "Automotive/EV", basePrice: 218.40, avgVolume: 65_000_000, beta: 2.10, currency: "USD", marketCapTier: "MEGA", peRatio: 64.0, whyPick: "Market leader in autonomous robotaxi compute, energy storage, and EV manufacturing scale." },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automotive/EV", basePrice: 1045.00, avgVolume: 14_000_000, beta: 1.18, currency: "INR", marketCapTier: "LARGE", peRatio: 16.8, whyPick: "India's #1 passenger EV brand plus high-margin JLR luxury international turnaround." },

  // --- Financials & Banking ---
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", basePrice: 1642.00, avgVolume: 18_000_000, beta: 0.76, currency: "INR", marketCapTier: "MEGA", peRatio: 18.2, whyPick: "India's premier private banking powerhouse; ideal defensive stabilizer with low credit delinquency." },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", basePrice: 214.90, avgVolume: 11_000_000, beta: 0.95, currency: "USD", marketCapTier: "MEGA", peRatio: 12.4, whyPick: "Fortress balance sheet, $4T assets, and dominant global net interest margin leader." },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", basePrice: 1228.00, avgVolume: 15_000_000, beta: 0.85, currency: "INR", marketCapTier: "LARGE", peRatio: 17.5, whyPick: "Best-in-class return on assets (RoA > 2.3%) and strong retail underwriting franchise." },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", basePrice: 39.40, avgVolume: 35_000_000, beta: 1.10, currency: "USD", marketCapTier: "LARGE", peRatio: 13.8, whyPick: "Massive consumer deposit base benefiting from durable interest rate environments." },

  // --- Healthcare & Pharmaceuticals ---
  { symbol: "LLY", name: "Eli Lilly & Co", sector: "Healthcare", basePrice: 948.00, avgVolume: 3_200_000, beta: 0.78, currency: "USD", marketCapTier: "MEGA", peRatio: 65.0, whyPick: "Revolutionary GLP-1 metabolic health portfolio with high defensive patent protection." },
  { symbol: "SUNPHARMA", name: "Sun Pharma", sector: "Healthcare", basePrice: 1785.00, avgVolume: 4_500_000, beta: 0.62, currency: "INR", marketCapTier: "LARGE", peRatio: 34.0, whyPick: "Top Indian pharma multinational with high specialty dermatology & oncology margins." },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", basePrice: 564.50, avgVolume: 3_800_000, beta: 0.65, currency: "USD", marketCapTier: "MEGA", peRatio: 22.8, whyPick: "Healthcare provider with non-correlated premium cash flows and consistent dividend growth." },

  // --- Energy & Natural Resources ---
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", basePrice: 2980.00, avgVolume: 9_200_000, beta: 0.88, currency: "INR", marketCapTier: "MEGA", peRatio: 27.2, whyPick: "India's highest-valued conglomerate uniting oil-to-chemicals, Jio 5G telecom, and retail." },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", basePrice: 116.80, avgVolume: 14_000_000, beta: 0.85, currency: "USD", marketCapTier: "MEGA", peRatio: 14.1, whyPick: "Low break-even barrels in Permian/Guyana with aggressive shareholder buybacks." },
  { symbol: "CVX", name: "Chevron Corp", sector: "Energy", basePrice: 148.20, avgVolume: 8_500_000, beta: 0.88, currency: "USD", marketCapTier: "LARGE", peRatio: 13.9, whyPick: "Capital-efficient upstream portfolio yielding 4.2% dividend yield." },

  // --- Consumer Staples & FMCG ---
  { symbol: "ITC", name: "ITC Limited", sector: "Consumer Staples", basePrice: 492.00, avgVolume: 16_000_000, beta: 0.55, currency: "INR", marketCapTier: "LARGE", peRatio: 27.8, whyPick: "Tremendous cash machine with 3.8% dividend yield and ultra-low beta (0.55) downside buffer." },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", basePrice: 168.50, avgVolume: 6_200_000, beta: 0.54, currency: "USD", marketCapTier: "MEGA", peRatio: 26.2, whyPick: "Essential household consumer brand with 67 consecutive years of dividend increases." },

  // --- Crypto / Fintech ---
  { symbol: "COIN", name: "Coinbase Global", sector: "Crypto/Fintech", basePrice: 228.70, avgVolume: 12_000_000, beta: 2.60, currency: "USD", marketCapTier: "LARGE", peRatio: 38.0, whyPick: "Pure-play institutional crypto exchange with Ethereum L2 Base transaction growth." }
];
