# CascadeGuard — Master Deliverables Index

Created for Orcathon 2026 judges. Every item below is a readable file or live link. Nothing requires building to understand.

---

## 1. LIVE PROJECT & CODE

| Deliverable | Link / Path | Format |
|---|---|---|
| Live deployed site | https://cascadeguard-ten.vercel.app/ | Browser |
| GitHub repository | https://github.com/pal-123456789/cascadeguard | Code |
| Source code (TypeScript) | `src/` directory in repo | `.ts` / `.tsx` |

---

## 2. DOCUMENTATION (all `.md`, readable in any text editor)

| File | Purpose | Key Numbers |
|---|---|---|
| `README.md` | Project overview, killer metric, verification table, architecture diagram pointer | 120s lead (pool-exhaustion), 100% recall, 75% precision, 75s avg lead |
| `SUBMISSION.md` | Submission checklist, judging self-check, timeline, sponsor disclosure | Score estimates by criterion |
| `VIDEO_SCRIPT.md` | 90-second recording script for video explanation | Timing per section |
| `docs/JUDGE_GUIDE.md` | Quick-start guide for judges — what to click, in order | 3-step demo flow |
| `docs/ARCHITECTURE.md` | Module map, DI seam explanation, key contracts, scenario descriptions | 7 recovery strategies, 4 scenarios |
| `docs/ALGORITHMS.md` | Deep algorithm documentation — engine, predictor (logistic + 11 weights), RCA scoring, Monte-Carlo optimizer, accuracy tracker, SLO impact | File/line references for every claim |
| `video-output-commands.md` | Commands to run for the 1-minute screen-capture video | 7-step sequence |
| `audio-prompt.md` | 2-minute voice script for ElevenLabs / audio generation | 8 slide blocks |

---

## 3. VIDEO MATERIALS

| File | Size | Description |
|---|---|---|
| `CascadeGuard-Pitch-2min.pptx` | 48 KB | 8-slide premium pitch deck (title, problem, prediction, root cause, recovery, impact, benchmarks, architecture/close) |
| `audio-prompt.md` | 3 KB | Voice-over script matching PPT slides |
| `video-output-commands.md` | 2 KB | Step-by-step screen-capture instructions for final 1-minute demo |

---

## 4. BENCHMARK REPORTS (machine-generated, readable as JSON + readable `.md` preview below)

| File | Source Script | Content |
|---|---|---|
| `docs/evaluation-report.json` | `scripts/evaluate.ts` (seed 42, 12 sim-min, 4 scenarios) | Per-scenario lead time, origin accuracy, precision, recall, hits/missed, best strategy |
| `public/evaluation-report.json` | Same (byte-identical copy) | Same — deployed to public path |

Readable summary extracted from JSON:

```
SCENARIO             LEAD(s)  ORIGIN (true)         MATCH  PREC  REC   FAILED  IMPACT  BEST STRATEGY
----------------------------------------------------------------------------------------------------------------
pool-exhaustion      120s     orders-db              YES    100%  100%  1       4       failover:orders-db @1.00
memory-leak         60s      payments-api           YES    100%  100%  1       2       circuit-breaker:payments-api @1.00
traffic-surge        60s      orders-db              YES    50%   100%  3       6       restart:orders-db @0.37
retry-storm         60s      payments-db            YES    50%   100%  1       3       circuit-breaker:payments-db @1.00

AGGREGATE: avg lead 75s | origin accuracy 100% | avg precision 75% | avg recall 100% | hits 6 | missed 0
```

---

## 5. SOURCE FEATURES — EVERY FILE REFERENCED

| Feature Module | File | Lines of Code (approx) | What it does |
|---|---|---|---|
| Digital twin engine | `src/core/engine/sim.ts` | ~800 | Deterministic PRNG simulation, telemetry publication, baseline tracking |
| Types / contracts | `src/core/types.ts` | ~340 | Frozen contracts — never edited after freeze |
| Prediction AI | `src/core/ai/predictor.ts` | ~220 | Logistic risk model, 11 weights, graph propagation |
| Root cause analysis | `src/core/ai/rootcause.ts` | ~185 | Self-inflicted vs dependency-explained scoring, onset detection |
| Recovery optimizer | `src/core/ai/recovery.ts` | ~298 | Monte-Carlo rollouts, paired seeds, abstract flow model |
| Accuracy tracker | `src/core/ai/accuracy.ts` | ~140 | Per-service prediction resolution, module-level metrics |
| Report generator | `src/core/report.ts` | ~110 | Markdown incident report with ledger, RCA, strategies, telemetry |
| Smoke harness | `src/core/smoke.ts` | ~220 | 9 assertions — ALL PASS |
| Headless evaluation | `scripts/evaluate.ts` | ~180 | 4 scenarios, writes JSON reports |
| Evaluation harness (agent-owned) | `src/core/eval/evaluation.ts` | ~150 | Agent-owned — separate from core |
| Prediction Ledger component | `src/components/PredictionLedger.tsx` | ~60 | Audit trail of predictions with outcomes |
| Impact / SLO panel | `src/components/ImpactPanel.tsx` | ~80 | Business-language metrics from telemetry |
| Service deep-dive drawer | `src/components/ServiceDetail.tsx` | ~150 | Slide-over: metrics, drivers, trends, dependency graph, actions |
| Benchmarks panel | `src/components/BenchmarksPanel.tsx` | ~90 | Fetches and renders evaluation JSON |
| Explainable AI panel | `src/components/ExplainablePanel.tsx` | ~130 | Feature weight breakdown, metric comparison, formula display |
| Dashboard shell | `src/App.tsx` | ~377 | Main UI, keyboard shortcuts, guided overlays |

---

## 6. SPONSOR INTEGRATION — ADAPTION (`Best Use of Adaption` $100)

| Evidence | File |
|---|---|
| Integration code (data-quality pipeline call) | `src/adaption/use-adaption.ts` |
| Dataset generation / improvement script | `scripts/adaption-dataset.ts` |
| Cleaned telemetry artefact (simulated live flow) | `public/telemetry-clean.json` |
| Graceful fallback (works without API) | Documented in `README.md` |
| API key | Redacted in all tracked files (`[REDACTED-ROTATED]`); user must rotate in provider dashboard |

---

## 7. DEPLOYMENT & BUILD VERIFICATION

| Check | Command / Evidence | Result |
|---|---|---|
| Type check | `pnpm typecheck` (`tsc --noEmit`) | CLEAN |
| Production build | `pnpm build` | 519ms · clean |
| Smoke suite | `pnpm smoke` (`vite build --ssr src/core/smoke.ts`) | ALL PASS (9 assertions) |
| Headless evaluation | `pnpm evaluate` (`vite build --ssr scripts/evaluate.ts`) | Exit 0 · writes JSON reports |
| Live site | https://cascadeguard-ten.vercel.app/ | HTTP 200 · verified |

---

## 8. HOW TO USE EVERYTHING (judge workflow)

1. Open https://cascadeguard-ten.vercel.app/
2. Press `G` (or visit `?judge=1`) for guided demo overlay — 4 steps.
3. Click `AUTO DEMO` for autonomous sequence (scenario → prediction → incident → recovery).
4. Read `docs/JUDGE_GUIDE.md` for 3-minute walkthrough.
5. Read `docs/ALGORITHMS.md` for every algorithm claim with file/line references.
6. Read `README.md` for killer metric table and architecture overview.
7. Read `docs/evaluation-report.json` for measured cross-scenario results.
8. Open `CascadeGuard-Pitch-2min.pptx` (premium 8-slide pitch) — video-ready.
9. Read `video-output-commands.md` for the 1-minute screen-capture sequence.
10. Read `audio-prompt.md` for the 2-minute voice-over script (ElevenLabs / any TTS).

---

Prepared for **ORCATHON 2026** · Solo participant: Jay Ghevariya (`pal-123456789`)· Event: 25 Oct 2026, 11:00–15:30 IST · Track: 01 Software & AI.
