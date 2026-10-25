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
// The accuracy tracker keeps its counters in module-level state, so
// every scenario starts with resetAccuracyTracker(). The engine's own
// snapshot.accuracy is the authoritative tracker output; a baseline is
// captured at scenario start and the per-scenario statistics are the
// delta between the final and the baseline snapshot.
// ============================================================

import { createEngine } from '../engine/sim'
import { predictRisks } from '../ai/predictor'
import { analyzeRootCauses } from '../ai/rootcause'
import { projectStrategies } from '../ai/recovery'
import { trackAccuracy, resetAccuracyTracker } from '../ai/accuracy'
import { SEED_TOPOLOGY } from '../../data/topology'
import { SCENARIOS } from '../engine/scenarios'
import type {
  AccuracyStats,
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
/** engine speed multiplier (steps of 3s sim per 600ms tick) */
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
  /** the same lead time expressed in seconds (null when there was no lead) */
  predictedLeadTimeSec: number | null
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

// ---------------- helpers ---------------------------------------

const diff = (final: number, baseline: number): number => Math.max(0, final - baseline)

/** per-scenario accuracy statistics = final snapshot − baseline snapshot */
function accuracyDelta(final: AccuracyStats, baseline: AccuracyStats): AccuracyStats {
  return {
    predictions: diff(final.predictions, baseline.predictions),
    hits: diff(final.hits, baseline.hits),
    missed: diff(final.missed, baseline.missed),
    falseAlarms: diff(final.falseAlarms, baseline.falseAlarms),
    avgLeadTimeMs: final.avgLeadTimeMs,
    precision: diff(final.precision, baseline.precision),
    recall: diff(final.recall, baseline.recall),
  }
}

// ---------------- per-scenario runner --------------------------

function evaluateScenario(scenario: ScenarioDef): Promise<ScenarioEvaluation> {
  return new Promise<ScenarioEvaluation>((resolveScenario) => {
    const g = globalThis as { __CG_SPEED__?: number; __CG_DEBUG__?: boolean }
    const engineSpeed = g.__CG_SPEED__ ?? ENGINE_SPEED_DEFAULT

    // fresh tracker state for every scenario
    resetAccuracyTracker()

    const engine = createEngine(SEED_TOPOLOGY, {
      predict: predictRisks,
      rootCause: analyzeRootCauses,
      recovery: projectStrategies,
      accuracy: trackAccuracy,
    })

    engine.loadScenario(scenario.id, EVAL_SEED)
    engine.setSpeed(engineSpeed)

    // baseline: the tracker's counters right after the scenario is loaded
    const baseline = engine.snapshot().accuracy

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

      const snap = finalSnapshot
      const acc = accuracyDelta(snap?.accuracy ?? baseline, baseline)

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
            (acc2, p) => (acc2 === null || p.successProbability > acc2.successProbability ? p : acc2),
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

      if (g.__CG_DEBUG__) {
        console.log(
          `[dbg ${scenario.id}] firstFailure=${firstFailureAt} svc=${firstFailedService}` +
            ` firstPred=${firstFailedService ? firstPredictionAt.get(firstFailedService) : 'n/a'}` +
            ` lead=${lead} acc=${JSON.stringify(acc)} predOrigin=${predictedOrigin}` +
            ` trueOrigin=${trueOrigin} impacted=${impacted.size} simTime=${snap?.simTime}`,
        )
      }

      resolveScenario({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        timeToFirstFailureMs: firstFailureAt ?? 0,
        predictionLeadTimeMs: lead,
        predictedLeadTimeSec: lead === null ? null : Math.round(lead / 1000),
        predictedOrigin,
        trueOrigin,
        originMatch: predictedOrigin !== null && predictedOrigin === trueOrigin,
        servicesFailed,
        servicesImpacted: impacted.size,
        hits: acc.hits,
        missed: acc.missed,
        falseAlarms: acc.falseAlarms,
        precision: acc.precision,
        recall: acc.recall,
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

      if (snap.simTime >= SIM_MS) finish()
    })

    // wall-clock guard — a stuck scenario must not stall the report
    timer = setTimeout(finish, SCENARIO_TIMEOUT_MS)

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
