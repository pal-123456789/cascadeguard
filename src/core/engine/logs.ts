import type { LogEvent, LogLevel, ServiceId, ServiceKind } from '../types'

/** Deterministic PRNG (mulberry32) */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface LogEmitContext {
  service: ServiceId
  kind: ServiceKind
  /** 0..1+ utilization */
  util: number
  errorRate: number
  latencyP50: number
  latencyP99: number
  memory: number
  saturation: number
  failed: boolean
}

const TRACE_CHARS = 'abcdef0123456789'
function traceId(rng: Rng): string {
  let s = ''
  for (let i = 0; i < 16; i++) s += TRACE_CHARS[Math.floor(rng() * 16)]
  return s
}

interface Template {
  level: LogLevel
  code?: string
  msg: (c: LogEmitContext, rng: Rng) => string
}

const TEMPLATES: Record<ServiceKind, Template[]> = {
  gateway: [
    { level: 'INFO', msg: (c, r) => `GET /api/v2/bundle 200 ${Math.round(c.latencyP50 + r() * 8)}ms` },
    { level: 'INFO', msg: (c, r) => `POST /api/v2/checkout 201 ${Math.round(c.latencyP50 * 1.4)}ms` },
    { level: 'WARN', code: 'WARN_UPSTREAM_SLOW', msg: (c) => `upstream latency ${Math.round(c.latencyP50 * 2)}ms exceeds error budget` },
    { level: 'ERROR', code: 'ERR_UPSTREAM_502', msg: () => `502 upstream-error orders-api connection reset by peer` },
    { level: 'ERROR', code: 'ERR_GATEWAY_TIMEOUT', msg: (c) => `504 gateway timeout after ${Math.round(c.latencyP99)}ms` },
  ],
  api: [
    {
      level: 'INFO',
      msg: (c, r) =>
        c.service.startsWith('payments')
          ? `payment captured txn_${Math.floor(r() * 1e6)} ${Math.round(c.latencyP50)}ms`
          : c.service.startsWith('orders')
            ? `order created ord_${Math.floor(r() * 1e5)} ${Math.round(c.latencyP50)}ms`
            : c.service.startsWith('auth')
              ? `session validated ${Math.round(c.latencyP50)}ms`
              : `stock reservation ok ${Math.round(c.latencyP50)}ms`,
    },
    { level: 'DEBUG', msg: (c, r) => `trace ${traceId(r)} span complete` },
    { level: 'WARN', code: 'WARN_RETRY', msg: (c, r) => `retry attempt ${1 + Math.floor(r() * 4)}/5 trace ${traceId(r)}` },
    { level: 'WARN', code: 'WARN_DEP_LATENCY', msg: (c) => `dependency latency ${Math.round(c.latencyP50 * 3)}ms (budget exceeded)` },
    { level: 'ERROR', code: 'ERR_DOWNSTREAM_TIMEOUT', msg: (c) => `downstream timeout after ${Math.round(c.latencyP99)}ms` },
    { level: 'ERROR', code: 'ERR_CIRCUIT_OPEN', msg: () => `circuit breaker OPEN — failing fast` },
    { level: 'FATAL', code: 'ERR_OOM', msg: () => `FATAL: OutOfMemoryError — container OOMKilled` },
  ],
  database: [
    { level: 'DEBUG', msg: (c, r) => `query executed ${Math.round(4 + r() * 12)}ms rows=${Math.floor(r() * 200)}` },
    { level: 'WARN', code: 'WARN_POOL_HIGH', msg: (c) => `pool utilization ${(c.saturation * 100).toFixed(0)}% wait ${Math.round(c.saturation * 180)}ms` },
    { level: 'ERROR', code: 'ERR_DB_POOL_EXHAUSTED', msg: () => `HikariPool-1 — connection is not available, timed out after 30000ms` },
    { level: 'ERROR', code: 'ERR_LOCK_TIMEOUT', msg: () => `deadlock detected; transaction aborted (lock wait timeout)` },
    { level: 'FATAL', code: 'ERR_DB_DOWN', msg: () => `connection pool exhausted — rejecting all queries` },
  ],
  cache: [
    { level: 'DEBUG', msg: (c, r) => `GET key:user:${Math.floor(r() * 1e5)} ${r() < 0.8 ? 'HIT' : 'MISS'} 0.${Math.floor(r() * 9)}ms` },
    { level: 'WARN', code: 'WARN_EVICTIONS', msg: (c, r) => `evictions rising (${Math.floor(r() * 900 + 100)}/min) maxmemory pressure` },
    { level: 'ERROR', code: 'ERR_REDIS_MAXMEMORY', msg: () => `OOM command not allowed when used memory > 'maxmemory'` },
    { level: 'ERROR', code: 'ERR_CONN_REFUSED', msg: () => `connection refused — accept queue full` },
  ],
  queue: [
    { level: 'DEBUG', msg: (c, r) => `produce ack partition=${Math.floor(r() * 12)} offset=${Math.floor(r() * 1e6)}` },
    { level: 'WARN', code: 'WARN_CONSUMER_LAG', msg: (c, r) => `consumer lag ${Math.floor(1000 + r() * 40000)} msgs on orders-events` },
    { level: 'ERROR', code: 'ERR_PRODUCE_TIMEOUT', msg: () => `expiring 3 record(s) — produce timeout 30000ms` },
    { level: 'FATAL', code: 'ERR_BROKER_DOWN', msg: () => `broker unavailable — rejecting produces` },
  ],
  worker: [
    { level: 'INFO', msg: (c, r) => `job ${Math.floor(r() * 5000)} completed ${Math.round(c.latencyP50)}ms` },
    { level: 'WARN', code: 'WARN_QUEUE_DEPTH', msg: () => `queue depth above watermark` },
    { level: 'ERROR', code: 'ERR_JOB_FAILED', msg: () => `job failed — upstream unavailable` },
  ],
  storage: [
    { level: 'DEBUG', msg: (c, r) => `PUT object ${Math.floor(r() * 900)}kb ok` },
    { level: 'WARN', code: 'WARN_SLOW_IO', msg: () => `disk io latency elevated` },
    { level: 'ERROR', code: 'ERR_STORAGE_5XX', msg: () => `500 internal storage error` },
  ],
  external: [
    { level: 'INFO', msg: () => `webhook delivered` },
    { level: 'ERROR', code: 'ERR_429', msg: () => `429 rate limited by provider` },
  ],
}

function pickByLevel(list: Template[], rng: Rng, levels: LogLevel[]): Template {
  const filtered = list.filter((t) => levels.includes(t.level))
  const pool = filtered.length ? filtered : list
  return pool[Math.floor(rng() * pool.length)]
}

export function generateLogs(
  ctx: LogEmitContext,
  ts: number,
  rng: Rng,
  idAlloc: { n: number },
): LogEvent[] {
  const events: LogEvent[] = []
  const templates = TEMPLATES[ctx.kind] ?? TEMPLATES.api

  // volume scales with distress; failed services spam errors
  let count: number
  if (ctx.failed) count = 4 + Math.floor(rng() * 4)
  else if (ctx.errorRate > 0.3) count = 2 + Math.floor(rng() * 4)
  else if (ctx.util > 0.75) count = 1 + Math.floor(rng() * 3)
  else count = rng() < 0.55 ? 1 : 2

  for (let i = 0; i < count; i++) {
    const roll = rng()
    let tpl: Template
    if (ctx.failed) {
      tpl = roll < 0.6 ? pickByLevel(templates, rng, ['ERROR', 'FATAL']) : templates[Math.floor(rng() * templates.length)]
    } else if (ctx.errorRate > 0.2 || ctx.util > 0.9 || ctx.saturation > 0.9) {
      tpl = roll < 0.5 ? pickByLevel(templates, rng, ['WARN', 'ERROR', 'FATAL']) : templates[Math.floor(rng() * templates.length)]
    } else if (ctx.util > 0.7 || ctx.saturation > 0.7) {
      tpl = roll < 0.3 ? pickByLevel(templates, rng, ['WARN', 'ERROR']) : templates[Math.floor(rng() * templates.length)]
    } else {
      tpl = templates[Math.floor(rng() * Math.min(2, templates.length))]
    }
    events.push({
      id: ++idAlloc.n,
      ts,
      service: ctx.service,
      level: tpl.level,
      message: tpl.msg(ctx, rng),
      code: tpl.code,
      traceId: rng() < 0.5 ? traceId(rng) : undefined,
      latencyMs: Math.round(ctx.latencyP50 + rng() * Math.max(4, ctx.latencyP50)),
    })
  }
  return events
}
