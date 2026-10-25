# CascadeGuard — Technical Architecture

## 1. Module map

```
src/
├─ core/
│  ├─ types.ts            Shared contracts + SIM tuning constants (frozen vocabulary)
│  ├─ store.ts            Engine singleton + React binding (useSyncExternalStore)
│  ├─ report.ts           Incident-report generator / Markdown download
│  ├─ smoke.ts            Headless end-to-end smoke harness (9 assertions)
│  ├─ engine/
│  │  ├─ sim.ts           createEngine() — the digital twin; SimulationEngine impl
│  │  ├─ scenarios.ts     SCENARIOS, SCENARIO_IDS, DEFAULT_SCENARIO
│  │  └─ logs.ts          mulberry32 PRNG + generateLogs() template engine
│  ├─ ai/
│  │  ├─ predictor.ts     predictRisks()      — logistic risk model
│  │  ├─ rootcause.ts     analyzeRootCauses() — origin ranking
│  │  ├─ recovery.ts      projectStrategies() — Monte-Carlo optimizer
│  │  └─ accuracy.ts      trackAccuracy()     — live scoring vs ground truth
│  └─ eval/
│     └─ evaluation.ts    runEvaluation() — headless cross-scenario measurement
├─ components/            Topology, LogStream, IncidentPanel, ImpactPanel,
│                          AccuracyPanel, RiskPanel, PredictionLedger,
│                          RootCausePanel, RecoveryPanel, ServiceDetail,
│                          BenchmarksPanel, Sparkline
├─ data/
│  └─ topology.ts         SEED_TOPOLOGY — 9 nodes, 13 edges
└─ adaption/
   └─ use-adaption.ts     cleanTelemetry() — sponsor data-quality pipeline
```

## 2. Architecture diagram

```
                        ┌──────────────────── BROWSER (fully client-side) ─────────────────────┐
                        │                                                                          │
  ┌──────────────────┐  │  ┌─────────────────── src/core/engine/sim.ts ───────────────────┐   │  ┌──────────────┐
  │ SEED_TOPOLOGY    │──┼─▶│ createEngine(topology, diagnostics)                       │   │  │ src/components│
  │ data/topology.ts │  │  │                                                          │   │  │  (React 19)   │
  │ 9 nodes/13 edges │  │  │  step()  ──▶ applyFaults()      (4 fault scenarios)        │   │  │              │
  └──────────────────┘  │  │           ──▶ processService()  (queueing, retries, leak)  │   │  │  Topology    │
                        │  │           ──▶ updateStatus()     (healthy→failed)         │   │  │  LogStream   │
  ┌──────────────────┐  │  │           ──▶ updateIncidents()  (SEV-1/SEV-2 lifecycle)  │   │  │  RiskPanel   │
  │ SCENARIOS         │──┼─▶│           ──▶ runDiagnostics()   ◀── the DI seam         │   │  │  RootCause   │
  │ engine/scenarios  │  │  │           ──▶ generateLogs()     (templates per kind)   │   │  │  Recovery    │
  └──────────────────┘  │  └────────────────────────┬─────────────────────────────┘   │  │  Accuracy    │
                        │                           │ snapshot()                     │   │  │  Ledger      │
                        │                           ▼                                 │   │  │  Impact      │
                        │              ┌──────────────────────┐                      │   │  └──────┬───────┘
                        │              │ SimulationSnapshot  │                      │   │         │ useSimulation()
                        │              │ (types.ts)           │                      │   │         ▼
                        │              └──────────┬───────────┘                      │   │   ┌──────────────┐
                        │                         │                                  │   │   │ core/store.ts│
                        │                         │ listeners.forEach(snap)         │   │   └──────────────┘
                        │                         ▼                                  │   │
                        │              ┌──────────────────────┐                      │   │
                        │              │  src/core/store.ts   │  useSyncExternalStore │   │
                        │              └──────────┬───────────┘                      │   │
                        │                         │                                  │   │
                        │                         ▼                                  │   │
                        │              ┌────────────────────────────────────────┐     │   │
                        │              │   React panels re-render every tick    │─────┼──▶
                        │              └────────────────────────────────────────┘     │   │
                        │                                                          │   │
                        │  ┌────────────────────────────────────────────────────┐   │   │
                        │  │  DI SEAM — Diagnostics injected at createEngine()  │   │   │
                        │  │  src/core/types.ts                                │   │   │
                        │  │    interface Diagnostics {                        │   │   │
                        │  │      predict:   PredictFn                         │   │   │
                        │  │      rootCause: RootCauseFn                       │   │   │
                        │  │      recovery:  RecoveryFn                        │   │   │
                        │  │      accuracy:  AccuracyFn                        │   │   │
                        │  │    }                                              │   │   │
                        │  │  interface DiagnosticsInput {                     │   │   │
                        │  │    tick, simTime, topology, services, logs,       │   │   │
                        │  │    incidents                                     │   │   │
                        │  │  }                                              │   │   │
                        │  └────────────────────────────────────────────────────┘   │   │
                        │                                                          │   │
                        │  ┌──────────────────── src/core/ai/ ─────────────────────┐  │   │
                        │  │  predictRisks()   rootcause.ts  projectStrategies()  │  │   │
                        │  │  predictor.ts     analyzeRoot   recovery.ts          │  │   │
                        │  │                  Causes()     STRATEGY_CATALOG      │  │   │
                        │  │  trackAccuracy()  accuracy.ts                        │  │   │
                        │  │  ← scores against metrics.failed (the only module  │  │   │
                        │  │    that does; predictor/rootcause never read it)   │  │   │
                        │  └─────────────────────────────────────────────────────┘  │   │
                        │                                                          │   │
                        │  ┌──────────────────── src/core/eval/ ────────────────────┐  │   │
                        │  │  runEvaluation() — replays all 4 scenarios, seed 42   │  │   │
                        │  │  → docs/evaluation-report.json → BenchmarksPanel     │  │   │
                        │  └─────────────────────────────────────────────────────┘  │   │
                        └──────────────────────────────────────────────────────────┘
```

## 3. Data flow: engine tick → telemetry → diagnostics → snapshot → React

One engine tick is driven by `setInterval(tickOnce, SIM.TICK_REAL_MS)` (600 ms real). Inside `tickOnce()` in `src/core/engine/sim.ts`:

1. **`step()`** runs `SIM.SIM_MS_PER_STEP` (3000) sim-ms per step, `s.speed` times per tick. It calls `applyFaults()`, then computes demand flow gateway → APIs → datastores/infra, then `processService()` for each service. `processService()` is the telemetry producer: it derives `latencyP50`, `latencyP99`, `errorRate`, `cpu`, `memory`, `saturation` and pushes one `ServiceMetrics` sample into `svc.history` on **every simulation step** (capped at `SIM.HISTORY_WINDOW = 120`).
2. **`updateStatus()`** maps metrics to a `ServiceStatus` (`healthy | degraded | critical | failed | recovering`) and emits `Alert`s on transitions.
3. **`updateIncidents()`** opens an `Incident` when any service fails or exceeds 0.5 error rate, sets `origin` to the earliest failure, and grows `incident.services` as the cascade spreads. It resolves when every member has been healthy for 10 consecutive steps.
4. **`runDiagnostics()`** appends the current metrics to each service's history, builds a `DiagnosticsInput` via `buildInput()` and calls the four injected functions in order: `diagnostics.predict(input, s.risks)` → `diagnostics.rootCause(input)` → `diagnostics.recovery(input)` (only when an incident is active) → `diagnostics.accuracy(input, s.risks)`. The whole block is inside a `try/catch`: a throwing AI module surfaces as an alert, it never crashes the simulation.
5. **`updateLedger(risks)`** records each new prediction as a `PredictionLedgerEntry` with outcome `pending`, then resolves it to `confirmed` (recording `failedAt` and `leadTimeMs`) or `false-alarm` when `SIM.RISK_HORIZON_MS` elapses.
6. **`computeImpact()`** derives `SloImpact` (user impact %, SLO burn rate, revenue at risk per minute, affected services) from current metrics and `ServiceNode.criticality`.
7. **`generateLogs()`** (from `src/core/engine/logs.ts`) emits level-appropriate log events for the last step's state, with stable machine codes such as `ERR_DB_POOL_EXHAUSTED`.
8. **`snapshot()`** assembles the `SimulationSnapshot` (services, logs, incidents, risks, root causes, projections, applied strategies, accuracy, alerts, ledger, impact) and pushes it to every listener.

In the browser, `src/core/store.ts` subscribes once to the engine, caches the latest snapshot and re-broadcasts it; `useSimulation()` wraps that in `useSyncExternalStore`, so every React panel re-renders from the same immutable snapshot. In headless harnesses the same `subscribe`/`snapshot` API is used to sample the world — `src/core/smoke.ts` and `src/core/eval/evaluation.ts` drive the identical code path.

## 4. The `SimulationEngine` contract

`src/core/types.ts`:

```ts
export interface SimulationEngine {
  start(): void
  pause(): void
  resume(): void
  isRunning(): boolean
  setSpeed(mult: number): void          // 1 = one 3s sim-step per 600ms tick; 2/4 faster
  loadScenario(id: string, seed?: number): void
  applyStrategy(strategyId: string): void
  snapshot(): SimulationSnapshot
  subscribe(cb: (s: SimulationSnapshot) => void): () => void   // returns unsubscribe
}
```

`createEngine(topology: ServiceTopology, diagnostics: Diagnostics): SimulationEngine` in `src/core/engine/sim.ts` is the only implementation. It keeps all mutable state in a single `EngineState` object `s` (tick, simTime, running, speed, scenarioId, `rng`, `services: Map`, logs, incidents, alerts, risks, rootCauses, projections, appliedStrategies, accuracy, ledger), and closes over it in nested functions. `loadScenario(id, seed = 42)` calls `reset()`, which rebuilds `s` and re-seeds `mulberry32(seed)` — so a given (scenario, seed) pair is fully reproducible.

## 5. Dependency injection: decoupling the engine from the AI modules

The engine has **no import of any AI module**. `src/core/engine/sim.ts` imports only `SIM` and types from `../types`, plus `generateLogs`/`mulberry32` from `./logs` and `DEFAULT_SCENARIO` from `./scenarios`. It receives the AI layer as a plain object typed `Diagnostics`:

```ts
export interface Diagnostics {
  predict:   PredictFn     // (input, prevRisks) => Record<ServiceId, RiskAssessment>
  rootCause: RootCauseFn   // (input) => RootCauseHypothesis[]
  recovery:  RecoveryFn    // (input) => StrategyProjection[]
  accuracy:  AccuracyFn    // (input, risks) => AccuracyStats
}
```

The binding happens in exactly one place, `src/core/store.ts`:

```ts
const engine = createEngine(SEED_TOPOLOGY, {
  predict:   predictRisks,
  rootCause: analyzeRootCauses,
  recovery:  projectStrategies,
  accuracy:  trackAccuracy,
})
```

and again, identically, in the two headless harnesses (`src/core/smoke.ts`, `src/core/eval/evaluation.ts`).

Why it matters:

- The AI modules are **pure functions of `DiagnosticsInput`** (plus, for the predictor, the previous tick's risk map). They hold no reference to the engine and cannot mutate simulation state.
- A module can be swapped by changing one line in the wiring, not by editing the engine. The harnesses use exactly the same wiring as the app, so a test proves the shipped code path.
- The contract also carries the **ground-truth firewall**: `ServiceMetrics.failed` exists on the data the AI receives, and `src/core/types.ts` documents that AI modules must not use it. The two *predictive* modules — `predictor.ts` and `rootcause.ts` — never read it, so the risk score and the origin ranking are genuine inferences from telemetry. `accuracy.ts` is the only module that *scores* against it, and does so solely to evaluate predictions. `recovery.ts` also reads it, but only to seed the *initial state* of its abstract simulation (which services are already down); it never uses it to score or justify a recommendation. The separation between inference and scoring is therefore a design property, not a convention.
- `diagnostics.recovery(input)` is only invoked when an incident is active, and `predict` is passed `s.risks` so it can smooth against the previous tick.

## 6. Data structures

| Type | Where | Purpose |
|---|---|---|
| `ServiceTopology` | `types.ts` | `{ nodes: ServiceNode[]; edges: DependencyEdge[] }` — the static dependency graph |
| `ServiceNode` | `types.ts` | `id, name, kind, capacity, criticality, replicas, layout{x,y}` |
| `DependencyEdge` | `types.ts` | `{ from, to, weight, critical }` — `weight` is the fraction of caller traffic hitting the callee |
| `ServiceMetrics` | `types.ts` | One telemetry sample: `rps, latencyP50, latencyP99, errorRate, cpu, memory, saturation, healthy, failed` |
| `ServiceState` | `types.ts` | `ServiceNode` + `status` + current `metrics` + rolling `history: ServiceMetrics[]` |
| `LogEvent` | `types.ts` | `{ id, ts, service, level, message, code?, traceId?, latencyMs? }` |
| `RiskAssessment` | `types.ts` | `{ service, ts, risk, predicted, drivers: RiskDriver[], ttfMs? }` |
| `RiskDriver` | `types.ts` | `{ label, contribution }` — contribution is the driver's share of the linear score |
| `RootCauseHypothesis` | `types.ts` | `{ service, confidence, chain: ServiceId[], evidence: string[] }` |
| `StrategyProjection` | `types.ts` | `{ strategyId, successProbability, expectedCascadeSize, expectedDamage, mttrMs, cost, verdict, rationale }` |
| `Incident` | `types.ts` | `{ id, startedAt, resolvedAt?, origin?, services, severity, title }` |
| `PredictionLedgerEntry` | `types.ts` | `{ id, service, madeAt, risk, ttfMs?, outcome: 'confirmed'\|'false-alarm'\|'pending', failedAt?, leadTimeMs? }` |
| `SloImpact` | `types.ts` | `{ userImpactPct, sloBurnRate, revenueAtRiskPerMin, affectedServices, severity }` |
| `AccuracyStats` | `types.ts` | `{ predictions, hits, falseAlarms, missed, avgLeadTimeMs, precision, recall }` |
| `SimulationSnapshot` | `types.ts` | The full UI contract for one tick |
| `SIM` | `types.ts` | Shared tuning constants (see below) |

`SIM` is the single source of truth for cross-module timing:

```ts
export const SIM = {
  TICK_REAL_MS: 600,      // real ms per engine tick
  SIM_MS_PER_STEP: 3000,  // sim ms advanced per step
  RISK_HORIZON_MS: 300_000,
  RISK_THRESHOLD: 0.55,
  LOG_WINDOW: 500,        // max log events kept
  HISTORY_WINDOW: 120,    // metrics samples per service kept
} as const
```

## 7. The four fault scenarios

`src/core/engine/scenarios.ts` declares the metadata; `applyFaults()` in `src/core/engine/sim.ts` implements the dynamics. All four are deterministic given the seed.

| Scenario | Fault starts | Dynamics | Blast radius |
|---|---|---|---|
| `pool-exhaustion` | 45 000 ms | `orders-db` effective pool shrinks linearly to 25 % over 300 000 ms (`capacityMult = 1 − 0.75·decay`); `leakRate = 0.02` makes saturation creep independent of load. Failure cause `leak`. | Orders API and Inventory API both depend on Orders DB (`weight` 1.0 and 0.8) and inherit its saturation and error rate. |
| `memory-leak` | 30 000 ms | `payments-api` heap grows by `memLeakRate = 0.011` per step with no GC steady state, so memory climbs monotonically past 1.05. Failure cause `oom`. | Payments DB and Kafka, plus GC thrash: `effectiveCapacity` is multiplied by `1 − 0.6·((memory − 0.85)/0.15)` above 0.85 memory. |
| `traffic-surge` | 20 000 ms | Gateway `demandMult` ramps `1 → 3` over 120 000 ms and holds for 180 000 ms, then relaxes to 1.05. Redis capacity is cut to 0.45 (eviction stampede). | Gateway → every API → datastores; the cache is the shared chokepoint. |
| `retry-storm` | 25 000 ms | `payments-db` capacity ramps down to 30 % over 20 000 ms for a 30 000 ms blip, then heals. `retryFactorFor()` returns up to 3.0 on the `payments-api → payments-db` edge for 60 000 ms — 30 s longer than the blip itself — so the storm outlives its cause. | Backlog accumulates on Payments API; the cascade is self-sustaining. A circuit-breaker or shed-load breaks it. |

**Failure conditions** (in `processService`, `src/core/engine/sim.ts`): a service fails when `memory ≥ 1.05 && memLeakRate > 0` (a genuine leak only — overload must not fake an OOM), or when saturation has been `≥ 1.2` for 6 consecutive steps, or error rate has been `≥ 0.92` for 5 consecutive steps. Sustained stress, not a single spike, is required. `updateStatus()` auto-recovers only `overload`/`blip` causes after 45 000 ms (a restarted pod); leaks and OOMs stay down until a recovery strategy is applied.

**Retry amplification** (`retryFactorFor`): `3.0` on the storm edge, `2.5` when the callee has failed, and a ramp `2.0 · min(1, (errorRate − 0.1)/0.4)` when the callee's error rate exceeds 0.1. Amplification grows continuously rather than appearing as a step change.

**Status thresholds** (`updateStatus`): `critical` when `errorRate > 0.15 || saturation > 0.9 || cpu > 0.95 || memory > 0.95`; `degraded` when `errorRate > 0.02 || saturation > 0.7 || cpu > 0.75 || memory > 0.85`.

## 8. Extension points

**Add a 5th scenario.** Three edits, no new abstractions:
1. Append a `ScenarioDef` to `SCENARIOS` in `src/core/engine/scenarios.ts` with a unique `id`, `name`, `tagline`, `description` and `faultStartMs`. The UI dropdown in `src/App.tsx` and the evaluation harness (`src/core/eval/evaluation.ts`, which iterates `SCENARIOS`) pick it up automatically.
2. Add a `case '<new-id>':` block to `applyFaults()` in `src/core/engine/sim.ts`. The block receives the current `s.simTime` and mutates the per-service fault knobs (`capacityMult`, `demandMult`, `leakRate`, `memLeakRate`, `failureCause`). Scenarios that need a bespoke *response* (like the retry storm) additionally extend `retryFactorFor()` and `updateStatus()`.
3. Nothing else. `SCENARIO_IDS` and `DEFAULT_SCENARIO` are derived, and `loadScenario(id, seed)` resets the engine for it.

**Swap in a real telemetry source.** The engine's only coupling to the outside world is `buildInput()` in `src/core/engine/sim.ts`, which constructs a `DiagnosticsInput` from `s.services`, `s.logs` and `s.incidents`. To drive CascadeGuard from a real cluster, replace the `SimService` metric computation with a collector that fills `ServiceMetrics` from Prometheus/OTel, and keep `buildInput()` as the adapter. The AI modules need no change: they read only `DiagnosticsInput`. Two further points make this practical:
- `ServiceMetrics.failed` is the ground-truth channel. A real collector supplies it from an actual incident record, and `src/core/ai/accuracy.ts` then scores predictions against reality exactly as it does against the simulator.
- `src/adaption/use-adaption.ts` → `cleanTelemetry(payload: TelemetryRecord[])` already implements the seam for the sponsor's data-quality pipeline: it POSTs records to the Adaption `data-quality/clean` endpoint with the `data-quality → improve-dataset-quality → normalize-ranges` pipeline and returns cleaned records, falling back to the unmodified payload on any error. Wire it between the collector and `buildInput()` to have records normalised and range-checked before they reach the predictor.

**Add a new recovery strategy.** Four coordinated edits:
1. `src/core/ai/recovery.ts` → append an entry to `STRATEGY_CATALOG` with a `RecoveryKind`. If the kind is not one of the existing seven, extend the `RecoveryKind` union in `src/core/types.ts` (e.g. `'rollover'`).
2. `src/core/ai/recovery.ts` → give the kind a `COST` entry, an effect in the `runRollout()` strategy switch (how the abstract model's capacity, demand or edges change at t0), and a target-selection rule in the projection loop. The abstract model is a per-service `util` / `failed` array advanced in topological order, so a new strategy only has to perturb `caps`, `dem` or `util` at t0 to be modelled.
3. `src/core/engine/sim.ts` → add the matching case to `applyStrategy()`'s `switch (kind)`, and register the label in `STRAT_NAMES` and the number in `STRAT_COST`. The `strategyKind()` parser resolves a `strategyId` of the form `"<kind>:<target>"`, so the id format is fixed by the existing convention.
4. `src/components/RecoveryPanel.tsx` → add a `KIND_LABELS` entry so the panel renders a human label. The panel already derives label and target from the id alone, so no other UI work is needed.

The `RecoveryKind` union, the `STRATEGY_CATALOG`, the rollout model and the engine's `applyStrategy` are deliberately separate: the optimizer ranks an *abstract* model, the engine applies the *real* one, and the same strategy id links them. `evaluateStrategyOutcomes()` in `src/core/engine/sim.ts` then closes the loop 180 000 ms after application, setting the outcome to `contained` (0 new failures), `partial` (1) or `ineffective` (>1).
