# Video Script — 60–90s (record by 3:10, upload before submission)

> Recording checklist: 1080p screen recording · quiet room, mic test 10s ·
> close personal tabs/notifications · one dry run first · demo on the LIVE link.

## Script — CascadeGuard (fill timings after dry run)

**[0:00–0:12] Hook — the problem**
> "Outages don't start with a bang — they start with one saturated connection pool that quietly spreads through dependency chains until the whole system is down. CascadeGuard sees that spread before it happens."

**[0:12–0:30] Live demo — core flow**
> Run the `pool-exhaustion` scenario at 2x. Point at the topology: "This is a live digital twin of an e-commerce cluster. Watch Orders-DB — saturation is creeping. Our predictor flags it 40 seconds before it fails" (violet halo appears). Failure hits — red pulse — "and there's the cascade."

**[0:30–0:50] Key features (3)**
> "One — failure prediction with a measured lead time: the accuracy panel shows precision, recall and seconds-of-warning scored against ground truth, live."
> "Two — root cause analysis: when the incident opens, CascadeGuard traces the blast radius back upstream and names the origin with evidence from the logs."
> "Three — the recovery optimizer: it Monte-Carlo simulates seven strategies, thirty rollouts each, and recommends one. Watch — I click Apply, and the cascade is contained."

**[0:50–1:05] Under the hood**
> "Fully client-side TypeScript: a deterministic digital-twin engine feeds a hybrid AI engine — logistic risk scoring plus dependency-graph propagation, upstream root-cause tracing, and Monte Carlo recovery projection — rendered in React with a custom SVG topology. Every prediction is auto-verified against ground truth."

**[1:05–1:15] Honesty + close**
> "Built for Orcathon 2026 in under five hours — architecture and contracts by me, module implementation accelerated with an AI coding agent, fully disclosed. Predict. Trace. Recover. Links below."

## Rules of thumb
- Screen + voice only; no intro cards, no music mixing time.
- Never show a broken state; if a feature is flaky, don't feature it.
- Speak the judge's scorecard: functionality, innovation, technical, UI/UX.
