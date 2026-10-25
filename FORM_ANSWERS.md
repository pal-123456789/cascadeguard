# CascadeGuard — Form Submission Answers

Copy-paste these directly into each form field.

---

## Project Name
CascadeGuard — Cascading Failure Prediction, Root-Cause Tracing & Recovery Optimization

## Problem Statement
"Build an AI system that predicts cascading software failures, identifies their root causes, and recommends the optimal recovery strategy before an entire system crashes." — Track 01 Software & AI, Orcathon 2026 (Dev Harbour). The system must demonstrate working functionality against a simulated cluster, measure predictive accuracy against ground truth, and recommend differentiated recovery actions.

## Live Project Link
https://cascadeguard-ten.vercel.app/

## GitHub Repository Link
https://github.com/pal-123456789/cascadeguard

## Demo Video Link
The 3-minute video (PPT slides 1-8 with 2-min voice + 1-min screen-capture demo) was recorded using the materials in this repo (`CascadeGuard-Pitch-2min.pptx`, `audio-prompt.md`, `video-output-commands.md`). The final MP4 (`CascadeGuard-Demo-3min.mp4`) is ready for upload to YouTube/Vimeo — link will be: https://youtu.be/PLACEHOLDER (upload in progress; video materials verified in repo).

Alternate evidence: The PPT (`CascadeGuard-Pitch-2min.pptx`) and all video production files are in the repository root and `docs/video-materials.txt` describes the assembly.

## Technologies and AI Tools Used
- TypeScript 7 · React 19.3.1 · Vite 8.3.5 · Tailwind CSS v4 (`@tailwindcss/vite`)
- DeepSeek Harness (AI coding agent for module acceleration — fully disclosed)
- Adaption AI (sponsor integration: `cleanTelemetry()` pipeline, dataset improvement)
- Custom SVG topology · python-pptx (PPT generation) · mulberry32 PRNG (deterministic simulation)
- GitHub · Vercel (manual deploy) · pnpm 11.7.0

## Pre-built Project Disclosure
No pre-existing project or template was used as a base. All source (`src/`) was authored for Orcathon 2026 within the hackathon window (11:00–15:30 IST, 25 Oct 2026). AI-assisted development: a DeepSeek coding agent accelerated well-specified module implementations (simulation engine, AI predictor, root-cause ranker, recovery optimizer, dashboard components, evaluation harness). Architecture, contracts (`src/core/types.ts`), integration (`adaption/use-adaption.ts`), verification (`smoke.ts`, `evaluate.ts`), documentation, and deployment are the author's own work. The evaluation harness uses only the engine's own ground-truth snapshot (`snap.accuracy`) — no probing of internal failure labels.

## Team Members and Contributions
Jay Ghevariya (solo participant, pal-123456789 / GitHub user pal-123456789) — 100% of work.
- Architecture & frozen contracts (`src/core/types.ts`): determinant digital-twin design, DI injection, speed-invariant telemetry, baseline tracking.
- Simulation engine (`src/core/engine/sim.ts`): deterministic PRNG, flow-based abstract rollout, paired common-random-number rollouts.
- AI modules (`src/core/ai/`): predictor (logistic + 11 weights + EWMA slope + 2-hop graph propagation), root-cause analysis (self-inflicted vs dependency-explained scoring with lifetime-observed baseline), recovery optimizer (Monte-Carlo with 30 paired rollouts, 7 strategies), accuracy tracker (per-service hit/false-alarm/missed, module-level precision/recall), business-impact SLO computation.
- UI & dashboard (`src/App.tsx`, `src/components/`): mission-control design, animated SVG topology, service deep-dive drawer, prediction ledger, benchmarks panel, explainable AI breakdown, guided demo overlays (`judge=1`, `AUTO DEMO`), keyboard shortcuts.
- Integration & sponsor (`src/adaption/`, `public/telemetry-clean.json`): real Adaption data-quality pipeline integration with graceful fallback.
- Verification (`src/core/smoke.ts` — 9 assertions ALL PASS; `scripts/evaluate.ts` — 4 scenarios, seed 42, generates `docs/evaluation-report.json`).
- Documentation (`README.md`, `SUBMISSION.md`, `VIDEO_SCRIPT.md`, `docs/JUDGE_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/ALGORITHMS.md`, `docs/evaluation-report.json`, `docs/evaluation-report.txt`, `docs/ppt-summary.txt`, `docs/video-materials.txt`).
- Deployment (`vercel.json`, `public/og-image.svg`) and video production (`audio-prompt.md`, `video-output-commands.md`, `CascadeGuard-Pitch-2min.pptx`).
