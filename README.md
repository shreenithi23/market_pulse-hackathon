# Smart Watchlist • Market Pulse

> An intelligent, real-time market monitoring terminal and watchlist engine designed to highlight meaningful shifts, cross-sector correlations, event state machines, and AI-synthesized executive briefings.

---

## 📋 Prerequisites

Before running the application, make sure your machine has:

- **Node.js**: `v20.0.0` or higher (Recommended: `v22.x.x` or latest LTS)
  - Verify with: `node -v`
- **npm**: `v9.0.0` or higher
  - Verify with: `npm -v`

---

## 🚀 Quick Setup & Run (Local Development)

### 1. Extract the Archive
Unzip the downloaded zip file and navigate into the folder:
```bash
unzip pulsewatch.zip
cd pulsewatch
```

### 2. Install Dependencies
Install all project dependencies:
```bash
npm install
```

### 3. Environment Setup (Optional)
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(Optional)* Add your **Google Gemini API Key** in `.env` if you wish to use live Gemini AI models for executive briefings. If omitted, the system seamlessly runs with built-in heuristic briefing algorithms.

### 4. Start the Application
Run the unified development server (starts both Vite client & Express backend on port `3000`):
```bash
npm run dev
```

### 5. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## 🛠️ Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express server with live Vite HMR on `http://localhost:3000` |
| `npm run build` | Builds both the React client (`dist/`) and bundles the server (`dist/server.cjs`) |
| `npm start` | Runs the compiled production server (`dist/server.cjs`) |
| `npm run lint` | Type checks the entire codebase with `tsc --noEmit` |
| `npm run clean` | Removes the compiled `dist/` build directory |

---

## 🏗️ Production Build & Deployment

To verify and run a production build locally:

```bash
# 1. Build client and server bundles
npm run build

# 2. Run the production server
npm start
```
The production server will be running on `http://localhost:3000` (or the port specified in `PORT`).

---

## 📂 Project Architecture

```text
pulsewatch/
├── server/                    # Backend API & Analysis Engines
│   ├── config/                # Environment & constants
│   ├── routes/                # Express REST API routes
│   ├── services/              # Change detection, correlation, clustering, briefings
│   └── index.ts               # Server entry point & Vite middleware
├── src/                       # Frontend React 19 Application
│   ├── components/            # UI components (Watchlist, Sidebar Drawer, Modals)
│   ├── types/                 # TypeScript interfaces and contracts
│   ├── App.tsx                # Main App Shell & State Router
│   ├── index.css              # Neumorphic Design System & Global Styles
│   └── main.tsx               # Client entry point
├── package.json               # Dependencies & scripts
└── vite.config.ts             # Vite configuration & plugins
```

---

## 💡 Troubleshooting

- **Port 3000 Already in Use**:
  Set a custom port before running:
  ```bash
  PORT=3001 npm run dev
  ```
- **Node version mismatch**:
  Make sure you are using Node 20+:
  ```bash
  nvm use 22 # or nvm install 22
  ```
- **Clear cache**:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
