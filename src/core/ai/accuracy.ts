// ============================================================
// CascadeGuard — Live Accuracy Tracker (AI module)
// Scores every prediction the AI raises against the simulation's
// ground truth (the ONLY module allowed to read `metrics.failed`).
//
// Semantics, per service:
//   • predictedAt   = first tick where risk crossed the threshold
//                     while the service was still healthy
//   • hit           = the service actually failed within the
//                     prediction horizon → lead time = warning value
//   • false-alarm   = horizon elapsed, no failure happened
//   • missed        = the service failed with no prior prediction
// ============================================================

import { SIM } from '../types'
import type { AccuracyStats, DiagnosticsInput, RiskAssessment, ServiceId } from '../types'

interface Tracker {
  predictedAt?: number
  resolved?: 'hit' | 'false-alarm' | 'missed'
  leadMs?: number
}

// Module-level state — persists for the lifetime of the engine.
const trackers = new Map<ServiceId, Tracker>()
const leadTimes: number[] = []
let hits = 0
let falseAlarms = 0
let missed = 0

export function trackAccuracy(
  input: DiagnosticsInput,
  risks: Record<ServiceId, RiskAssessment>,
): AccuracyStats {
  for (const [id, st] of Object.entries(input.services)) {
    const t = trackers.get(id) ?? {}
    const failed = st.metrics.failed
    const r = risks[id]

    // A warning is only meaningful while the service is still alive.
    if (!failed && r?.predicted && t.predictedAt === undefined) {
      t.predictedAt = input.simTime
    }

    if (failed && t.resolved === undefined) {
      if (t.predictedAt !== undefined && input.simTime - t.predictedAt <= SIM.RISK_HORIZON_MS) {
        t.resolved = 'hit'
        t.leadMs = input.simTime - t.predictedAt
        hits++
        leadTimes.push(t.leadMs)
      } else {
        t.resolved = 'missed'
        missed++
      }
    } else if (!failed && t.resolved === undefined && t.predictedAt !== undefined) {
      if (input.simTime - t.predictedAt > SIM.RISK_HORIZON_MS) {
        t.resolved = 'false-alarm'
        falseAlarms++
      }
    }

    // Re-arm a service that recovered: the next incident is scored fresh.
    if (!failed && (t.resolved === 'missed' || t.resolved === 'false-alarm')) {
      trackers.delete(id)
      continue
    }

    trackers.set(id, t)
  }

  const sum = leadTimes.reduce((s, v) => s + v, 0)
  return {
    predictions: hits + falseAlarms + missed,
    hits,
    falseAlarms,
    missed,
    avgLeadTimeMs: leadTimes.length > 0 ? sum / leadTimes.length : 0,
    precision: hits + falseAlarms > 0 ? hits / (hits + falseAlarms) : 0,
    recall: hits + missed > 0 ? hits / (hits + missed) : 0,
  }
}

/** Test seam: reset tracker state between evaluation runs. */
export function resetAccuracyTracker(): void {
  trackers.clear()
  leadTimes.length = 0
  hits = 0
  falseAlarms = 0
  missed = 0
}
