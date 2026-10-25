// ============================================================
// CascadeGuard — Live Accuracy Tracker (AI module)
// Matches active risk predictions against observed failures.
// This is the ONLY AI module allowed to read `ServiceMetrics.failed`
// (simulation ground truth) — see ../types.ts.
// ============================================================

import { SIM } from '../types'
import type { AccuracyStats, DiagnosticsInput, RiskAssessment, ServiceId } from '../types'

interface PendingPrediction {
  madeAt: number
  active: boolean
}

// Module-level tracker state (persists across ticks for the engine lifetime).
const pending = new Map<ServiceId, PendingPrediction>()
const failedSeen = new Set<ServiceId>()
const leadTimes: number[] = []
let hits = 0
let falseAlarms = 0
let missed = 0

export function trackAccuracy(
  input: DiagnosticsInput,
  risks: Record<ServiceId, RiskAssessment>,
): AccuracyStats {
  // 1) Expire stale predictions: no failure within the horizon → false alarm.
  for (const [id, p] of pending) {
    if (input.simTime - p.madeAt > SIM.RISK_HORIZON_MS) {
      pending.delete(id)
      falseAlarms++
    }
  }

  // 2) Detect failure rising edges (ground truth read — permitted here only).
  for (const id of Object.keys(input.services)) {
    const st = input.services[id]
    if (!st) continue
    const failedNow = st.metrics.failed
    if (failedNow && !failedSeen.has(id)) {
      const p = pending.get(id)
      if (p) {
        const lead = input.simTime - p.madeAt
        pending.delete(id)
        if (lead <= SIM.RISK_HORIZON_MS) {
          hits++
          leadTimes.push(lead)
        } else {
          missed++
        }
      } else {
        missed++ // failure nobody predicted
      }
      failedSeen.add(id)
    } else if (!failedNow) {
      failedSeen.delete(id) // re-arm for the next incident
    }
  }

  // 3) Register new predictions (never for services that already failed —
  //    a "prediction" of the past is not a prediction).
  for (const id of Object.keys(risks)) {
    const r = risks[id]
    const st = input.services[id]
    if (!st || st.metrics.failed) continue
    if (r && r.predicted && !pending.has(id)) {
      pending.set(id, { madeAt: input.simTime, active: true })
    }
  }

  const predictions = hits + falseAlarms + missed
  const sum = leadTimes.reduce((s, v) => s + v, 0)
  return {
    predictions,
    hits,
    falseAlarms,
    missed,
    avgLeadTimeMs: leadTimes.length > 0 ? sum / leadTimes.length : 0,
    precision: hits + falseAlarms > 0 ? hits / (hits + falseAlarms) : 0,
    recall: hits + missed > 0 ? hits / (hits + missed) : 0,
  }
}
