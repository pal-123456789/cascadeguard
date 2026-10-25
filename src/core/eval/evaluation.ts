// ============================================================
// CascadeGuard — Headless scenario evaluation harness
//
// Runs every scenario in SCENARIOS through the REAL engine with the
// REAL AI modules (predictor / root-cause / recovery / accuracy) and
// measures, per scenario:
//
//   • how much warning time the predictor gave before the first
//     hard failure (prediction lead time),
//   • whether the root-cause analyzer pointed at the true origin,
//   • precision / recall of the live accuracy tracker,
//   • which recovery strategy the optimizer recommended.
//
// Technique (same as src/core/smoke.ts): drive the engine headless,
// subscribe to its state, and use engine.snapshot() inside the
// subscription to sample the world.
//
// ACCURACY TRACKER ISOLATION
// `trackAccuracy` keeps its counters in MODULE-level state, so a
// single tracker instance would leak predictions from one scenario
// into the next. To keep every scenario independent we:
//   1. read the tracker's cumulative counters BEFORE the scenario,
//   2. run the scenario,
//   3. FLUSH the tracker (expire every still-open prediction) and
//      read the cumulative counters again,
//   4. report the DELTA as this scenario's statistics.
// The flush happens after the scenario's numbers are captured, so a
// prediction that was still open at the end of the window is booked
// as a false alarm of the scenario that made it — and it is already
// part of the next scenario's baseline, so it never leaks.
// ============================================================

import { createEngine } from '../engine/sim'
import { predictRisks } from '../ai/predictor'
import { analyzeRootCauses } from '../ai/rootcause'
import { projectStrategies } from '../ai/recovery'
import { trackAccuracy } from '../ai/accuracy'
import { SEED_TOPOLOGY } from '../../data/topology'
import { SCENARIOS } from '../engine/scenarios'
import type {
  AccuracyStats,
  DiagnosticsInput,
  Incident,
  ScenarioDef,
  ServiceId,
  SimulationSnapshot,
  StrategyProjection,
} from '../types'

// ---------------- constants ------------------------------------

/** sim-ms of simulation per scenario (12 sim-minutes) */
const SIM_MS = 12 * 60_000
/** sim-minutes covered by one evaluation run */
export const SIM_MINUTES = 12
/** engine seed — every scenario is replayed with the same seed */
export const EVAL_SEED = 42
/** engine speed multiplier (20 steps of 3s per 600ms tick) */
const ENGINE_SPEED_DEFAULT = 20
/** wall-clock guard per scenario (ms) */
const SCENARIO_TIMEOUT_MS = 40_000

// ---------------- public contracts ------------------------------

export interface ScenarioEvaluation {
  scenarioId: string
  scenarioName: string
  /** sim-ms from start until the first service failed */
  timeToFirstFailureMs: number
  /** sim-ms between the earliest PREDICTION (risk >= SIM.RISK_THRESHOLD) and the actual failure of the same service */
  predictionLeadTimeMs: number | null
  /** service the evaluator judged as the origin */
  predictedOrigin: string | null
  trueOrigin: string | null
  originMatch: boolean
  /** final count of failed services */
  servicesFailed: number
  /** total services that were ever degraded or failed */
  servicesImpacted: number
  /** stats from the accuracy tracker */
  hits: number
  missed: number
  falseAlarms: number
  precision: number
  recall: number
  /** best recovery strategy id per the recovery projections */
  bestStrategyId: string | null
  bestStrategySuccessProbability: number
  /** sim-ms until the incident opened */
  incidentOpenedAtMs: number | null
  /** number of root-cause hypotheses produced */
  rootCauseHypotheses: number
}

export interface EvaluationReport {
  generatedAt: string
  seed: number
  simMinutes: number
  scenarios: ScenarioEvaluation[]
  aggregate: {
    avgPredictionLeadTimeMs: number
    originAccuracy: number
    avgPrecision: number
    avgRecall: number
    totalHits: number
    totalMissed: number
  }
}

// ---------------- tracker helpers -------------------------------

/** A DiagnosticsInput that carries no services / risks — used to read
 *  the tracker's cumulative counters without changing them. */
function probeInput(simTime: number): DiagnosticsInput {
  return {
    tick: 0,
    simTime,
    topology: SEED_TOPOLOGY,
    services: {},
    logs: [],
    incidents: [],
  }
}

/** Read the tracker's cumulative counters (no side effects: simTime 0
 *  never expires a pending prediction, and there are no services/risks). */
function readTracker(): AccuracyStats {
  return trackAccuracy(probeInput(0), {})
}

/** Expire every still-open prediction so the next scenario starts clean. */
function flushTracker(): AccuracyStats {
  return trackAccuracy(probeInput(Number.MAX_SAFE_INTEGER), {})
}

// ---------------- per-scenario runner --------------------------

function evaluateScenario(scenario: ScenarioDef): Promise<ScenarioEvaluation> {
  return new Promise<ScenarioEvaluation>((resolveScenario) => {
    const g = globalThis as { __CG_SPEED__?: number; __CG_DEBUG__?: boolean }
    const engineSpeed = g.__CG_SPEED__ ?? ENGINE_SPEED_DEFAULT
    const engine = createEngine(SEED_TOPOLOGY, {
      predict: predictRisks,
      rootCause: analyzeRootCauses,
      recovery: projectStrategies,
      accuracy: trackAccuracy,
    })

    // baseline of the (shared) accuracy tracker before this scenario
    const baseline = readTracker()

    // --- collectors -------------------------------------------------
    let firstFailureAt: number | null = null
    let firstFailedService: ServiceId | null = null
    /** earliest sim-time at which the predictor flagged a service */
    const firstPredictionAt = new Map<ServiceId, number>()
    /** services that were ever degraded / critical / failed */
    const impacted = new Set<ServiceId>()
    let incident: Incident | null = null
    let lastRootCauses: SimulationSnapshot['rootCauses'] = []
    let lastProjections: StrategyProjection[] = []
    let finalSnapshot: SimulationSnapshot | null = null

    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = () => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      unsub()
      engine.pause()

      // flush the shared tracker: expire open predictions and read the
      // cumulative counters for this scenario.
      const final = flushTracker()
      const hits = Math.max(0, final.hits - baseline.hits)
      const missed = Math.max(0, final.missed - baseline.missed)
      const falseAlarms = Math.max(0, final.falseAlarms - baseline.falseAlarms)

      const snap = finalSnapshot
      // --- prediction lead time -------------------------------------
      let lead: number | null = null
      if (firstFailureAt !== null && firstFailedService !== null) {
        const predictedAt = firstPredictionAt.get(firstFailedService)
        if (predictedAt !== undefined && predictedAt < firstFailureAt) {
          lead = firstFailureAt - predictedAt
        }
      }

      // --- origin ----------------------------------------------------
      const trueOrigin = incident?.origin ?? null
      const predictedOrigin = lastRootCauses.length > 0 ? lastRootCauses[0]!.service : null

      // --- best recovery strategy -------------------------------------
      let bestStrategyId: string | null = null
      let bestStrategySuccessProbability = 0
      if (lastProjections.length > 0) {
        const recommended = lastProjections.find((p) => p.verdict === 'recommended')
        const fallback = lastProjections
          .filter((p) => p.strategyId !== 'no-action')
          .reduce<(StrategyProjection | null)>(
            (acc, p) => (acc === null || p.successProbability > acc.successProbability ? p : acc),
            null,
          )
        const best = recommended ?? fallback
        if (best) {
          bestStrategyId = best.strategyId
          bestStrategySuccessProbability = best.successProbability
        }
      }

      const servicesFailed = snap
        ? Object.values(snap.services).filter((s) => s.metrics.failed).length
        : 0

      resolveScenario({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        timeToFirstFailureMs: firstFailureAt ?? 0,
        predictionLeadTimeMs: lead,
        predictedOrigin,
        trueOrigin,
        originMatch: predictedOrigin !== null && predictedOrigin === trueOrigin,
        servicesFailed,
        servicesImpacted: impacted.size,
        hits,
        missed,
        falseAlarms,
        precision: hits + falseAlarms > 0 ? hits / (hits + falseAlarms) : 0,
        recall: hits + missed > 0 ? hits / (hits + missed) : 0,
        bestStrategyId,
        bestStrategySuccessProbability,
        incidentOpenedAtMs: incident?.startedAt ?? null,
        rootCauseHypotheses: lastRootCauses.length,
      })
    }

    const unsub = engine.subscribe(() => {
      // sample the world through the engine itself
      const snap = engine.snapshot()
      finalSnapshot = snap

      // 1) earliest prediction per service
      for (const [id, risk] of Object.entries(snap.risks)) {
        if (risk.predicted && !firstPredictionAt.has(id)) {
          firstPredictionAt.set(id, snap.simTime)
        }
      }

      // 2) first hard failure + impacted set
      for (const svc of Object.values(snap.services)) {
        if (svc.metrics.failed) {
          if (firstFailureAt === null) {
            firstFailureAt = snap.simTime
            firstFailedService = svc.id
          }
        }
        if (svc.status !== 'healthy' || svc.metrics.failed) impacted.add(svc.id)
      }

      // 3) incident (ground-truth origin)
      if (!incident && snap.incidents.length > 0) incident = snap.incidents[0]!

      // 4) root-cause hypotheses (keep the most recent non-empty output)
      if (snap.rootCauses.length > 0) lastRootCauses = snap.rootCauses

      // 5) recovery projections (keep the most recent non-empty output)
      if (snap.projections.length > 0) lastProjections = snap.projections

      const dbg = g.__CG_DEBUG__
      if (dbg) {
        console.log(`[dbg ${scenario.id} t=${snap.simTime}] tick=${snap.tick} inc=${snap.incidents.length} rc=${snap.rootCauses.length} acc=${JSON.stringify(snap.accuracy)}`)
        const risks = Object.entries(snap.risks)
          .map(([id, r]) => `${id}=${r.risk.toFixed(2)}${r.predicted ? '*' : ''}`)
          .join(' ')
        const failed = Object.values(snap.services)
          .filter((s) => s.metrics.failed)
          .map((s) => s.id)
          .join(',')
        const st = Object.values(snap.services)
          .filter((s) => s.status !== 'healthy')
          .map((s) => `${s.id}:${s.status}(sat=${s.metrics.saturation.toFixed(2)},mem=${s.metrics.memory.toFixed(2)},err=${s.metrics.errorRate.toFixed(2)})`)
          .join(' ')
        console.log(`[dbg t=${snap.simTime}] failed=${failed || '-'} | ${st || 'all healthy'}`)
        console.log(`        risks ${risks}`)
      }

      if (snap.simTime >= SIM_MS) finish()
    })

    // wall-clock guard — a stuck scenario must not stall the report
    timer = setTimeout(finish, SCENARIO_TIMEOUT_MS)

    engine.loadScenario(scenario.id, EVAL_SEED)
    engine.setSpeed(engineSpeed)
    engine.start()
  })
}

// ---------------- public API ------------------------------------

export async function runEvaluation(): Promise<EvaluationReport> {
  const scenarios: ScenarioEvaluation[] = []
  for (const scenario of SCENARIOS) {
    scenarios.push(await evaluateScenario(scenario))
  }

  const n = scenarios.length > 0 ? scenarios.length : 1
  const leads = scenarios
    .map((s) => s.predictionLeadTimeMs)
    .filter((v): v is number => v !== null)

  return {
    generatedAt: new Date().toISOString(),
    seed: EVAL_SEED,
    simMinutes: SIM_MINUTES,
    scenarios,
    aggregate: {
      avgPredictionLeadTimeMs:
        leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : 0,
      originAccuracy: scenarios.filter((s) => s.originMatch).length / n,
      avgPrecision: scenarios.reduce((a, s) => a + s.precision, 0) / n,
      avgRecall: scenarios.reduce((a, s) => a + s.recall, 0) / n,
      totalHits: scenarios.reduce((a, s) => a + s.hits, 0),
      totalMissed: scenarios.reduce((a, s) => a + s.missed, 0),
    },
  }
}
