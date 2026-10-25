import type {
  Alert,
  AppliedStrategy,
  Diagnostics,
  Incident,
  LogEvent,
  PredictionLedgerEntry,
  RecoveryKind,
  RiskAssessment,
  ServiceId,
  ServiceMetrics,
  ServiceNode,
  ServiceState,
  ServiceStatus,
  ServiceTopology,
  SimulationEngine,
  SimulationSnapshot,
  SloImpact,
  StrategyProjection,
} from '../types'
import { SIM } from '../types'
import { generateLogs, mulberry32, type Rng } from './logs'
import { DEFAULT_SCENARIO } from './scenarios'

// ============================================================
// CascadeGuard digital-twin engine.
// Deterministic, seeded cluster simulation with realistic
// failure dynamics: queueing latency, retry amplification,
// pool pile-ups, memory leaks, cascading overloads.
// ============================================================

type FailureCause = 'leak' | 'oom' | 'overload' | 'blip' | 'error'

interface SimService {
  node: ServiceNode
  status: ServiceStatus
  metrics: ServiceMetrics
  history: ServiceMetrics[]
  /** observed-healthy baseline (lowest values ever seen) */
  baseline: { errorRate: number; saturation: number; latencyP99: number; memory: number }
  demand: number
  processed: number
  capacityMult: number
  demandMult: number
  demandCapMult: number | null
  demandCapUntil: number
  memory: number
  saturation: number
  backlog: number
  failedAt: number | null
  failureCause: FailureCause | null
  downtimeUntil: number
  recoveringUntil: number
  satStreak: number
  errStreak: number
  healthyStreak: number
  leakRate: number
  memLeakRate: number
  lastAlertStatus: ServiceStatus
  everPredicted: boolean
}

interface EngineState {
  tick: number
  simTime: number
  running: boolean
  speed: number
  scenarioId: string
  rng: Rng
  services: Map<ServiceId, SimService>
  logs: LogEvent[]
  logId: { n: number }
  incidents: Incident[]
  incidentSeq: number
  alerts: Alert[]
  alertSeq: number
  risks: Record<ServiceId, RiskAssessment>
  rootCauses: ReturnType<Diagnostics['rootCause']>
  projections: StrategyProjection[]
  appliedStrategies: AppliedStrategy[]
  accuracy: SimulationSnapshot['accuracy']
  ledger: PredictionLedgerEntry[]
  ledgerSeq: number
}

const now = () => performance.now()

function freshMetrics(node: ServiceNode, ts: number): ServiceMetrics {
  return {
    service: node.id,
    ts,
    rps: 0,
    latencyP50: 12,
    latencyP99: 40,
    errorRate: 0,
    cpu: 0.1,
    memory: 0.3,
    saturation: 0.1,
    healthy: true,
    failed: false,
  }
}

function freshService(node: ServiceNode, ts: number): SimService {
  return {
    node,
    status: 'healthy',
    metrics: freshMetrics(node, ts),
    history: [],
    baseline: { errorRate: 0, saturation: 0.1, latencyP99: 1, memory: 0.3 },
    demand: 0,
    processed: 0,
    capacityMult: 1,
    demandMult: 1,
    demandCapMult: null,
    demandCapUntil: 0,
    memory: 0.3,
    saturation: 0.1,
    backlog: 0,
    failedAt: null,
    failureCause: null,
    downtimeUntil: 0,
    recoveringUntil: 0,
    satStreak: 0,
    errStreak: 0,
    healthyStreak: 0,
    leakRate: 0,
    memLeakRate: 0,
    lastAlertStatus: 'healthy',
    everPredicted: false,
  }
}

function zeroAccuracy(): SimulationSnapshot['accuracy'] {
  return { predictions: 0, hits: 0, falseAlarms: 0, missed: 0, avgLeadTimeMs: 0, precision: 0, recall: 0 }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function createEngine(topology: ServiceTopology, diagnostics: Diagnostics): SimulationEngine {
  const nodesById = new Map<ServiceId, ServiceNode>(topology.nodes.map((n) => [n.id, n]))
  const callersOf = new Map<ServiceId, { from: ServiceId; weight: number; critical: boolean }[]>()
  for (const e of topology.edges) {
    if (!callersOf.has(e.to)) callersOf.set(e.to, [])
    callersOf.get(e.to)!.push({ from: e.from, weight: e.weight, critical: e.critical })
  }
  const calleesOf = new Map<ServiceId, { to: ServiceId; weight: number; critical: boolean }[]>()
  for (const e of topology.edges) {
    if (!calleesOf.has(e.from)) calleesOf.set(e.from, [])
    calleesOf.get(e.from)!.push({ to: e.to, weight: e.weight, critical: e.critical })
  }
  const gatewayId = topology.nodes.find((n) => n.kind === 'gateway')?.id
  const apis = topology.nodes.filter((n) => n.kind === 'api').map((n) => n.id)

  let s: EngineState
  let timer: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<(snap: SimulationSnapshot) => void>()

  function reset(scenarioId: string, seed: number) {
    s = {
      tick: 0,
      simTime: 0,
      running: true,
      speed: 1,
      scenarioId,
      rng: mulberry32(seed),
      services: new Map(topology.nodes.map((n) => [n.id, freshService(n, 0)])),
      logs: [],
      logId: { n: 0 },
      incidents: [],
      incidentSeq: 0,
      alerts: [],
      alertSeq: 0,
      risks: {},
      rootCauses: [],
      projections: [],
      appliedStrategies: [],
      accuracy: zeroAccuracy(),
      ledger: [],
      ledgerSeq: 0,
    }
  }

  function alert(severity: Alert['severity'], message: string, service?: ServiceId) {
    s.alerts.push({ id: `al-${++s.alertSeq}`, ts: s.simTime, severity, service, message })
    if (s.alerts.length > 80) s.alerts.splice(0, s.alerts.length - 80)
  }

  // ---------------- fault dynamics per scenario ----------------

  function applyFaults() {
    const t = s.simTime
    for (const svc of s.services.values()) {
      svc.leakRate = 0
      svc.memLeakRate = 0
    }
    switch (s.scenarioId) {
      case 'pool-exhaustion': {
        const db = s.services.get('orders-db')
        if (db && t >= 45_000) {
          // connection leak: effective pool shrinks linearly to 25% over 5 sim-min
          const decay = clamp((t - 45_000) / 300_000, 0, 1)
          db.capacityMult = Math.min(db.capacityMult, 1 - 0.75 * decay)
          db.leakRate = 0.02 // saturation creep independent of load
          db.failureCause = db.failureCause ?? 'leak'
        }
        break
      }
      case 'memory-leak': {
        const api = s.services.get('payments-api')
        if (api && t >= 30_000 && api.failedAt === null) {
          api.memLeakRate = 0.011 // heap per step → OOM in ~3.4 sim-min
          api.failureCause = api.failureCause ?? 'oom'
        }
        break
      }
      case 'traffic-surge': {
        const gw = s.services.get(gatewayId ?? '')
        const redis = s.services.get('redis-cache')
        if (t >= 20_000 && t < 20_000 + 180_000) {
          // the spike ramps in over 120s — a flash crowd does not appear at once
          if (gw) gw.demandMult = 1 + 2 * clamp((t - 20_000) / 120_000, 0, 1)
          if (redis) redis.capacityMult = Math.min(redis.capacityMult, 0.45) // stampede evictions
        } else if (t >= 20_000 + 180_000) {
          if (gw) gw.demandMult = 1.05
        }
        break
      }
      case 'retry-storm': {
        const pdb = s.services.get('payments-db')
        if (pdb && t >= 25_000 && t < 25_000 + 30_000) {
          // the blip deepens over 20s, then heals — the retry storm outlives it
          const ramp = clamp((t - 25_000) / 20_000, 0, 1)
          pdb.capacityMult = 1 - 0.7 * ramp
          pdb.failureCause = pdb.failureCause ?? 'blip'
        } else if (pdb && t >= 25_000 + 30_000) {
          pdb.capacityMult = 1
        }
        break
      }
    }
  }

  /** retry amplification factor for caller→callee edge at current sim time */
  function retryFactorFor(from: SimService, to: SimService): number {
    if (s.scenarioId === 'retry-storm' && from.node.id === 'payments-api' && to.node.id === 'payments-db') {
      // the storm builds over 20s and outlives the blip by 30s
      if (s.simTime >= 25_000 && s.simTime <= 25_000 + 60_000) {
        return 3.0 * clamp((s.simTime - 25_000) / 20_000, 0.15, 1)
      }
    }
    if (to.status === 'failed') return 2.5
    // retries scale with the observed error rate — amplification ramps up
    // instead of appearing as a step change
    if (to.metrics.errorRate > 0.1) return 2.0 * Math.min(1, (to.metrics.errorRate - 0.1) / 0.4)
    return 0
  }

  function effectiveCapacity(svc: SimService): number {
    if (svc.failedAt !== null) return svc.node.capacity * 0.02
    if (s.simTime < svc.downtimeUntil) return 0
    let cap = svc.node.capacity * svc.capacityMult
    if (s.simTime < svc.recoveringUntil) cap *= 0.7
    if (svc.memLeakRate > 0 && svc.memory > 0.85) cap *= 1 - 0.6 * ((svc.memory - 0.85) / 0.15) // GC thrash
    return cap
  }

  // ---------------- one simulation step (3s sim time) ----------------

  function step() {
    s.simTime += SIM.SIM_MS_PER_STEP
    s.tick += 1
    applyFaults()
    const t = s.simTime
    const noise = 0.04

    // --- gateway demand ---
    const gw = gatewayId ? s.services.get(gatewayId) : undefined
    if (gw) {
      let demand = 0.55 * gw.node.capacity * gw.demandMult * (1 + (s.rng() - 0.5) * 2 * noise)
      if (gw.demandCapMult !== null && t < (gw.demandCapUntil ?? Infinity)) {
        demand = Math.min(demand, gw.demandCapMult * gw.node.capacity * gw.capacityMult)
      }
      gw.demand = demand
    }

    // --- process gateway ---
    if (gw) processService(gw)

    // --- apis: incoming from gateway ---
    for (const id of apis) {
      const svc = s.services.get(id)
      if (!svc || !gw) continue
      const edge = calleesOf.get(gw.node.id)?.find((e) => e.to === id)
      if (!edge) continue
      let incoming = gw.processed * edge.weight
      if (gw.failedAt !== null) incoming *= 0.15
      svc.demand = incoming
      processService(svc)
    }

    // --- data/infra services: incoming from all callers (with retries) ---
    for (const svc of s.services.values()) {
      if (svc.node.kind === 'gateway' || svc.node.kind === 'api') continue
      let incoming = 0
      for (const c of callersOf.get(svc.node.id) ?? []) {
        const caller = s.services.get(c.from)
        if (!caller) continue
        if (cutEdges.has(`${c.from}->${svc.node.id}`)) continue
        if (svc.node.kind === 'cache' && cacheBypassed) continue
        const rf = retryFactorFor(caller, svc)
        incoming += caller.processed * c.weight * (1 + rf)
        if (rf > 0) caller.backlog += caller.processed * c.weight * rf * 0.02
      }
      svc.demand = incoming
      processService(svc)
    }

    // --- backlog drain + status transitions ---
    for (const svc of s.services.values()) {
      svc.backlog = Math.max(0, svc.backlog * 0.72 - 2)
      updateStatus(svc)
    }
  }

  /** transient edge cuts (circuit-breaker) and cache bypass */
  const cutEdges = new Set<string>()
  let cacheBypassed = false

  function processService(svc: SimService) {
    const cap = Math.max(1, effectiveCapacity(svc))
    const util = svc.demand / cap
    svc.processed = Math.min(svc.demand, cap)

    // queueing-style latency
    const baseLat = svc.node.kind === 'database' ? 9 : svc.node.kind === 'cache' ? 1.2 : svc.node.kind === 'queue' ? 4 : 18
    const p50 = baseLat * (1 / Math.max(0.08, 1 - Math.pow(clamp(util, 0, 0.97), 2.2)))
    // errors ramp with overload: a soft knee at 70% utilisation, saturation
    // near 1.55x capacity. Hard failure needs *sustained* stress, not a spike.
    const errFromUtil = util > 0.7 ? Math.min(0.98, Math.pow((util - 0.7) / 0.55, 1.6)) : 0

    // error contribution from failing critical dependencies
    let depError = 0
    for (const e of calleesOf.get(svc.node.id) ?? []) {
      if (cutEdges.has(`${svc.node.id}->${e.to}`)) continue
      if (!e.critical) continue
      const dep = s.services.get(e.to)
      if (!dep) continue
      if (dep.node.kind === 'cache' && cacheBypassed) continue
      depError += e.weight * (dep.failedAt !== null ? 0.8 : dep.metrics.errorRate * 0.7)
    }
    const errorRate = svc.failedAt !== null ? 0.95 : clamp(Math.max(errFromUtil, depError * 0.6), 0, 0.98)

    // memory & saturation dynamics
    const pileup = 0.4 * Math.max(0, util - 0.9) + svc.backlog / (svc.backlog + 400)
    if (svc.memLeakRate > 0) {
      // a leak outpaces the GC: no steady state, the heap only grows
      svc.memory = clamp(svc.memory + svc.memLeakRate + pileup * 0.2, 0.05, 1.25)
    } else {
      // no leak: GC keeps the heap near baseline even under heavy load
      const loadPressure = Math.min(pileup, 0.02)
      svc.memory = clamp(svc.memory + (loadPressure - (svc.memory - 0.3)) * 0.25, 0.05, 1.25)
    }
    const targetSat = svc.node.kind === 'api' ? clamp(svc.backlog / 300, 0, 1.25) : clamp(util, 0, 1.25)
    svc.saturation = clamp(svc.saturation + (targetSat - svc.saturation) * 0.3 + svc.leakRate, 0.05, 1.3)

    svc.metrics = {
      service: svc.node.id,
      ts: s.simTime,
      rps: Math.round(svc.demand),
      latencyP50: Math.round(p50),
      latencyP99: Math.round(p50 * (3 + 6 * clamp(util, 0, 1))),
      errorRate: Number(errorRate.toFixed(3)),
      cpu: Number(clamp(util * 0.9 + 0.08, 0, 1.2).toFixed(3)),
      memory: Number(svc.memory.toFixed(3)),
      saturation: Number(svc.saturation.toFixed(3)),
      healthy: svc.failedAt === null && errorRate < 0.15 && util < 0.9,
      failed: svc.failedAt !== null,
    }

    // --- telemetry publication (every simulation step) ---
    // The AI layer consumes a full-resolution metric series, so its trend
    // features are invariant to playback speed (1×, 2×, 4× or headless 20×).
    svc.history.push({ ...svc.metrics })
    if (svc.history.length > SIM.HISTORY_WINDOW) svc.history.shift()

    // --- observed-healthy baseline ---
    // The lowest values this service has ever shown. Unlike the rolling
    // window this never slides past the healthy period, so anomaly
    // detection stays anchored no matter how long the run continues.
    svc.baseline.errorRate = Math.min(svc.baseline.errorRate, svc.metrics.errorRate)
    svc.baseline.saturation = Math.min(svc.baseline.saturation, svc.metrics.saturation)
    svc.baseline.latencyP99 = Math.min(svc.baseline.latencyP99, svc.metrics.latencyP99)
    svc.baseline.memory = Math.min(svc.baseline.memory, svc.metrics.memory)

    // --- failure conditions ---
    if (svc.failedAt === null && s.simTime >= svc.downtimeUntil) {
      if (svc.saturation >= 1.2) svc.satStreak++
      else svc.satStreak = 0
      if (errorRate >= 0.92) svc.errStreak++
      else svc.errStreak = 0
      const oom = svc.memory >= 1.05 && svc.memLeakRate > 0
      // sustained stress only: 18s of saturation or 15s of error storm.
      // OOM requires a genuine leak — overload alone must not fake it.
      if (oom || svc.satStreak >= 6 || svc.errStreak >= 5) {
        failService(svc, oom ? 'oom' : svc.failureCause ?? 'error')
      }
    }
  }

  function failService(svc: SimService, cause: FailureCause) {
    svc.failedAt = s.simTime
    svc.failureCause = cause
    svc.satStreak = 0
    svc.errStreak = 0
    svc.healthyStreak = 0
    alert('critical', `${svc.node.name} FAILED (${cause}) — downstream impact expected`, svc.node.id)
  }

  function updateStatus(svc: SimService) {
    const m = svc.metrics
    let next: ServiceStatus
    if (s.simTime < svc.downtimeUntil) next = 'failed'
    else if (svc.failedAt !== null) {
      // auto-recovery only for overload/blip causes (k8s restarts the pod)
      const auto = svc.failureCause === 'overload' || svc.failureCause === 'blip'
      if (auto && s.simTime - (svc.failedAt ?? 0) >= 45_000) {
        recoverService(svc)
        next = 'recovering'
      } else if (svc.failureCause === 'blip' && s.scenarioId === 'retry-storm' && s.simTime >= 55_000) {
        recoverService(svc)
        next = 'recovering'
      } else next = 'failed'
    } else if (s.simTime < svc.recoveringUntil) next = 'recovering'
    else if (m.errorRate > 0.15 || m.saturation > 0.9 || m.cpu > 0.95 || m.memory > 0.95) next = 'critical'
    else if (m.errorRate > 0.02 || m.saturation > 0.7 || m.cpu > 0.75 || m.memory > 0.85) next = 'degraded'
    else next = 'healthy'

    if (next === 'healthy') svc.healthyStreak++
    else svc.healthyStreak = 0
    svc.status = next

    if (next !== svc.lastAlertStatus) {
      if (next === 'critical') alert('warning', `${svc.node.name} critical — util ${(m.cpu * 100).toFixed(0)}%, err ${(m.errorRate * 100).toFixed(0)}%`, svc.node.id)
      if (next === 'degraded' && svc.lastAlertStatus === 'healthy') alert('warning', `${svc.node.name} degraded — latency ${m.latencyP99}ms p99`, svc.node.id)
      if (next === 'recovering') alert('info', `${svc.node.name} recovering`, svc.node.id)
      if (next === 'healthy' && svc.lastAlertStatus !== 'healthy') alert('info', `${svc.node.name} back to healthy`, svc.node.id)
      svc.lastAlertStatus = next
    }
  }

  function recoverService(svc: SimService) {
    svc.failedAt = null
    svc.failureCause = null
    svc.satStreak = 0
    svc.errStreak = 0
    svc.memory = 0.35
    svc.saturation = 0.2
    svc.backlog = 0
    svc.capacityMult = 1
    svc.recoveringUntil = s.simTime + 20_000
  }

  // ---------------- incidents ----------------

  function activeIncident(): Incident | null {
    return s.incidents.find((i) => i.resolvedAt === undefined) ?? null
  }

  function updateIncidents() {
    const failing = [...s.services.values()].filter((v) => v.failedAt !== null || v.metrics.errorRate > 0.5)
    const inc = activeIncident()
    if (!inc) {
      if (failing.length > 0) {
        const first = failing.reduce((a, b) => ((a.failedAt ?? Infinity) <= (b.failedAt ?? Infinity) ? a : b))
        const sev: Incident['severity'] = first.node.criticality >= 0.9 ? 'SEV-1' : 'SEV-2'
        const i: Incident = {
          id: `inc-${++s.incidentSeq}`,
          startedAt: s.simTime,
          origin: first.node.id,
          services: failing.map((f) => f.node.id),
          severity: sev,
          title: `Cascading outage originating at ${first.node.name}`,
        }
        s.incidents.push(i)
        alert('critical', `${sev}: ${i.title}`, first.node.id)
      }
      return
    }
    // grow incident
    for (const f of failing) {
      if (!inc.services.includes(f.node.id)) inc.services.push(f.node.id)
    }
    // resolve when every member has been healthy for a while
    const members = inc.services.map((id) => s.services.get(id)).filter(Boolean) as SimService[]
    if (members.length > 0 && members.every((m) => m.healthyStreak >= 10)) {
      inc.resolvedAt = s.simTime
      alert('info', `Incident resolved — all systems recovered (duration ${Math.round((s.simTime - inc.startedAt) / 1000)}s)`)
    }
  }

  // ---------------- diagnostics orchestration ----------------

  function buildInput() {
    const services: Record<ServiceId, ServiceState> = {}
    for (const svc of s.services.values()) {
      services[svc.node.id] = {
        ...svc.node,
        status: svc.status,
        metrics: { ...svc.metrics },
        history: svc.history.slice(-SIM.HISTORY_WINDOW),
        baseline: { ...svc.baseline },
      }
    }
    return {
      tick: s.tick,
      simTime: s.simTime,
      topology,
      services,
      logs: s.logs.slice(-SIM.LOG_WINDOW),
      incidents: s.incidents.map((i) => ({ ...i, services: [...i.services] })),
    }
  }

  /**
   * Prediction ledger — the auditable proof trail.
   * Every prediction raised by the AI is recorded, then resolved:
   *   confirmed   → the service actually failed (lead time = warning value)
   *   false-alarm → horizon elapsed with no failure
   */
  function updateLedger(risks: Record<ServiceId, RiskAssessment>) {
    for (const svc of s.services.values()) {
      const r = risks[svc.node.id]
      const open = s.ledger.find((e) => e.service === svc.node.id && e.outcome === 'pending')
      if (r?.predicted && !open && svc.failedAt === null) {
        s.ledger.push({
          id: `pl-${++s.ledgerSeq}`,
          service: svc.node.id,
          madeAt: s.simTime,
          risk: Number(r.risk.toFixed(3)),
          ttfMs: r.ttfMs,
          outcome: 'pending',
        })
        if (s.ledger.length > 60) s.ledger.splice(0, s.ledger.length - 60)
      }
      if (open) {
        if (svc.failedAt !== null) {
          open.outcome = 'confirmed'
          open.failedAt = s.simTime
          open.leadTimeMs = s.simTime - open.madeAt
        } else if (s.simTime - open.madeAt > SIM.RISK_HORIZON_MS) {
          open.outcome = 'false-alarm'
        }
      }
    }
  }

  /**
   * Business impact & SLO burn — turns telemetry into the language
   * executives and judges care about: user impact, error-budget burn,
   * and revenue at risk per minute.
   */
  function computeImpact(): SloImpact {
    let userImpact = 0
    let burn = 0
    let revenue = 0
    let affected = 0
    let criticalHit = false
    for (const svc of s.services.values()) {
      const m = svc.metrics
      const down = svc.failedAt !== null
      const unhealthy = down ? 1 : m.errorRate > 0.05 ? Math.min(1, m.errorRate * 3) : 0
      if (unhealthy > 0) affected++
      if (down && svc.node.criticality >= 0.9) criticalHit = true
      userImpact += svc.node.criticality * unhealthy
      burn += svc.node.criticality * (m.errorRate > 0.02 ? 1 + 4 * m.errorRate : 0)
      revenue += svc.node.criticality * unhealthy * 12_000 // $12k/min per criticality-weighted service
    }
    const pct = clamp(userImpact, 0, 1)
    return {
      userImpactPct: Number(pct.toFixed(3)),
      sloBurnRate: Number(clamp(1 + burn, 1, 20).toFixed(2)),
      revenueAtRiskPerMin: Math.round(revenue),
      affectedServices: affected,
      severity: criticalHit || pct > 0.5 ? 'critical' : pct > 0.15 ? 'elevated' : 'nominal',
    }
  }

  function runDiagnostics() {
    const input = buildInput()
    try {
      const risks = diagnostics.predict(input, s.risks) ?? {}
      // prediction alerts on threshold crossings
      for (const [id, r] of Object.entries(risks)) {
        const svc = s.services.get(id)
        if (!svc) continue
        if (r.predicted && !svc.everPredicted) {
          svc.everPredicted = true
          alert('warning', `PREDICTION: ${svc.node.name} may fail within ${SIM.RISK_HORIZON_MS / 1000}s (risk ${(r.risk * 100).toFixed(0)}%${r.ttfMs ? `, TTF ~${Math.round(r.ttfMs / 1000)}s` : ''})`, id)
        } else if (!r.predicted) {
          svc.everPredicted = false
        }
      }
      s.risks = risks
      updateLedger(risks)
      s.rootCauses = diagnostics.rootCause(input) ?? []
      s.projections = activeIncident() ? (diagnostics.recovery(input) ?? []) : []
      s.accuracy = diagnostics.accuracy(input, s.risks) ?? zeroAccuracy()
    } catch (e) {
      // diagnostics must never crash the simulation — surface for debugging
      alert('info', `diagnostics: ${String(e).slice(0, 120)}`)
    }
  }

  // ---------------- strategies ----------------

  const STRAT_NAMES: Record<RecoveryKind, string> = {
    restart: 'Drain & restart',
    failover: 'Failover to standby',
    'shed-load': 'Shed non-critical load',
    'scale-up': 'Scale up capacity',
    throttle: 'Throttle intake',
    'circuit-breaker': 'Open circuit breaker',
    'cache-bypass': 'Bypass cache layer',
  }
  const STRAT_COST: Record<RecoveryKind, number> = {
    restart: 25,
    failover: 35,
    'shed-load': 45,
    'scale-up': 30,
    throttle: 40,
    'circuit-breaker': 20,
    'cache-bypass': 15,
  }

  function strategyKind(id: string): RecoveryKind | null {
    const head = id.split(/[:_|]/)[0]
    if (head in STRAT_NAMES) return head as RecoveryKind
    for (const k of Object.keys(STRAT_NAMES) as RecoveryKind[]) if (id.includes(k)) return k
    return null
  }

  function applyStrategy(strategyId: string) {
    const kind = strategyKind(strategyId)
    if (!kind) return
    const inc = activeIncident()
    const origin = inc?.origin
    const worst = [...s.services.values()]
      .filter((v) => v.failedAt !== null || v.status === 'critical')
      .sort((a, b) => (b.failedAt ?? 0) - (a.failedAt ?? 0))[0]
    const targetId =
      kind === 'shed-load' || kind === 'throttle'
        ? gatewayId
        : kind === 'circuit-breaker'
          ? origin
          : kind === 'cache-bypass'
            ? 'redis-cache'
            : (origin ?? worst?.node.id)
    const target = targetId ? s.services.get(targetId) : undefined

    switch (kind) {
      case 'restart':
        if (target) {
          target.downtimeUntil = s.simTime + 15_000
          target.memory = 0.3
          target.saturation = 0.15
          target.backlog = 0
          target.capacityMult = 1
          target.recoveringUntil = s.simTime + 35_000
        }
        break
      case 'failover':
        if (target) {
          target.capacityMult = Math.max(target.capacityMult, 1.8)
          target.backlog *= 0.5
          target.recoveringUntil = 0
        }
        break
      case 'scale-up':
        if (target) target.capacityMult = Math.max(target.capacityMult, 1.5)
        break
      case 'shed-load':
        if (target) {
          target.demandMult *= 0.6
          target.demandCapMult = 0.65
          target.demandCapUntil = s.simTime + 300_000
        }
        break
      case 'throttle':
        if (target) {
          target.demandCapMult = 0.75
          target.demandCapUntil = s.simTime + 300_000
        }
        break
      case 'circuit-breaker': {
        // cut the heaviest edge into the origin from a still-healthy caller
        let best: { from: ServiceId; w: number } | null = null
        for (const c of callersOf.get(targetId ?? '') ?? []) {
          const caller = s.services.get(c.from)
          if (!caller || caller.failedAt !== null) continue
          if (best === null || c.weight > best.w) best = { from: c.from, w: c.weight }
        }
        if (best) {
          cutEdges.add(`${best.from}->${targetId}`)
          const caller = s.services.get(best.from)
          if (caller) caller.metrics.errorRate = clamp(caller.metrics.errorRate + 0.05, 0, 0.98)
        }
        break
      }
      case 'cache-bypass':
        cacheBypassed = true
        break
    }
    s.appliedStrategies.push({ strategyId, ts: s.simTime })
    alert('info', `Recovery action applied: ${STRAT_NAMES[kind]}${target ? ` → ${target.node.name}` : ''}`)
  }

  function evaluateStrategyOutcomes() {
    for (const ap of s.appliedStrategies) {
      if (ap.outcome !== undefined) continue
      if (s.simTime - ap.ts < 180_000) continue
      const newFailures = [...s.services.values()].filter((v) => v.failedAt !== null && (v.failedAt ?? 0) > ap.ts)
      ap.outcome = newFailures.length === 0 ? 'contained' : newFailures.length <= 1 ? 'partial' : 'ineffective'
      alert(ap.outcome === 'contained' ? 'info' : 'warning', `Strategy outcome: ${ap.outcome} (${newFailures.length} new failures since application)`)
    }
  }

  // ---------------- public API ----------------

  function snapshot(): SimulationSnapshot {
    const services: Record<ServiceId, ServiceState> = {}
    for (const svc of s.services.values()) {
      services[svc.node.id] = {
        ...svc.node,
        status: svc.status,
        metrics: { ...svc.metrics },
        history: svc.history.slice(-SIM.HISTORY_WINDOW),
        baseline: { ...svc.baseline },
      }
    }
    return {
      tick: s.tick,
      simTime: s.simTime,
      running: s.running,
      speed: s.speed,
      scenarioId: s.scenarioId,
      services,
      logs: s.logs.slice(-SIM.LOG_WINDOW),
      incidents: s.incidents.map((i) => ({ ...i, services: [...i.services] })),
      risks: { ...s.risks },
      rootCauses: s.rootCauses,
      projections: s.projections,
      appliedStrategies: [...s.appliedStrategies],
      accuracy: { ...s.accuracy },
      alerts: s.alerts.slice(-60),
      ledger: s.ledger.map((e) => ({ ...e })),
      impact: computeImpact(),
    }
  }

  function tickOnce() {
    if (!s.running) return
    for (let i = 0; i < s.speed; i++) step()
    updateIncidents()
    evaluateStrategyOutcomes()
    runDiagnostics()
    // generate logs for the last step's state
    for (const svc of s.services.values()) {
      const ctx = {
        service: svc.node.id,
        kind: svc.node.kind,
        util: svc.metrics.cpu,
        errorRate: svc.metrics.errorRate,
        latencyP50: svc.metrics.latencyP50,
        latencyP99: svc.metrics.latencyP99,
        memory: svc.metrics.memory,
        saturation: svc.metrics.saturation,
        failed: svc.failedAt !== null,
      }
      s.logs.push(...generateLogs(ctx, s.simTime, s.rng, s.logId))
    }
    if (s.logs.length > SIM.LOG_WINDOW) s.logs.splice(0, s.logs.length - SIM.LOG_WINDOW)
    const snap = snapshot()
    listeners.forEach((l) => l(snap))
  }

  function startLoop() {
    if (timer !== null) clearInterval(timer)
    timer = setInterval(tickOnce, SIM.TICK_REAL_MS)
  }

  const engine: SimulationEngine = {
    start() {
      startLoop()
    },
    pause() {
      s.running = false
    },
    resume() {
      s.running = true
    },
    isRunning() {
      return s.running
    },
    setSpeed(mult) {
      s.speed = mult
    },
    loadScenario(id, seed = 42) {
      reset(id, seed)
      cutEdges.clear()
      cacheBypassed = false
    },
    applyStrategy,
    snapshot,
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }

  reset(DEFAULT_SCENARIO, 42)
  return engine
}
