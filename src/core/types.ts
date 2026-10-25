// ============================================================
// CascadeGuard — Shared Contracts (v1 — FROZEN for parallel build)
// Every module codes strictly against these types.
// ============================================================

export type ServiceId = string

export type ServiceKind =
  | 'gateway'
  | 'api'
  | 'database'
  | 'cache'
  | 'queue'
  | 'worker'
  | 'storage'
  | 'external'

export type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'failed' | 'recovering'

export interface ServiceNode {
  id: ServiceId
  name: string
  kind: ServiceKind
  /** requests/sec the service can handle at nominal health */
  capacity: number
  /** 0..1 business impact if this service goes down */
  criticality: number
  replicas: number
  /** fixed SVG layout position (deterministic, no physics sim) */
  layout: { x: number; y: number }
}

export interface DependencyEdge {
  /** caller */
  from: ServiceId
  /** callee */
  to: ServiceId
  /** fraction of caller's requests that hit this dependency (0..1] */
  weight: number
  /** hard dependency (true) vs optional/best-effort (false) */
  critical: boolean
}

export interface ServiceTopology {
  nodes: ServiceNode[]
  edges: DependencyEdge[]
}

// ---------------- Logs ----------------

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export interface LogEvent {
  id: number
  /** simulation time, ms since sim start */
  ts: number
  service: ServiceId
  level: LogLevel
  message: string
  /** stable machine code, e.g. ERR_DB_POOL_EXHAUSTED */
  code?: string
  traceId?: string
  latencyMs?: number
}

// ---------------- Metrics & State ----------------

export interface ServiceMetrics {
  service: ServiceId
  ts: number
  /** incoming requests/sec */
  rps: number
  latencyP50: number
  latencyP99: number
  /** 0..1 */
  errorRate: number
  /** 0..1+ (may exceed 1 under overload) */
  cpu: number
  memory: number
  /** pool/queue utilization 0..1+ */
  saturation: number
  healthy: boolean
  /** ground-truth hard-down flag — AI must NOT read this; UI/accuracy may */
  failed: boolean
}

export interface ServiceState extends ServiceNode {
  status: ServiceStatus
  metrics: ServiceMetrics
  /** rolling window of recent metrics (oldest first) */
  history: ServiceMetrics[]
  /**
   * Observed-healthy baseline: the best (lowest) values this service has
   * ever shown. Kept outside the rolling history so anomaly detection
   * stays anchored to "healthy" even after the window has slid past it.
   */
  baseline: {
    errorRate: number
    saturation: number
    latencyP99: number
    memory: number
  }
}

// ---------------- AI: Prediction ----------------

export interface RiskDriver {
  label: string
  /** 0..1 contribution to the risk score */
  contribution: number
}

export interface RiskAssessment {
  service: ServiceId
  ts: number
  /** 0..1 probability of failure within horizon */
  risk: number
  /** risks above threshold are active predictions */
  predicted: boolean
  drivers: RiskDriver[]
  /** estimated time to failure in sim-ms, if predictable */
  ttfMs?: number
}

// ---------------- AI: Root Cause ----------------

export interface RootCauseHypothesis {
  /** suspected origin service */
  service: ServiceId
  /** 0..1 */
  confidence: number
  /** propagation path from origin to most-affected service */
  chain: ServiceId[]
  /** human-readable evidence lines */
  evidence: string[]
}

// ---------------- AI: Recovery ----------------

export type RecoveryKind =
  | 'restart'
  | 'failover'
  | 'shed-load'
  | 'scale-up'
  | 'throttle'
  | 'circuit-breaker'
  | 'cache-bypass'

export interface RecoveryStrategy {
  id: string
  name: string
  description: string
  kind: RecoveryKind
  /** service the action targets (if any) */
  target?: ServiceId
}

export interface StrategyProjection {
  strategyId: string
  /** Monte Carlo: probability the cascade is contained within horizon */
  successProbability: number
  /** avg number of services affected if cascade runs its course */
  expectedCascadeSize: number
  /** user-seconds of degraded experience if not applied */
  expectedDamage: number
  /** estimated time to restore, sim-ms */
  mttrMs: number
  /** 0..100 relative cost (traffic shed, spend, user impact) */
  cost: number
  verdict: 'recommended' | 'viable' | 'not-recommended'
  rationale: string
}

export interface AppliedStrategy {
  strategyId: string
  ts: number
  /** filled after the sim observes the outcome */
  outcome?: 'contained' | 'partial' | 'ineffective'
}

// ---------------- Incidents & Alerts ----------------

export interface Incident {
  id: string
  startedAt: number
  resolvedAt?: number
  origin?: ServiceId
  services: ServiceId[]
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3'
  title: string
}

export interface Alert {
  id: string
  ts: number
  severity: 'info' | 'warning' | 'critical'
  service?: ServiceId
  message: string
}

// ---------------- Accuracy (live model evaluation) ----------------

export interface AccuracyStats {
  predictions: number
  hits: number
  falseAlarms: number
  missed: number
  /** avg warning time before actual failure, sim-ms */
  avgLeadTimeMs: number
  precision: number
  recall: number
}

// ---------------- Scenarios ----------------

export interface ScenarioDef {
  id: string
  name: string
  /** one-liner shown in the selector */
  tagline: string
  /** longer explanation for judges */
  description: string
  /** sim-ms after start when the fault begins */
  faultStartMs: number
}

// ---------------- Prediction Ledger (proof of prediction) ----------------

export interface PredictionLedgerEntry {
  id: string
  service: ServiceId
  /** sim-ms when the prediction was raised */
  madeAt: number
  risk: number
  ttfMs?: number
  outcome: 'confirmed' | 'false-alarm' | 'pending'
  /** sim-ms of the actual failure (when confirmed) */
  failedAt?: number
  /** warning time before the real failure */
  leadTimeMs?: number
}

// ---------------- Business impact / SLO ----------------

export interface SloImpact {
  /** 0..1 share of critical business flow currently degraded */
  userImpactPct: number
  /** error-budget burn multiplier (1 = normal) */
  sloBurnRate: number
  /** estimated $ at risk per minute */
  revenueAtRiskPerMin: number
  /** services currently degraded or failed */
  affectedServices: number
  severity: 'nominal' | 'elevated' | 'critical'
}

// ---------------- Simulation Snapshot (UI contract) ----------------

export interface SimulationSnapshot {
  tick: number
  simTime: number
  running: boolean
  speed: number
  scenarioId: string
  services: Record<ServiceId, ServiceState>
  /** recent log window (capped, newest last) */
  logs: LogEvent[]
  incidents: Incident[]
  risks: Record<ServiceId, RiskAssessment>
  rootCauses: RootCauseHypothesis[]
  projections: StrategyProjection[]
  appliedStrategies: AppliedStrategy[]
  accuracy: AccuracyStats
  alerts: Alert[]
  /** chronological proof of every prediction raised */
  ledger: PredictionLedgerEntry[]
  /** live business-impact snapshot */
  impact: SloImpact
}

// ---------------- Engine & Diagnostics contracts ----------------

/** Context handed to AI modules each tick. Ground truth `failed` exists
 *  on ServiceState.metrics but AI modules must not use it. */
export interface DiagnosticsInput {
  tick: number
  simTime: number
  topology: ServiceTopology
  services: Record<ServiceId, ServiceState>
  logs: LogEvent[]
  incidents: Incident[]
}

export type PredictFn = (
  input: DiagnosticsInput,
  prev: Record<ServiceId, RiskAssessment>,
) => Record<ServiceId, RiskAssessment>

export type RootCauseFn = (input: DiagnosticsInput) => RootCauseHypothesis[]

export type RecoveryFn = (input: DiagnosticsInput) => StrategyProjection[]

export type AccuracyFn = (
  input: DiagnosticsInput,
  risks: Record<ServiceId, RiskAssessment>,
) => AccuracyStats

export interface Diagnostics {
  predict: PredictFn
  rootCause: RootCauseFn
  recovery: RecoveryFn
  accuracy: AccuracyFn
}

export interface SimulationEngine {
  /** start the internal real-time loop (real 600ms per tick) */
  start(): void
  pause(): void
  resume(): void
  isRunning(): boolean
  /** 1 = one sim-step (3s) per tick; 2/4 = faster */
  setSpeed(mult: number): void
  loadScenario(id: string, seed?: number): void
  applyStrategy(strategyId: string): void
  snapshot(): SimulationSnapshot
  subscribe(cb: (s: SimulationSnapshot) => void): () => void
}

// ---------------- Tuning constants (shared truth) ----------------

export const SIM = {
  /** real ms per engine tick */
  TICK_REAL_MS: 600,
  /** sim ms advanced per step */
  SIM_MS_PER_STEP: 3000,
  /** prediction horizon, sim ms */
  RISK_HORIZON_MS: 300_000,
  /** risk above this counts as an active prediction */
  RISK_THRESHOLD: 0.55,
  /** max log events kept */
  LOG_WINDOW: 500,
  /** metrics samples per service kept */
  HISTORY_WINDOW: 240,
} as const
