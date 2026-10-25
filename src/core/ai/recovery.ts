import type {
  DiagnosticsInput,
  RecoveryStrategy,
  ServiceId,
  StrategyProjection,
} from '../types'

// ============================================================
// Recovery Strategy Optimizer
//
// Monte-Carlo: every candidate action is replayed against an
// abstract flow model of the cluster (demand flows along the
// dependency edges, a saturated callee spills queue pressure back
// onto its callers, a failed callee attracts retry amplification).
//
// Methodology: the no-action baseline and every strategy are
// replayed with the SAME random seeds (common random numbers),
// so the difference in outcomes is attributable to the action
// and not to sampling noise.
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

/** Topological order (callers before callees) so demand flows downstream correctly. */
function topoOrder(nodeIds: ServiceId[], edges: Array<{ from: ServiceId; to: ServiceId }>): ServiceId[] {
  const indeg = new Map<ServiceId, number>(nodeIds.map((n) => [n, 0]))
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  const queue = nodeIds.filter((n) => (indeg.get(n) ?? 0) === 0)
  const out: ServiceId[] = []
  while (queue.length > 0) {
    const n = queue.shift()!
    out.push(n)
    for (const e of edges) {
      if (e.from !== n) continue
      const v = (indeg.get(e.to) ?? 1) - 1
      indeg.set(e.to, v)
      if (v === 0) queue.push(e.to)
    }
  }
  // cycles (should not happen) — append the rest
  for (const n of nodeIds) if (!out.includes(n)) out.push(n)
  return out
}

export function projectStrategies(input: DiagnosticsInput): StrategyProjection[] {
  const incident = input.incidents.find((i) => i.resolvedAt === undefined)
  if (!incident) return []

  const nodes = input.topology.nodes
  const edges = input.topology.edges
  const idx = new Map<ServiceId, number>(nodes.map((n, i) => [n.id, i]))
  const order = topoOrder(nodes.map((n) => n.id), edges)

  // initial stress: a blend of CPU and saturation, capped so that no
  // service is doomed before the strategy has a chance to act
  const initialUtil = nodes.map((n) => {
    const s = input.services[n.id]
    if (!s) return 0.2
    return Math.min(1.1, 0.5 * s.metrics.cpu + 0.5 * s.metrics.saturation)
  })
  const initialFailed = nodes.map((n) => input.services[n.id]?.metrics.failed ?? false)
  const initiallyFailed = initialFailed.filter(Boolean).length
  const capBase = nodes.map((n) => n.capacity)
  // Normalise the starting load: live rps already contains the pile-up of a
  // cascade in progress, which would make every strategy look equally futile.
  // We start each service just below its safety line and let the model
  // reproduce the cascade from there.
  const demand = nodes.map((n, i) => {
    const live = input.services[n.id]?.metrics.rps ?? n.capacity * 0.5
    return Math.min(live, capBase[i]! * 0.9)
  })
  const originIdx = incident.origin ? (idx.get(incident.origin) ?? 0) : 0
  const gatewayIdx = nodes.findIndex((n) => n.kind === 'gateway')
  const cacheIdx = nodes.findIndex((n) => n.kind === 'cache')
  const callersOfCache = new Set(edges.filter((e) => nodes[idx.get(e.to) ?? 0]?.kind === 'cache').map((e) => e.from))

  const runRollout = (strategy: string | null, seed: number) => {
    const r = rng(seed)
    const util = [...initialUtil]
    const failed = [...initialFailed]
    const failedAt = nodes.map(() => -1)
    const caps = [...capBase]
    const dem = [...demand]
    const processed = nodes.map(() => 0)
    let breakerEdge: { from: number; to: number } | null = null
    let cacheBypassed = false

    // ---- strategy effects at t0 ----
    if (strategy) {
      const [kind, targetId] = strategy.split(':')
      const ti = targetId ? (idx.get(targetId) ?? -1) : -1
      if (kind === 'scale-up' && ti >= 0) caps[ti] *= 1.5
      if (kind === 'failover' && ti >= 0) {
        caps[ti] *= 1.8
        failed[ti] = false
        failedAt[ti] = -1
      }
      if (kind === 'restart' && ti >= 0) {
        util[ti] = 0.35
        failed[ti] = false
        failedAt[ti] = -1
      }
      if (kind === 'shed-load' && gatewayIdx >= 0) dem[gatewayIdx] *= 0.6
      if (kind === 'throttle' && gatewayIdx >= 0) dem[gatewayIdx] *= 0.75
      if (kind === 'circuit-breaker') {
        // sever the heaviest edge INTO the origin: its callers stop piling up
        let bestW = 0
        for (const e of edges) {
          const to = idx.get(e.to) ?? -1
          if (to === originIdx && e.weight > bestW) {
            bestW = e.weight
            breakerEdge = { from: idx.get(e.from) ?? 0, to }
          }
        }
      }
      if (kind === 'cache-bypass' && cacheIdx >= 0) {
        // the cache stops serving — its traffic is pushed onto the datastores
        cacheBypassed = true
        dem[cacheIdx] = 0
        for (const e of edges) {
          const to = idx.get(e.to) ?? -1
          if (nodes[to]?.kind === 'cache') {
            const from = idx.get(e.from) ?? -1
            for (const e2 of edges) {
              if ((idx.get(e2.from) ?? -1) === from && (idx.get(e2.to) ?? -1) !== to) {
                dem[idx.get(e2.to) ?? 0] += demand[to] * e2.weight
              }
            }
          }
        }
      }
    }

    let damage = 0
    let mttr = HORIZON_STEPS * STEP_MS

    for (let step = 0; step < HORIZON_STEPS; step++) {
      // --- queue spillover + retry pressure travels up the dependency edges ---
      for (const e of edges) {
        const fi = idx.get(e.from) ?? 0
        const ti = idx.get(e.to) ?? 0
        if (breakerEdge && breakerEdge.from === fi && breakerEdge.to === ti) continue
        if (cacheBypassed && nodes[ti]?.kind === 'cache') continue
        const spill = util[ti] > 0.85 ? (util[ti] - 0.85) * 0.45 : 0
        const retry = failed[ti] ? 0.06 : 0
        dem[fi] += processed[fi] * e.weight * (spill + retry)
      }

      // --- flow the demand through the cluster in topological order ---
      for (const id of order) {
        const i = idx.get(id) ?? 0
        if (failed[i]) {
          processed[i] = 0
          const pRecover = nodes[i]?.kind === 'database' || nodes[i]?.kind === 'api' ? 0.004 : 0.015
          if (r() < pRecover) {
            failed[i] = false
            failedAt[i] = -1
            util[i] = 0.4
            mttr = Math.min(mttr, step * STEP_MS)
          }
          continue
        }
        const u = dem[i] / Math.max(1, caps[i])
        util[i] = util[i] + (u - util[i]) * 0.5
        // failure pressure grows with how far past the safety line we are
        if (util[i] > 1.15) {
          const pFail = Math.min(0.35, (util[i] - 1.15) * 0.5)
          if (r() < pFail) {
            failed[i] = true
            failedAt[i] = step
          }
        }
        processed[i] = Math.min(dem[i], caps[i] * 0.98)

        // degradation damage (user-seconds of degraded experience)
        const health = util[i] > 0.8 ? 1 - (util[i] - 0.8) * 2.5 : 1
        damage += (nodes[i]?.criticality ?? 0.5) * (1 - Math.max(0, health)) * (STEP_MS / 1000)
      }

      // a restart finishes its job after a short drain window
      if (strategy?.startsWith('restart')) {
        const ti = idx.get(strategy.split(':')[1] ?? '') ?? -1
        if (ti >= 0 && step === 3) {
          util[ti] = Math.min(util[ti], 0.45)
          failed[ti] = false
          failedAt[ti] = -1
        }
      }
    }

    const newFailures = failed.filter((f, i) => f && !initialFailed[i]).length
    const endFailed = failed.filter(Boolean).length
    return {
      newFailures,
      endFailed,
      damage,
      cascadeSize: endFailed,
      mttr: failed.every((f) => !f) ? mttr : HORIZON_STEPS * STEP_MS,
    }
  }

  // ---- paired rollouts: identical seeds for baseline and every strategy ----
  const seeds = Array.from({ length: ROLLOUTS }, (_, i) => input.tick * 131 + i * 17)

  let baseContained = 0
  let baseDamage = 0
  let baseSize = 0
  for (const seed of seeds) {
    const out = runRollout(null, seed)
    if (out.newFailures === 0) baseContained++
    baseDamage += out.damage
    baseSize += out.cascadeSize
  }
  const baseSuccess = baseContained / ROLLOUTS
  const baseAvgDamage = baseDamage / ROLLOUTS

  const projections: StrategyProjection[] = [
    {
      strategyId: 'no-action',
      successProbability: Number(baseSuccess.toFixed(2)),
      expectedCascadeSize: Number((baseSize / ROLLOUTS).toFixed(1)),
      expectedDamage: Math.round(baseAvgDamage),
      mttrMs: HORIZON_STEPS * STEP_MS,
      cost: 0,
      verdict: 'not-recommended',
      rationale: `Unmitigated: cascade contained in only ${Math.round(baseSuccess * 100)}% of ${ROLLOUTS} paired rollouts, ~${Math.round(baseAvgDamage / 1000)}k user-seconds of damage.`,
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
    for (const seed of seeds) {
      const out = runRollout(id, seed)
      if (out.newFailures === 0 && out.endFailed <= initiallyFailed) contained++
      damage += out.damage
      size += out.cascadeSize
      mttr += out.mttr
    }
    const success = contained / ROLLOUTS
    const avgDamage = damage / ROLLOUTS
    const cost = COST[strat.kind] + (target === incident.origin ? 10 : 0)
    const lift = success - baseSuccess
    const damageLift = baseAvgDamage - avgDamage
    // A strategy is only "recommended" if it beats doing nothing.
    const verdict: StrategyProjection['verdict'] =
      success >= 0.5 && lift > 0 && score(success, cost, avgDamage) > 0 ? 'recommended'
        : success >= 0.4 && lift >= 0 ? 'viable'
          : 'not-recommended'

    projections.push({
      strategyId: id,
      successProbability: Number(success.toFixed(2)),
      expectedCascadeSize: Number((size / ROLLOUTS).toFixed(1)),
      expectedDamage: Math.round(avgDamage),
      mttrMs: Math.round(mttr / ROLLOUTS),
      cost,
      verdict,
      rationale: `Contains cascade in ${Math.round(success * 100)}% of ${ROLLOUTS} paired rollouts (no-action: ${Math.round(baseSuccess * 100)}%) · ${lift >= 0 ? '+' : ''}${Math.round(lift * 100)}pt lift · ~${Math.round(avgDamage / 1000)}k user-seconds damage (${damageLift >= 0 ? 'saves' : 'costs'} ${Math.round(Math.abs(damageLift) / 1000)}k vs no-action) · MTTR ~${Math.round(mttr / ROLLOUTS / 1000)}s${target ? ` on ${target}` : ''}.`,
    })
  }

  // sort: recommended first, then by success×(1-cost)
  const rank = (p: StrategyProjection) =>
    (p.verdict === 'recommended' ? 2 : p.verdict === 'viable' ? 1 : 0) * 1000 + p.successProbability * 100 - p.cost
  return projections.sort((a, b) => rank(b) - rank(a))
}

function score(success: number, cost: number, damage: number): number {
  return success - 0.25 * (cost / 100) - 0.1 * (damage / 50_000)
}
