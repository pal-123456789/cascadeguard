import type {
  DiagnosticsInput,
  RootCauseHypothesis,
  ServiceId,
  ServiceMetrics,
  ServiceState,
} from '../types'

// ============================================================
// Root Cause Analyzer
// Ranks the likely ORIGIN of an active incident by combining:
//   • anomaly severity (how bad the candidate looks)
//   • temporal precedence (who went wrong FIRST)
//   • path strength (how strongly it connects to affected services)
// Ground truth (`metrics.failed`) is never used.
// ============================================================

interface Onset {
  service: ServiceId
  ts: number
  severity: number
  /** 0..1 — how much of the distress is self-inflicted (own leading indicators) */
  selfSignal: number
  /** 0..1 — how much of the error rate is explained by unhealthy dependencies */
  depShare: number
  evidence: string[]
}

/**
 * Baseline of a metric = a low percentile of the retained history.
 * A mean over the oldest third would slide past the healthy baseline once
 * the window fills with degraded samples, and the onset would stop being
 * detectable. A low percentile stays anchored to "the best this service
 * has recently looked like".
 */
function baseline(history: ServiceState['history'], pick: (m: ServiceMetrics) => number): number {
  if (history.length === 0) return 0
  const values = history.map(pick).sort((a, b) => a - b)
  const idx = Math.min(values.length - 1, Math.floor(values.length * 0.1))
  return values[idx]!
}

function detectOnsets(input: DiagnosticsInput): Onset[] {
  const onsets: Onset[] = []
  for (const svc of Object.values(input.services)) {
    const h = svc.history
    if (h.length < 4) continue
    // Prefer the engine's lifetime observed-healthy baseline: it never
    // slides past the healthy period, unlike the rolling history window.
    const b = svc.baseline
    const baseErr = b && b.errorRate > 0 ? b.errorRate : baseline(h, (m) => m.errorRate)
    const baseSat = b && b.saturation > 0 ? b.saturation : baseline(h, (m) => m.saturation)
    const baseP99 = b && b.latencyP99 > 1 ? b.latencyP99 : baseline(h, (m) => m.latencyP99)
    const baseMem = b && b.memory > 0 ? b.memory : baseline(h, (m) => m.memory)

    let onsetIdx = -1
    for (let i = 0; i < h.length; i++) {
      const m = h[i]
      if (m.errorRate > Math.max(0.1, baseErr * 3) || m.saturation > Math.max(0.7, baseSat + 0.3) || m.latencyP99 > Math.max(120, baseP99 * 3)) {
        onsetIdx = i
        break
      }
    }
    if (onsetIdx === -1) continue

    const recent = h[h.length - 1]
    const sev = Math.min(1.5, Math.max(recent.errorRate * 2, recent.saturation, recent.cpu))
    const evidence: string[] = []

    // --- self-inflicted vs dependency-explained -------------------------
    // A root cause degrades on its own terms (a leaking pool, a creeping
    // heap). A victim inherits its distress from an unhealthy dependency.
    const selfRaw = Math.max(
      recent.saturation - baseSat,
      recent.memory - baseMem,
      0,
    )
    const selfSignal = Math.min(1, selfRaw / 0.4)
    let depError = 0
    for (const e of input.topology.edges) {
      if (e.from !== svc.id || !e.critical) continue
      const dep = input.services[e.to]
      if (!dep) continue
      depError += e.weight * dep.metrics.errorRate
    }
    const depShare = Math.min(1, depError / Math.max(0.05, recent.errorRate))
    if (recent.saturation > baseSat + 0.15) {
      evidence.push(`${svc.name} saturation ${recent.saturation.toFixed(2)} (baseline ${baseSat.toFixed(2)})`)
    }
    if (recent.errorRate > baseErr + 0.05) {
      evidence.push(`${svc.name} error rate ${(recent.errorRate * 100).toFixed(0)}% (baseline ${(baseErr * 100).toFixed(1)}%)`)
    }
    if (recent.latencyP99 > baseP99 * 2) {
      evidence.push(`${svc.name} p99 latency ${recent.latencyP99}ms (baseline ${Math.round(baseP99)}ms)`)
    }
    onsets.push({ service: svc.id, ts: h[onsetIdx].ts, severity: sev, selfSignal, depShare, evidence })
  }
  return onsets
}

function topErrorCodes(input: DiagnosticsInput, service: ServiceId, topN = 2): { code: string; count: number }[] {
  const since = input.simTime - 60_000
  const counts = new Map<string, number>()
  for (const log of input.logs) {
    if (log.service !== service || !log.code) continue
    if (log.level !== 'ERROR' && log.level !== 'FATAL' && log.level !== 'WARN') continue
    if (log.ts < since) continue
    counts.set(log.code, (counts.get(log.code) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([code, count]) => ({ code, count }))
}

/** best (max product-of-weights) path from candidate to any affected service, DFS ≤4 hops */
function bestPath(
  candidate: ServiceId,
  affected: Set<ServiceId>,
  adj: Map<ServiceId, { to: ServiceId; weight: number }[]>,
): { strength: number; path: ServiceId[] } | null {
  let best: { strength: number; path: ServiceId[] } | null = null
  const dfs = (node: ServiceId, strength: number, path: ServiceId[], depth: number) => {
    if (best && strength <= best.strength) return // prune
    if (affected.has(node) && path.length > 1) {
      if (!best || strength > best.strength) best = { strength, path: [...path] }
    }
    if (depth >= 4) return
    for (const e of adj.get(node) ?? []) {
      if (path.includes(e.to)) continue
      path.push(e.to)
      dfs(e.to, strength * e.weight, path, depth + 1)
      path.pop()
    }
  }
  dfs(candidate, 1, [candidate], 0)
  return best
}

export function analyzeRootCauses(input: DiagnosticsInput): RootCauseHypothesis[] {
  const incident = input.incidents.find((i) => i.resolvedAt === undefined)
  if (!incident) return []

  const affected = new Set<ServiceId>(incident.services)
  const adj = new Map<ServiceId, { to: ServiceId; weight: number }[]>()
  for (const e of input.topology.edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push({ to: e.to, weight: e.weight })
  }

  const onsets = detectOnsets(input)
  if (onsets.length === 0) return []
  const t0 = Math.min(...onsets.map((o) => o.ts))

  const scored = onsets.map((o) => {
    const path = bestPath(o.service, affected, adj)
    const strength = path ? Math.max(0.05, path.strength) : 0.02
    const precedence = Math.exp(-(o.ts - t0) / 30_000)
    // self-inflicted distress points at the origin; dependency-explained
    // distress points at a victim further up the stack
    const originBias = 0.35 * o.severity + 0.65 * o.selfSignal
    const score = originBias * precedence * (0.4 + 0.6 * strength) * (1 - 0.45 * o.depShare)
    return { onset: o, path, strength, precedence, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const maxScore = Math.max(...scored.map((x) => x.score), 0.0001)

  return scored.slice(0, 3).map((x) => {
    const evidence = [...x.onset.evidence]
    for (const { code, count } of topErrorCodes(input, x.onset.service)) {
      evidence.push(`${code} ×${count} in last 60s`)
    }
    if (x.path && x.path.path.length > 1 && x.precedence > 0.5) {
      const lastAffected = [...x.path.path].reverse().find((p) => affected.has(p))
      if (lastAffected) {
        const affectedState = input.services[lastAffected]
        const onsetTs = x.onset.ts
        evidence.push(`onset precedes ${affectedState.name} distress by ${Math.max(0, Math.round((input.simTime - onsetTs - 45_000) / 1000))}s of telemetry`)
      }
    }
    return {
      service: x.onset.service,
      confidence: Number((0.5 + 0.45 * (x.score / maxScore)).toFixed(2)),
      chain: x.path ? x.path.path : [x.onset.service],
      evidence: evidence.slice(0, 4),
    }
  })
}
