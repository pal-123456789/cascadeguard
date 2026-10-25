// ============================================================
// CascadeGuard — Hybrid Failure Predictor (AI module)
// Pure heuristic model: logistic risk from metric levels, EWMA
// trends and log intensity, plus topology propagation.
//
// GROUND TRUTH RULE: `ServiceMetrics.failed` (and `healthy`) is
// simulation ground truth. This module NEVER reads it — risk is
// derived from telemetry only (contract in ../types.ts).
// ============================================================

import { SIM } from '../types'
import type {
  DiagnosticsInput,
  RiskAssessment,
  RiskDriver,
  ServiceId,
  ServiceMetrics,
} from '../types'

// ---- documented model weights -------------------------------------
// z = BIAS + Σ wᵢ·fᵢ ; risk = sigmoid(z). Calibration targets:
// healthy → 0.05-0.15, slow creep → 0.4-0.7, imminent → ≥0.75.
const BIAS = -3.6
const W_MEM = 1.0 // memory level (0..1)
const W_SAT = 1.3 // pool/queue saturation level (0..1)
const W_ERR = 1.4 // error rate (scaled ×5, saturates at 0.2)
const W_CPU = 0.7 // cpu level (0..1)
const W_LAT = 0.6 // p99 latency / 2000ms
const W_SLOPE_MEM = 1.8 // memory fast−slow EWMA trend ×60k (per sim-ms)
const W_SLOPE_SAT = 1.8 // saturation trend ×60k (per sim-ms)
const W_SLOPE_ERR = 1.4 // error-rate trend ×120k (per sim-ms)
const W_LOG = 1.1 // WARN/ERROR log intensity, last 30s (/8 events)
const EWMA_A_FAST = 0.35 // fast EWMA smoothing (reacts quickly)
const EWMA_A_SLOW = 0.8 // slow EWMA smoothing (stable trend)
const SLOPE_MEM_SCALE = 60_000 // per-ms trend → 0..1 feature
const SLOPE_ERR_SCALE = 120_000
const LOG_WINDOW_MS = 30_000
const LOG_BURST_COUNT = 8 // warn/error events in 30s → intensity 1
const LAT_SCALE_MS = 2000 // p99 latency mapped to 0..1
const ERR_SCALE = 5
const HISTORY_SAMPLES = 20
const PROP_ITERATIONS = 2
const PROP_GAIN = 0.5 // × edge weight per hop
const LOCAL_MIX = 0.75 // final = 0.75·local + 0.25·propagated
const SMOOTH_OWN = 0.65 // smoothed = 0.65·own + 0.35·previous
const TTF_FLOOR_MS = 1_000

// ---- local pure math helpers --------------------------------------

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z))

/** Fast−slow EWMA trend of a series, expressed per sim-ms.
 *  For a linear ramp of d per sample the fast EWMA lags d·aF/(1−aF)
 *  and the slow one d·aS/(1−aS); their difference is ∝ d. */
function ewmaTrendPerMs(values: number[], gapMs: number): number {
  if (values.length < 3) return 0
  const gap = gapMs > 0 ? gapMs : SIM.SIM_MS_PER_STEP
  const k = EWMA_A_SLOW / (1 - EWMA_A_SLOW) - EWMA_A_FAST / (1 - EWMA_A_FAST)
  let fast = values[0]!
  let slow = values[0]!
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!
    fast = EWMA_A_FAST * fast + (1 - EWMA_A_FAST) * v
    slow = EWMA_A_SLOW * slow + (1 - EWMA_A_SLOW) * v
  }
  return (fast - slow) / (k * gap)
}

interface FeatureSet {
  mem: number
  sat: number
  err: number
  cpu: number
  lat: number
  slopeMem: number
  slopeSat: number
  slopeErr: number
  log: number
  curMem: number
  curSat: number
}

function extractFeatures(
  history: ServiceMetrics[],
  cur: ServiceMetrics,
  input: DiagnosticsInput,
  id: ServiceId,
): FeatureSet {
  const win = history.slice(-HISTORY_SAMPLES)
  const samples = win.length > 0 ? win : [cur]
  const n = samples.length
  let mem = 0
  let sat = 0
  let err = 0
  let cpu = 0
  let lat = 0
  const memSeries: number[] = []
  const satSeries: number[] = []
  const errSeries: number[] = []
  for (const m of samples) {
    mem += m.memory
    sat += m.saturation
    err += m.errorRate
    cpu += m.cpu
    lat += m.latencyP99
    memSeries.push(m.memory)
    satSeries.push(m.saturation)
    errSeries.push(m.errorRate)
  }
  const gap = n > 1 ? (samples[n - 1]!.ts - samples[0]!.ts) / (n - 1) : SIM.SIM_MS_PER_STEP
  const cutoff = input.simTime - LOG_WINDOW_MS
  let logHits = 0
  for (const lg of input.logs) {
    if (lg.service === id && lg.ts >= cutoff) {
      if (lg.level === 'WARN' || lg.level === 'ERROR' || lg.level === 'FATAL') logHits++
    }
  }
  return {
    mem: clamp01(mem / n),
    sat: clamp01(sat / n),
    err: clamp01((err / n) * ERR_SCALE),
    cpu: clamp01(cpu / n),
    lat: clamp01(lat / n / LAT_SCALE_MS),
    slopeMem: ewmaTrendPerMs(memSeries, gap),
    slopeSat: ewmaTrendPerMs(satSeries, gap),
    slopeErr: ewmaTrendPerMs(errSeries, gap),
    log: clamp01(logHits / LOG_BURST_COUNT),
    curMem: cur.memory,
    curSat: cur.saturation,
  }
}

interface Term {
  label: string
  w: number
}

function localRisk(f: FeatureSet): { z: number; terms: Term[] } {
  const terms: Term[] = [
    { label: 'High memory utilization', w: W_MEM * f.mem },
    { label: 'Resource saturation (pools/queues)', w: W_SAT * f.sat },
    { label: 'Elevated error rate', w: W_ERR * f.err },
    { label: 'CPU load', w: W_CPU * f.cpu },
    { label: 'P99 latency degradation', w: W_LAT * f.lat },
    { label: 'Memory climbing (leak trend)', w: W_SLOPE_MEM * clamp01(f.slopeMem * SLOPE_MEM_SCALE) },
    { label: 'Saturation trending up', w: W_SLOPE_SAT * clamp01(f.slopeSat * SLOPE_MEM_SCALE) },
    { label: 'Error rate trending up', w: W_SLOPE_ERR * clamp01(f.slopeErr * SLOPE_ERR_SCALE) },
    { label: 'Warn/error log burst', w: W_LOG * f.log },
  ]
  let z = BIAS
  for (const t of terms) z += t.w
  return { z, terms }
}

function pickDrivers(terms: Term[], cascadeTerm: number): RiskDriver[] {
  const all = terms
    .concat({ label: 'Cascade pressure from dependencies', w: cascadeTerm })
    .filter((t) => t.w > 1e-6)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
  if (all.length === 0) {
    return [
      { label: 'All telemetry nominal', contribution: 0.8 },
      { label: 'Baseline noise', contribution: 0.2 },
    ]
  }
  if (all.length === 1) all.push({ label: 'Baseline telemetry noise', w: all[0]!.w * 0.25 })
  const sum = all.reduce((s, t) => s + t.w, 0) || 1
  return all.map((t) => ({ label: t.label, contribution: t.w / sum }))
}

export function predictRisks(
  input: DiagnosticsInput,
  prev: Record<ServiceId, RiskAssessment>,
): Record<ServiceId, RiskAssessment> {
  const ids = Object.keys(input.services)
  const local: Record<ServiceId, number> = {}
  const feats: Record<ServiceId, FeatureSet> = {}
  const termsById: Record<ServiceId, Term[]> = {}

  // Pass 1 — per-service local risk from telemetry only.
  // NOTE: metrics.failed is ground truth and is intentionally never read here.
  for (const id of ids) {
    const state = input.services[id]
    if (!state) continue
    const f = extractFeatures(state.history, state.metrics, input, id)
    feats[id] = f
    const lr = localRisk(f)
    termsById[id] = lr.terms
    local[id] = sigmoid(lr.z)
  }

  // Pass 2 — two propagation iterations over topology edges:
  // callee distress raises callers, caller distress raises callees.
  const prop: Record<ServiceId, number> = { ...local }
  for (let i = 0; i < PROP_ITERATIONS; i++) {
    const deltas: Array<{ id: ServiceId; d: number }> = []
    for (const e of input.topology.edges) {
      const callee = prop[e.to] ?? 0
      const caller = prop[e.from] ?? 0
      if (callee > 0) deltas.push({ id: e.from, d: callee * e.weight * PROP_GAIN })
      if (caller > 0) deltas.push({ id: e.to, d: caller * e.weight * PROP_GAIN })
    }
    for (const { id, d } of deltas) prop[id] = Math.min(1, (prop[id] ?? 0) + d)
  }

  // Pass 3 — blend, smooth with previous assessment, build output.
  const out: Record<ServiceId, RiskAssessment> = {}
  for (const id of ids) {
    const state = input.services[id]
    if (!state) continue
    const f = feats[id]!
    const loc = local[id] ?? 0
    const blended = LOCAL_MIX * loc + (1 - LOCAL_MIX) * (prop[id] ?? 0)
    const prevRisk = prev[id]?.risk
    const own =
      prevRisk === undefined ? blended : SMOOTH_OWN * blended + (1 - SMOOTH_OWN) * prevRisk
    const risk = Math.min(0.99, Math.max(0.01, own))

    // TTF: extrapolate the faster-rising of memory/saturation to the 1.0 crossing.
    const crossings: number[] = []
    if (f.slopeMem > 1e-9) crossings.push((1 - f.curMem) / f.slopeMem)
    if (f.slopeSat > 1e-9) crossings.push((1 - f.curSat) / f.slopeSat)
    let ttf: number | undefined
    if (crossings.length > 0) {
      ttf = Math.min(SIM.RISK_HORIZON_MS, Math.max(TTF_FLOOR_MS, Math.min(...crossings)))
    }

    const cascadeTerm = Math.max(0, (prop[id] ?? 0) - loc) * 2
    const assessment: RiskAssessment = {
      service: id,
      ts: input.simTime,
      risk,
      predicted: risk >= SIM.RISK_THRESHOLD,
      drivers: pickDrivers(termsById[id] ?? [], cascadeTerm),
    }
    if (ttf !== undefined) assessment.ttfMs = ttf
    out[id] = assessment
  }
  return out
}
