# CascadeGuard — Judge's Guide

## What this is (30 seconds)

CascadeGuard **predicts cascading software failures, identifies their root cause, and recommends the optimal recovery strategy — before the system crashes**. It runs a deterministic digital twin of a 9-service e-commerce cluster (13 dependency edges) under four fault scenarios, and scores live telemetry with four explainable diagnostics: a logistic failure predictor, a root-cause ranker, a Monte-Carlo recovery optimizer, an accuracy tracker. Client-side only: no backend, no API keys.

## Problem-statement mapping

**Predict cascading failures.** `src/core/ai/predictor.ts` → `predictRisks()` scores every service each tick with a logistic model over telemetry (memory, saturation, error rate, CPU, p99 latency), three EWMA trend features and log-burst intensity, then propagates risk 2 hops across the dependency graph (`PROP_ITERATIONS = 2`, `PROP_GAIN = 0.3`, `LOCAL_MIX = 0.75`). Each service gets a probability, a time-to-failure estimate and its top-3 drivers. It never reads `ServiceMetrics.failed`, so the number is a real prediction, not a lookup.

**Identify root causes.** `src/core/ai/rootcause.ts` → `analyzeRootCauses()` finds each service's anomaly onset in its own metric history, then ranks origins by `severity × temporal precedence × path strength`. Precedence decays exponentially with how long the candidate has been anomalous (`exp(-Δt/30_000)`); path strength comes from a ≤4-hop DFS maximising the product of edge weights.

**Recommend optimal recovery.** `src/core/ai/recovery.ts` → `projectStrategies()` Monte-Carlo-replays 7 strategies (30 rollouts each, 144 × 5 s horizon) against an abstract cascade model, returning containment probability, expected cascade size, user-seconds of damage, MTTR, cost and a verdict. Baseline and every strategy share the same 30 seeds, so lift is attributable to the action — and a strategy is `recommended` only if it beats doing nothing.

## Three things to click, in order

1. **Scenario selector** → *Connection Pool Exhaustion*. In the **Cluster Topology**, Orders DB creeps amber as its pool drains, well before it turns red.
2. **Orders DB node** — a violet risk ring and `risk NN%` pill appear while it is still amber, before failure. **Failure Predictions** shows the risk %, a `~NNs to failure` countdown and driver chips; **Prediction Ledger** records the warning.
3. **Recovery Strategy Optimizer** → **APPLY ▸** on the recommended strategy. It executes inside the engine; **Applied actions** resolves to `CONTAINED`/`PARTIAL`/`INEFFECTIVE` and the cluster recovers on screen.

## Key claims and where they are proven

| Claim | File (`src/`) |
|---|---|
| Predictor and root-cause ranker never read ground truth | `core/ai/predictor.ts`, `rootcause.ts` |
| Only the tracker scores against ground truth | `core/ai/accuracy.ts` |
| Deterministic seeded simulation | `core/engine/sim.ts` |
| AI decoupled by dependency injection | `core/types.ts`, `core/store.ts` |
| Proof trail, SLO burn, incident report | `core/engine/sim.ts`, `core/report.ts` |
| Monte-Carlo optimizer, sponsor data pipeline | `core/ai/recovery.ts`, `adaption/use-adaption.ts` |

## Evaluation and verification

The simulation knows which service actually failed and when, so every prediction is scored automatically. Two harnesses run the **real** engine and AI headless: `src/core/smoke.ts` (9 assertions, all passing) and `src/core/eval/evaluation.ts` via `scripts/evaluate.ts`, replaying all 4 scenarios at seed 42 into `docs/evaluation-report.json`. That report measures **avg lead time 75 s, origin accuracy 75 %, avg precision 75 %, avg recall 100 %, 6 hits / 0 missed**. The **Measured Benchmarks** panel renders that same JSON, so the dashboard cannot drift from the report.

## Disclosure

- **AI-assisted development.** An AI coding agent (DeepSeek) accelerated implementation of well-specified modules; architecture, contracts, integration, verification and deployment are the author's.
- **Pre-built code:** none. No pre-existing project or template was used as a base; all of `src/` was authored for Orcathon 2026.