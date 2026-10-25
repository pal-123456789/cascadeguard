import { memo } from 'react'
import { actions } from '../core/store'
import type { AppliedStrategy, ServiceState, StrategyProjection } from '../core/types'

export interface RecoveryPanelProps {
  projections: StrategyProjection[]
  appliedStrategies: AppliedStrategy[]
  services: Record<string, ServiceState>
}

/** RecoveryKind prefixes, longest first so 'circuit-breaker' wins over 'cache-bypass' etc. */
const KIND_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['circuit-breaker', 'Circuit Breaker'],
  ['cache-bypass', 'Cache Bypass'],
  ['shed-load', 'Shed Load'],
  ['scale-up', 'Scale Up'],
  ['failover', 'Failover'],
  ['restart', 'Restart'],
  ['throttle', 'Throttle'],
]

interface StrategyDesc {
  label: string
  target?: string
}

/** Derive a human label + target from a strategyId (projections carry ids only). */
function describeStrategy(id: string): StrategyDesc {
  const lower = id.toLowerCase()
  if (lower.replace(/[^a-z]/g, '') === 'noaction') return { label: 'No Action' }
  for (const [kind, label] of KIND_LABELS) {
    const next = lower[kind.length]
    if (lower.startsWith(kind) && (lower.length === kind.length || next === '-' || next === ':' || next === '_' || next === '|')) {
      const rest = id.slice(kind.length).replace(/^[-_:|]+/, '')
      return { label, target: rest.length > 0 ? rest : undefined }
    }
  }
  const cleaned = id.replace(/[-_:|]+/g, ' ').trim()
  return { label: cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : id }
}

const VERDICT_META: Record<StrategyProjection['verdict'], { label: string; chip: string; border: string; bar: string }> = {
  recommended: {
    label: 'RECOMMENDED',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    border: 'border-emerald-500/25 hover:border-emerald-500/50',
    bar: '#34d399',
  },
  viable: {
    label: 'VIABLE',
    chip: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    border: 'border-sky-500/20 hover:border-sky-500/45',
    bar: '#38bdf8',
  },
  'not-recommended': {
    label: 'NOT RECOMMENDED',
    chip: 'border-slate-600 bg-slate-800/50 text-slate-400',
    border: 'border-edge',
    bar: '#475569',
  },
}

const OUTCOME_META: Record<'contained' | 'partial' | 'ineffective', string> = {
  contained: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  partial: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  ineffective: 'border-red-500/40 bg-red-500/10 text-red-300',
}

const VERDICT_RANK: Record<StrategyProjection['verdict'], number> = {
  recommended: 0,
  viable: 1,
  'not-recommended': 2,
}

function fmtK(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${n >= 10_000 ? Math.round(n / 1000) : (n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function fmtSec(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const s = Math.max(0, ms / 1000)
  if (s >= 60) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
  return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isNoAction(p: StrategyProjection): boolean {
  return p.strategyId.toLowerCase().replace(/[^a-z]/g, '') === 'noaction'
}

function OutcomeChip({ outcome }: { outcome: AppliedStrategy['outcome'] }) {
  if (outcome === undefined) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-600 bg-slate-800/50 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-slate-400">
        <span className="h-2 w-2 animate-spin rounded-full border border-slate-400 border-t-transparent" />
        PENDING
      </span>
    )
  }
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${OUTCOME_META[outcome]}`}
    >
      {outcome.toUpperCase()}
    </span>
  )
}

function RecoveryPanelInner({ projections, appliedStrategies, services }: RecoveryPanelProps) {
  const noAction = projections.find(isNoAction)
  const list = projections
    .filter((p) => !isNoAction(p))
    .sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || b.successProbability - a.successProbability)
  const applied = appliedStrategies.slice(-6)

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Recovery Strategy Optimizer
        </h2>
        {list.length > 0 && (
          <span className="rounded border border-edge bg-panel2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-slate-400">
            {list.length} options
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        {projections.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-3 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            No active incident — optimizer idle
          </div>
        ) : (
          <>
            {noAction && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/[0.07] px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-red-300">
                UNMITIGATED · {fmtK(noAction.expectedDamage)} user-seconds damage ·{' '}
                {noAction.expectedCascadeSize.toFixed(1)} services affected
              </div>
            )}
            {list.length === 0 && (
              <div className="px-1 py-1 text-[11px] text-slate-500">No viable strategies projected.</div>
            )}
            {list.map((p) => {
              const meta = VERDICT_META[p.verdict]
              const desc = describeStrategy(p.strategyId)
              const targetLabel = desc.target ? (services[desc.target]?.name ?? desc.target) : undefined
              const success = Math.min(100, Math.max(0, Math.round(p.successProbability * 100)))
              const canApply = p.verdict === 'recommended' || p.verdict === 'viable'
              return (
                <div
                  key={p.strategyId}
                  className={`rounded-lg border bg-panel2/50 p-2.5 transition-colors ${meta.border}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-slate-200">{desc.label}</span>
                    {targetLabel && (
                      <span className="truncate rounded border border-edge bg-panel2 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                        {targetLabel}
                      </span>
                    )}
                    <span
                      className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-semibold tracking-wider ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${success}%`, backgroundColor: meta.bar }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-300">{success}%</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                    <span>
                      DMG <span className="text-slate-300">{fmtK(p.expectedDamage)}</span>
                    </span>
                    <span>
                      MTTR <span className="text-slate-300">{fmtSec(p.mttrMs)}</span>
                    </span>
                    <span>
                      COST <span className="text-slate-300">{Math.round(p.cost)}</span>
                    </span>
                  </div>
                  {p.rationale && (
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">{p.rationale}</p>
                  )}
                  {canApply && (
                    <button
                      onClick={() => actions.applyStrategy(p.strategyId)}
                      className={`mt-2 h-6 rounded-md border px-2.5 text-[10px] font-semibold tracking-wider transition-colors ${
                        p.verdict === 'recommended'
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          : 'border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                      }`}
                    >
                      APPLY ▸
                    </button>
                  )}
                </div>
              )
            })}

            {applied.length > 0 && (
              <div className="border-t border-edge pt-2">
                <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-600">Applied actions</div>
                <div className="space-y-1">
                  {applied.map((a) => {
                    const desc = describeStrategy(a.strategyId)
                    const targetLabel = desc.target ? (services[desc.target]?.name ?? desc.target) : undefined
                    return (
                      <div key={`${a.strategyId}-${a.ts}`} className="flex min-w-0 items-center gap-2 text-[10px]">
                        <span className="shrink-0 font-mono tabular-nums text-slate-600">{fmtClock(a.ts)}</span>
                        <span className="truncate text-slate-300">
                          {desc.label}
                          {targetLabel ? ` → ${targetLabel}` : ''}
                        </span>
                        <span className="ml-auto shrink-0">
                          <OutcomeChip outcome={a.outcome} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export const RecoveryPanel = memo(RecoveryPanelInner)
export default RecoveryPanel
