import type {
  DiagnosticsInput,
  RecoveryStrategy,
  ServiceId,
  StrategyProjection,
} from '../types'

// ============================================================
// Recovery Strategy Optimizer
// Monte-Carlo simulates each candidate recovery action over a
// lightweight abstract cascade model of the cluster and ranks
// strategies by containment probability, damage and cost.
// ============================================================

export const STRATEGY_CATALOG: RecoveryStrategy[] = [
  { id: 'restart', name: 'Drain & Restart', description: 'Restart the failing service — brief blip, clears leak/pool state', kind: 'restart' },
  { id: 'failover', name: 'Failover to Standby', description: 'Shift traffic to standby replicas — 1.8× capacity, no downtime', kind: 'failover' },
  { id: 'shed-load', name: 'Shed Non-Critical Load', description: 'Drop 40% of edge traffic to protect the critical path', kind: 'shed-load' },
  { id: 'scale-up', name: 'Scale Up Capacity', description: 'Add 50% capacity to the struggling service', kind: 'scale-up' },
  { id: 'throttle', name: 'Throttle Intake', description: 'Cap incoming requests at 75% — graceful degradation', kind: 'throttle' },
  { id: 'circuit-breaker', name: 'Open Circuit Breaker', description: 'Sever the toxic dependency edge — fail fast instead of piling up', kind: 'circuit-breaker' },
  { id: 'cache-bypass', name: 'Bypass Cache Layer', description: 'Route around the cache — DBs absorb the load, stampede contained', kind: 'cache-bypass' },
]

const COST: Record<string, number> = {
  restart: 25,
  failover: 35,
  'shed-load': 45,
  'scale-up': 30,
  throttle: 40,
  'circuit-breaker': 20,
  'cache-bypass': 15,
}

interface AbstractState {
  util: number[]
  failed: boolean[]
  failedAt: number[] // step index when failed, -1 if never
}

const STEP_MS = 5_000
const HORIZON_STEPS = 144 // 12 sim-min
const ROLLOUTS = 30

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function projectStrategies(input: DiagnosticsInput): StrategyProjection[] {
  const incident = input.incidents.find((i) => i.resolvedAt === undefined)
  if (!incident) return []

  const nodes = input.topology.nodes
  const idx = new Map<ServiceId, number>(nodes.map((n, i) => [n.id, i]))
  const edges = input.topology.edges

  // initial abstract state from live telemetry
  const initial: AbstractState = {
    util: nodes.map((n) => input.services[n.id]?.metrics.cpu ?? 0.2),
    failed: nodes.map((n) => input.services[n.id]?.metrics.failed ?? false),
    failedAt: nodes.map((n) => (input.services[n.id]?.metrics.failed ? 0 : -1)),
  }
  const initiallyFailed = initial.failed.filter(Boolean).length
  const originIdx = incident.origin ? (idx.get(incident.origin) ?? 0) : 0
  const capBase = nodes.map((n) => n.capacity)
  // demand proxy: current rps, routed demand stays roughly constant per rollout
  const demand = nodes.map((n) => input.services[n.id]?.metrics.rps ?? n.capacity * 0.5)

  const runRollout = (strategy: string | null, seed: number) => {
    const r = rng(seed)
    const st: AbstractState = { util: [...initial.util], failed: [...initial.failed], failedAt: [...initial.failedAt] }
    const caps = [...capBase]
    const dem = [...demand]
    let breakerEdge: { from: number; to: number } | null = null

    // apply strategy effects at t0
    if (strategy) {
      const [kind, targetId] = strategy.split(':')
      const ti = targetId ? (idx.get(targetId) ?? -1) : -1
      if (kind === 'scale-up' && ti >= 0) caps[ti] *= 1.5
      if (kind === 'failover' && ti >= 0) {
        caps[ti] *= 1.8
        st.failed[ti] = false
        st.failedAt[ti] = -1
      }
      if (kind === 'restart' && ti >= 0) {
        st.util[ti] = 0.35
        // brief downtime then clean
        st.failed[ti] = false
        st.failedAt[ti] = -1
      }
      if (kind === 'shed-load') dem[0] *= 0.6
      if (kind === 'throttle') dem[0] *= 0.75
      if (kind === 'circuit-breaker') {
        // cut heaviest edge into origin
        let bestW = 0
        for (const e of edges) {
          if (e.to === incident.origin && e.weight > bestW) {
            bestW = e.weight
            breakerEdge = { from: idx.get(e.from) ?? 0, to: idx.get(e.to) ?? 0 }
          }
        }
      }
      if (kind === 'cache-bypass') {
        // redis out of path: its callers push load to their other deps
        for (const e of edges) if (nodes[idx.get(e.to) ?? 0]?.kind === 'cache') dem[idx.get(e.to) ?? 0] = 0
      }
    }

    let damage = 0
    let cascadeSize = 0
    let mttr = HORIZON_STEPS * STEP_MS

    for (let step = 0; step < HORIZON_STEPS; step++) {
      // demand flows along edges with retry amplification on failed callees
      for (const e of edges) {
        const fi = idx.get(e.from) ?? 0
        const ti = idx.get(e.to) ?? 0
        if (breakerEdge && breakerEdge.from === fi && breakerEdge.to === ti) continue
        if (st.failed[ti]) dem[fi] = dem[fi] * 1.002 + e.weight * 4 // retry pressure
      }
      for (let i = 0; i < nodes.length; i++) {
        if (st.failed[i]) {
          // natural recovery: overload-type failures heal, leak/oom rarely do
          const pRecover = nodes[i].kind === 'database' || nodes[i].kind === 'api' ? 0.004 : 0.015
          if (r() < pRecover) {
            st.failed[i] = false
            st.failedAt[i] = -1
            st.util[i] = 0.4
            mttr = Math.min(mttr, step * STEP_MS)
          } else {
            st.util[i] = Math.min(1.3, st.util[i])
          }
          continue
        }
        const u = dem[i] / Math.max(1, caps[i])
        st.util[i] = st.util[i] + (u - st.util[i]) * 0.5
        if (st.util[i] > 1.15 && r() < 0.25) {
          st.failed[i] = true
          st.failedAt[i] = step
        }
        // degradation damage
        const health = st.util[i] > 0.8 ? 1 - (st.util[i] - 0.8) * 2.5 : 1
        damage += nodes[i].criticality * (1 - Math.max(0, health)) * (STEP_MS / 1000)
      }
      if (strategy?.startsWith('restart') && step === 3) {
        const ti = idx.get(strategy.split(':')[1] ?? '') ?? -1
        if (ti >= 0) st.util[ti] = Math.min(st.util[ti], 0.45)
      }
    }

    const newFailures = st.failed.filter((f, i) => f && !initial.failed[i]).length
    const endFailed = st.failed.filter(Boolean).length
    cascadeSize = endFailed
    return { newFailures, endFailed, damage, cascadeSize, mttr: st.failed.every((f) => !f) ? mttr : HORIZON_STEPS * STEP_MS }
  }

  // ---- no-action baseline ----
  let baseContained = 0
  let baseDamage = 0
  let baseSize = 0
  for (let i = 0; i < ROLLOUTS; i++) {
    const out = runRollout(null, input.tick * 131 + i * 17)
    if (out.newFailures === 0) baseContained++
    baseDamage += out.damage
    baseSize += out.cascadeSize
  }

  // ---- strategy projections ----
  const projections: StrategyProjection[] = [
    {
      strategyId: 'no-action',
      successProbability: Number((baseContained / ROLLOUTS).toFixed(2)),
      expectedCascadeSize: Number((baseSize / ROLLOUTS).toFixed(1)),
      expectedDamage: Math.round(baseDamage / ROLLOUTS),
      mttrMs: HORIZON_STEPS * STEP_MS,
      cost: 0,
      verdict: 'not-recommended',
      rationale: `Unmitigated: cascade contained in only ${Math.round((baseContained / ROLLOUTS) * 100)}% of rollouts, ~${Math.round(baseDamage / ROLLOUTS / 1000)}k user-seconds damage.`,
    },
  ]

  for (const strat of STRATEGY_CATALOG) {
    // target selection mirrors the engine: incident origin for service-level actions
    let target: ServiceId | undefined
    if (strat.kind === 'restart' || strat.kind === 'failover' || strat.kind === 'scale-up') target = incident.origin
    if (strat.kind === 'shed-load' || strat.kind === 'throttle') target = nodes.find((n) => n.kind === 'gateway')?.id
    if (strat.kind === 'circuit-breaker') target = incident.origin
    if (strat.kind === 'cache-bypass') target = nodes.find((n) => n.kind === 'cache')?.id
    if (strat.kind === 'cache-bypass' && !target) continue

    const id = `${strat.kind}:${target ?? 'cluster'}`
    let contained = 0
    let damage = 0
    let size = 0
    let mttr = 0
    for (let i = 0; i < ROLLOUTS; i++) {
      const out = runRollout(id, input.tick * 131 + i * 17 + 7)
      if (out.newFailures === 0 && out.endFailed <= initiallyFailed) contained++
      damage += out.damage
      size += out.cascadeSize
      mttr += out.mttr
    }
    const success = contained / ROLLOUTS
    const avgDamage = damage / ROLLOUTS
    const cost = COST[strat.kind] + (target === incident.origin ? 10 : 0)
    const score = success - 0.25 * (cost / 100) - 0.1 * (avgDamage / 50_000)
    const verdict: StrategyProjection['verdict'] =
      success >= 0.5 && score >= Math.max(0.35, 0) ? 'recommended' : score >= 0.3 ? 'viable' : 'not-recommended'

    projections.push({
      strategyId: id,
      successProbability: Number(success.toFixed(2)),
      expectedCascadeSize: Number((size / ROLLOUTS).toFixed(1)),
      expectedDamage: Math.round(avgDamage),
      mttrMs: Math.round(mttr / ROLLOUTS),
      cost,
      verdict,
      rationale: `Contains cascade in ${Math.round(success * 100)}% of ${ROLLOUTS} rollouts · ~${Math.round(avgDamage / 1000)}k user-seconds damage (vs ${Math.round(baseDamage / ROLLOUTS / 1000)}k unabated) · MTTR ~${Math.round(mttr / ROLLOUTS / 1000)}s${target ? ` on ${target}` : ''}.`,
    })
  }

  // sort: recommended first, then by success×(1-cost)
  const rank = (p: StrategyProjection) => (p.verdict === 'recommended' ? 2 : p.verdict === 'viable' ? 1 : 0) * 1000 + p.successProbability * 100 - p.cost
  return projections.sort((a, b) => rank(b) - rank(a))
}
