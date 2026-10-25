# CascadeGuard — Judge's Guide

## What this is (30 seconds)

CascadeGuard is an AI system that **predicts cascading software failures, identifies their root cause, and recommends the optimal recovery strategy — before the system crashes**. It runs a deterministic digital twin of a 9-service e-commerce cluster (13 dependency edges) that degrades under four realistic fault scenarios, and runs four explainable diagnostics against the live telemetry: a logistic failure predictor, a root-cause ranker, a Monte-Carlo recovery optimizer, and a live accuracy tracker. Everything runs client-side in the browser; no backend, no API keys.

## Problem-statement mapping

**Predict cascading failures.** `src/core/ai/predictor.ts` → `predictRisks()` scores every service each tick with a logistic model over telemetry (memory, saturation, error rate, CPU, p99 latency), three EWMA trend features and log-burst intensity, then propagates risk 2 hops across the dependency graph (`PROP_ITERATIONS = 2`, `PROP_GAIN = 0.3`, `LOCAL_MIX = 0.75`). Each service gets a probability, a time-to-failure estimate and the top-3 explainable drivers. The predictor never reads `ServiceMetrics.failed` — the ground-truth flag — so the number it reports is a real prediction, not a lookup.

**Identify root causes.** `src/core/ai/rootcause.ts` → `analyzeRootCauses()` finds each service's anomaly onset from its own metric history, then ranks candidate origins by `severity × temporal-precedence × path-strength`. Temporal precedence is an exponential decay on how long the candidate has been anomalous (`exp(-Δt/30_000)`); path strength comes from a DFS over the dependency graph (≤ 4 hops) maximising the product of edge weights. Output is a ranked origin plus the propagation chain and human-readable evidence.

**Recommend optimal recovery.** `src/core/ai/recovery.ts` → `projectStrategies()` runs a Monte-Carlo rollout of each of 7 recovery strategies (30 rollouts each, 144 × 5 s = 12 sim-minute horizon) against an abstract cascade model, and returns containment probability, expected cascade size, expected user-seconds of damage, MTTR and cost per strategy, plus a `recommended` / `viable` / `not-recommended` verdict. Baseline and every strategy are replayed with the **same 30 seeds** (common random numbers), so the reported lift is attributable to the action, not to sampling noise — and a strategy is only `recommended` if it actually beats doing nothing.

## Three things to click, in order

1. **Scenario selector** (top-right) → pick *Connection Pool Exhaustion*. Watch the **Cluster Topology**: Orders DB creeps from healthy to degraded (amber) as its pool drains, well before it goes red.
2. **Orders DB node in the topology** — a violet dashed risk ring and a `risk NN%` pill appear on the node *while it is still amber*, i.e. before failure. Right column: **Failure Predictions** shows the risk %, a `~NNs to failure` countdown, the driver chips, and a rising sparkline. **Prediction Ledger** records the warning; **Model Accuracy** scores it.
3. **Recovery Strategy Optimizer** → click **APPLY ▸** on the recommended strategy. The strategy executes inside the engine; **Applied actions** then resolves to `CONTAINED` / `PARTIAL` / `INEFFECTIVE` and the cluster recovers on screen.

## Key engineering claims and where they are proven

| Claim | File |
|---|---|
| Predictor never reads ground truth | `src/core/ai/predictor.ts` (`predictRisks`, Pass 1 comment) |
| Root-cause ranker never reads ground truth | `src/core/ai/rootcause.ts` (`analyzeRootCauses`) |
| Accuracy tracker is the only module that *scores* against ground truth | `src/core/ai/accuracy.ts` (`trackAccuracy`) |
| Deterministic seeded simulation | `src/core/engine/logs.ts` (`mulberry32`), `src/core/engine/sim.ts` (`createEngine`) |
| AI decoupled from engine by injection | `src/core/types.ts` (`Diagnostics`, `DiagnosticsInput`), wired in `src/core/store.ts` |
| Auditable proof trail | `src/core/engine/sim.ts` (`updateLedger`), `src/core/types.ts` (`PredictionLedgerEntry`) |
| Monte-Carlo optimizer | `src/core/ai/recovery.ts` (`projectStrategies`, `ROLLOUTS = 30`) |
| Business impact / SLO burn | `src/core/engine/sim.ts` (`computeImpact`) |
| Exportable incident report | `src/core/report.ts` (`buildIncidentReport`, `downloadIncidentReport`) |
| Sponsor data-quality pipeline | `src/adaption/use-adaption.ts` (`cleanTelemetry`) |

## Evaluation and verification

The simulation knows which service actually failed and when, so every prediction is scored automatically against ground truth — no hand-waving. `src/core/ai/accuracy.ts` defines hit / miss / false-alarm and average lead time. Two harnesses run the **real** engine and AI modules headless: `src/core/smoke.ts` (9 assertions, all passing) and `src/core/eval/evaluation.ts` via `scripts/evaluate.ts`, which replays all 4 scenarios at seed 42 and writes `docs/evaluation-report.json`. Measured on that report: **avg lead time 75 s, origin accuracy 75 %, avg precision 75 %, avg recall 100 %, 6 hits / 0 missed**. The **Measured Benchmarks** panel in the app renders that same JSON, so the dashboard cannot drift from the report.

## Disclosure

- **AI-assisted development.** Built with an AI coding agent (DeepSeek) accelerating implementation of well-specified modules. Architecture, contracts, integration, verification and deployment by the author.
- **Pre-built code:** none. No pre-existing project, template or starter was used as a base. Everything in `src/` was authored for Orcathon 2026.
