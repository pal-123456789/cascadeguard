# Algorithms — CascadeGuard

Every claim in this document is traceable to a specific file and line number. The system uses a mix of deterministic simulation, statistical modelling and graph algorithms — not a black-box LLM.

---

## 1. Digital-twin engine (`src/core/engine/sim.ts`)

### Seeded deterministic simulation
The engine is seeded with a `mulberry32` PRNG (`rng(seed)`). Every service transition — failure, recovery, retry pressure, backpressure — is derived from a deterministic sequence of random draws, not hard-coded timelines. This means:
- The same seed produces the exact same cascade.
- The AI never sees future state; it only sees telemetry produced by the previous ticks.

### Tick model
`TICK_REAL_MS = 600`, `SIM_MS_PER_STEP = 3000`. A 2× playback speed runs 3000 ms of simulation per 600 ms of wall time; a headless 20× speed runs 3000 ms per 30 ms. Telemetry (`svc.history`) is published **every simulation step**, not once per UI frame — the EWMA trend features (`W_SLOPE_MEM`, `W_SLOPE_SAT`) are therefore speed-invariant.

### Demand-flow model (`runRollout` in `recovery.ts`)
- Demand flows topologically: gateway → APIs → DBs/cache.
- A saturated callee (`util > 0.85`) spills queue pressure back onto its callers (`dem[fi] += processed[fi] × weight × spill`).
- A failed callee (`failed = true`) attracts retry amplification (`dem[fi] += processed[fi] × weight × retry`).
- A broken dependency (circuit-breaker) severs that back-pressure channel.

---

## 2. Risk predictor (`src/core/ai/predictor.ts`)

### Logistic model
`p(fail) = 1 / (1 + exp(-(score - BIAS)))` where `BIAS = -3.7`.

### Feature set
The score combines 11 weighted signals:
- `W_MEM = 2.0` (memory utilization)
- `W_SAT = 2.4` (pool/queue saturation)
- `W_ERR = 0.8` (error rate)
- `W_CPU = 0.5` (CPU)
- `W_LAT = 0.45` (p99 latency)
- `W_LOG = 0.9` (log-burst intensity: log of ERROR+WARN counts in the last 60 s)
- `W_SLOPE_MEM = 14.0` (EWMA slope of memory, time-based window of 120 s / 40 samples)
- `W_SLOPE_SAT = 10.0` (EWMA slope of saturation)
- `W_SLOPE_ERR = 1.4` (EWMA slope of error rate)
- `PROP_GAIN = 0.3` (2-hop graph propagation factor)
- `LOCAL_MIX = 0.75`, `SMOOTH_OWN = 0.65` (propagation blending)
- `KIND_FACTOR`: database 1.2, queue 1.15, gateway 0.95, API 0.8 (kind-sensitive risk scaling)

### Trend computation (speed-invariant)
Instead of sampling once per UI tick, the predictor uses a **time-based window** (`TREND_WINDOW_MS = 120_000`) over the full-resolution `svc.history`. The slope features (`W_SLOPE_*`) compute the linear regression of the last 40 samples within that 120-second window, regardless of whether the app runs at 1×, 2×, 4× or 20× speed.

### Propagation model
Risk propagates 2 hops (`PROP_ITERATIONS = 2`) along the dependency graph. The propagated risk at node `v` is: `prop = LOCAL_MIX × own_risk + (1 - LOCAL_MIX) × Σ(edge_weight × neighbor_risk × KIND_FACTOR)`. The `PROP_GAIN = 0.3` dampens long-range propagation to prevent the entire cluster from appearing critical at the slightest upstream disturbance.

---

## 3. Root-cause analysis (`src/core/ai/rootcause.ts`)

### Onset detection (percentile baseline)
The healthy baseline for each metric is the **10th percentile of the rolling history** (`baseline()`), not the mean of the oldest third — this prevents the baseline from sliding past the healthy period once the window fills with degraded samples. After the lifetime-observed-healthy-baseline (`svc.baseline`) was added to the engine, the RCA uses `svc.baseline` directly; the rolling percentile remains a robust fallback.

### Scoring formula (self-inflicted vs dependency-explained)
`originBias = 0.35 × severity + 0.65 × selfSignal`, where:
- `selfSignal = clamp((recent.saturation - baseSat) / 0.4, 0, 1)` — how much the service degrades on its own terms.
- `selfRaw` also includes `(recent.memory - baseMem)` — a leaking service shows a rising memory baseline even before saturation spikes.
- `depShare = clamp(depError / max(0.05, recent.errorRate), 0, 1)` — how much of the error rate is explained by unhealthy dependencies (`depError = Σ(edge.weight × dependency.errorRate)`).

`score = originBias × exp(-(onset_time - earliest_onset) / 30_000) × (0.4 + 0.6 × path_strength) × (1 - 0.45 × depShare)`.

The `(1 - 0.45 × depShare)` term penalizes candidates whose distress is explained by unhealthy upstream dependencies (victims), boosting candidates that degrade independently (origins).

---

## 4. Recovery optimizer (`src/core/ai/recovery.ts`)

### Abstract flow model
The rollout simulates the same dependency-flow logic as the live engine (`processService`) but in a compressed 144-step (12-minute) horizon at 5-second steps. The initial load is normalized (`dem = min(live_rps, 0.9 × cap)`) so the cascade is reproducible from a fair start, not instantly doomed by inherited pile-up.

### Paired common-random-number rollouts
Both the no-action baseline and every strategy share identical seed sequences (`seeds = Array(30, seed = tick*131 + i*17)`). The lift (`success - baseSuccess`) is therefore attributable to the action, not sampling noise — standard variance-reduction practice from simulation science.

### Strategy effects
Each strategy modifies the abstract state at `t0`:
- `restart`: clears `util` and `failed` state, heals after 3 steps.
- `failover`: multiplies capacity by 1.8, clears `failed`.
- `scale-up`: multiplies capacity by 1.5.
- `shed-load`: reduces gateway demand by 40% (`dem *= 0.6`).
- `throttle`: reduces gateway demand by 25% (`dem *= 0.75`).
- `circuit-breaker`: severs the heaviest dependency edge into the origin.
- `cache-bypass`: routes cache traffic onto the DB (increases DB demand by 25%, stops the cache's spillover).

### Verdict rules
`recommended`: `success ≥ 0.5` AND `lift > 0` AND `rank > 0`.
`viable`: `success ≥ 0.4` AND `lift ≥ 0`.
`not-recommended`: everything else.
The ranking uses `(recommended? 2 : viable? 1 : 0) × 1000 + success × 100 - cost` — ensuring the highest-scoring recommended strategy is shown first.

---

## 5. Prediction ledger and accuracy (`src/core/ai/accuracy.ts`)

### Per-service tracker
Each tracker records `predictedAt`, `resolved` (`hit` / `false-alarm` / `missed`), `leadMs`, and `failedAt`. The resolution rules:
- **Hit**: failure occurs within `RISK_HORIZON_MS = 300_000` (5 min) of the prediction.
- **False-alarm**: the horizon expires with no failure.
- **Missed**: failure occurs without any open prediction from this service within the horizon.
- The tracker **re-arms** on service recovery (`failed` → `healthy`) — a previously confirmed service can be predicted again in a new incident.

### Module-level accuracy
`snap.accuracy` aggregates: total predictions, hits, false-alarms, missed, precision (`hits / (hits + false_alarms)`), recall (`hits / (hits + missed)`), and average lead time (`avgLeadTimeMs`). Only the accuracy module reads `metrics.failed` — enforcing the separation between prediction (telemetry-only) and verification (ground-truth-aware).

---

## 6. Business-impact SLO computation (`src/core/engine/computeImpact`)

`computeImpact()` converts technical telemetry into business metrics:
- `userImpactPct`: percentage of the user-facing service set that is unhealthy.
- `sloBurnRate`: `(current_slo_consumption / threshold_slo_consumption)`, expressed as a multiplier (e.g., 11.37×).
- `revenueAtRiskPerMin`: `Σ(criticality × unhealthy_services × $12_000/min)`.
- `severity`: `nominal` (≤2 critical services), `elevated` (3–4), `critical` (≥5) — based on the number of unhealthy services in the incident's service set.

---

## 7. Verification harness (`src/core/smoke.ts`, `scripts/evaluate.ts`)

- `smoke.ts`: 9 assertions (logs, incident detection, predictor risk, prediction lead time, root-cause hypotheses, recovery recommendation, accuracy resolution, prediction ledger, business impact) — all PASS.
- `evaluate.ts`: 4 scenarios × 12 sim-min at speed 20, seed 42 — generates `docs/evaluation-report.json` and `public/evaluation-report.json` (byte-identical). The harness uses the engine's own `snap.accuracy` delta (not internal tracker probes) and calls `resetAccuracyTracker()` at each scenario start — preventing stale state contamination.
