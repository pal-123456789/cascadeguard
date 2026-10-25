# 🛡️ CascadeGuard

> **See the outage before it happens.** CascadeGuard is an AI system that predicts cascading software failures, identifies their root causes, and recommends the optimal recovery strategy — before the entire system crashes.
>
> Built for **ORCATHON 2026** (Dev Harbour) · Track: Software & AI · Solo: Jay Ghevariya

## 🎯 The Problem

Modern systems don't fail loudly — they fail *sideways*. One saturated connection pool or one leaked heap quietly spreads through dependency chains as retries, pile-ups and timeouts, until a "database hiccup" becomes a full outage. On-call engineers see the symptoms (alerts on 6 services) long before they see the cause.

## 💡 The Solution

CascadeGuard runs a **digital twin of a production e-commerce cluster** (9 services, 13 dependency edges) that degrades under realistic fault scenarios — pool exhaustion, memory leaks, traffic surges, retry storms. Against that live telemetry, a **hybrid AI engine**:

| Module | What it does |
|---|---|
| **Failure Predictor** | Logistic feature-scorer + 2-hop dependency-graph risk propagation → per-service failure probability, time-to-failure estimate, and explainable risk drivers |
| **Root Cause Analyzer** | Ranks the *origin* of an unfolding incident by combining anomaly onset time, severity and reverse-dependency path strength — with evidence from logs |
| **Recovery Optimizer** | Monte-Carlo simulates 7 recovery strategies (restart, failover, shed-load, scale-up, throttle, circuit-breaker, cache-bypass) × 30 rollouts each and recommends the optimal one — quantified |
| **Accuracy Tracker** | Every prediction is scored *live* against simulation ground truth: precision, recall and average warning lead-time |

…and renders it all in a **mission-control dashboard**: animated service topology, streaming logs, prediction cards, incident timeline, and one-click strategy application that visibly contains the cascade.

## 📊 The Killer Metric

The simulation knows which services *actually* fail and when. So every prediction CascadeGuard makes is automatically verified — the dashboard shows **measured precision/recall and how many seconds of warning the model bought** before each failure. No hand-waving AI claims.

## 🏗️ Architecture

```
┌──────────────────────────  Browser (fully client-side)  ─────────────────────────┐
│                                                                                  │
│  Digital Twin Engine            AI Diagnostics (DI-injected)        UI           │
│  ┌──────────────────┐          ┌──────────────────────┐          ┌────────────┐  │
│  │ cluster physics  │ telemetry│ Failure Predictor    │ risks    │ Topology   │  │
│  │ fault scenarios  ├─────────►│ Root Cause Analyzer  ├─────────►│ Log Stream │  │
│  │ log generator    │  600ms   │ Recovery Optimizer   │  ticks   │ Risk/RCA   │  │
│  │ incidents/alerts │          │ Accuracy Tracker     │          │ Recovery   │  │
│  └──────────────────┘          └──────────────────────┘          └────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Engine** (`src/core/engine/`) — deterministic seeded simulation: queueing-style latency curves, retry amplification, pile-up saturation, incident lifecycle.
- **AI** (`src/core/ai/`) — explainable, dependency-injected diagnostics; no black boxes, every score shows its drivers.
- **Store** (`src/core/store.ts`) — engine singleton + `useSyncExternalStore` React binding; 600ms ticks.

## 🎬 Demo Scenarios

| Scenario | Cascade story |
|---|---|
| `pool-exhaustion` | Orders-DB connection-pool leak → retry storm → gateway timeouts → order path collapse |
| `memory-leak` | Payments-API heap creep → GC thrash → pool pile-up → Kafka backpressure |
| `traffic-surge` | 3× traffic spike → gateway saturation → cache stampede → DB overload |
| `retry-storm` | Payments-DB blip ×4 retry amplification → self-sustaining cascade |

## 🚀 Run Locally

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # production build
```

No backend. No API keys. The entire system — simulation, AI, dashboard — runs in the browser.

## 🧰 Tools Used

TypeScript · React 19 · Vite · Tailwind CSS v4 · custom SVG visualisation · pnpm · Vercel · AI-assisted development (disclosed below).

## 📜 Pre-Built Disclosure

Authored for Orcathon 2026 within the hackathon window. No pre-existing project or template was used as a base. AI tools (DeepSeek coding agent) were used to accelerate implementation of well-specified modules (simulation engine, diagnostics, dashboard components); architecture, contracts, integration, verification and deployment by the author.

---

*Jay Ghevariya — [GitHub: pal-123456789](https://github.com/pal-123456789) · Orcathon 2026 by Dev Harbour*
