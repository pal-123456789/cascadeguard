import { memo, useMemo } from 'react'
import { SEED_TOPOLOGY } from '../data/topology'
import Sparkline from './Sparkline'
import type { ServiceId, SimulationSnapshot } from '../core/types'

export interface ServiceDetailProps {
  snap: SimulationSnapshot
  serviceId: ServiceId
  onClose: () => void
  onApplyStrategy: (strategyId: string) => void
}

function fmtT(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const STATUS_TONE: Record<string, string> = {
  healthy: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  degraded: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  critical: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
  failed: 'text-red-300 border-red-500/40 bg-red-500/10',
}

function ServiceDetailInner({ snap, serviceId, onClose, onApplyStrategy }: ServiceDetailProps) {
  const svc = snap.services[serviceId]
  const risk = snap.risks[serviceId]

  const deps = useMemo(
    () => SEED_TOPOLOGY.edges.filter((e) => e.from === serviceId),
    [serviceId],
  )
  const dependents = useMemo(
    () => SEED_TOPOLOGY.edges.filter((e) => e.to === serviceId),
    [serviceId],
  )
  const logs = useMemo(
    () => snap.logs.filter((l) => l.service === serviceId).slice(-8).reverse(),
    [snap.logs, serviceId],
  )
  const strategies = useMemo(
    () => snap.projections.filter((p) => p.strategyId.includes(serviceId)).slice(0, 3),
    [snap.projections, serviceId],
  )

  if (!svc) return null

  const m = svc.metrics
  const history = svc.history ?? []

  const metrics: ReadonlyArray<{ label: string; value: string; tone?: string }> = [
    { label: 'Requests/s', value: String(m.rps) },
    { label: 'p50 latency', value: `${m.latencyP50}ms` },
    { label: 'p99 latency', value: `${m.latencyP99}ms` },
    { label: 'Error rate', value: `${(m.errorRate * 100).toFixed(1)}%` },
    { label: 'CPU', value: `${(m.cpu * 100).toFixed(0)}%` },
    { label: 'Memory', value: `${(m.memory * 100).toFixed(0)}%` },
    { label: 'Saturation', value: `${(m.saturation * 100).toFixed(0)}%` },
    { label: 'Replicas', value: String(svc.replicas ?? 1) },
  ]

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* drawer */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[420px] flex-col border-l border-edge bg-panel shadow-2xl"
        role="dialog"
        aria-label={`${svc.name} details`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-edge px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">{svc.name}</h2>
              <span
                className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  STATUS_TONE[svc.status] ?? STATUS_TONE.healthy
                }`}
              >
                {svc.status}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">
              {svc.id} · {svc.kind} · criticality {svc.criticality.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-edge bg-panel2 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:text-slate-100"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* risk */}
          <div className="rounded-lg border border-edge bg-panel2/60 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Predicted failure risk
              </span>
              <span
                className={`font-mono text-xl font-semibold tabular-nums ${
                  (risk?.risk ?? 0) >= 0.55
                    ? 'text-violet-300'
                    : (risk?.risk ?? 0) >= 0.3
                      ? 'text-amber-300'
                      : 'text-slate-300'
                }`}
              >
                {((risk?.risk ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            {risk?.drivers && risk.drivers.length > 0 && (
              <ul className="mt-2 space-y-1">
                {risk.drivers.map((d) => (
                  <li key={d.label} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-edge">
                      <span
                        className="block h-full rounded-full bg-violet-400/70"
                        style={{ width: `${Math.round(d.contribution * 100)}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right font-mono tabular-nums text-slate-500">
                      {Math.round(d.contribution * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {risk?.ttfMs !== undefined && (
              <p className="mt-2 font-mono text-[10px] text-slate-500">
                time-to-failure estimate ≈ {Math.round(risk.ttfMs / 1000)}s
              </p>
            )}
          </div>

          {/* metrics grid */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {metrics.map((x) => (
              <div key={x.label} className="rounded-lg border border-edge bg-panel2/40 px-2.5 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">{x.label}</div>
                <div className="font-mono text-sm tabular-nums text-slate-200">{x.value}</div>
              </div>
            ))}
          </div>

          {/* trends */}
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-edge bg-panel2/40 px-2.5 py-2">
              <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">
                Saturation trend
              </div>
              <Sparkline values={history.map((h) => h.saturation)} color="#a78bfa" height={34} />
            </div>
            <div className="rounded-lg border border-edge bg-panel2/40 px-2.5 py-2">
              <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-500">
                Error rate trend
              </div>
              <Sparkline values={history.map((h) => h.errorRate)} color="#f87171" height={34} />
            </div>
          </div>

          {/* dependencies */}
          <div className="mt-3 rounded-lg border border-edge bg-panel2/40 p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              Dependency graph
            </div>
            <div className="mt-1.5 space-y-1 text-[10px]">
              {deps.length > 0 && (
                <div className="text-slate-400">
                  <span className="text-slate-500">calls →</span>{' '}
                  {deps.map((e) => e.to).join(', ')}
                </div>
              )}
              {dependents.length > 0 && (
                <div className="text-slate-400">
                  <span className="text-slate-500">called by ←</span>{' '}
                  {dependents.map((e) => e.from).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* strategies */}
          {strategies.length > 0 && (
            <div className="mt-3 rounded-lg border border-edge bg-panel2/40 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">
                Recommended actions
              </div>
              <div className="mt-1.5 space-y-1.5">
                {strategies.map((p) => (
                  <div key={p.strategyId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-300">
                      {p.strategyId}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-emerald-300">
                      {Math.round(p.successProbability * 100)}%
                    </span>
                    <button
                      onClick={() => onApplyStrategy(p.strategyId)}
                      className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20"
                    >
                      APPLY
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* logs */}
          <div className="mt-3 rounded-lg border border-edge bg-panel2/40 p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Recent logs</div>
            {logs.length === 0 ? (
              <p className="mt-1 text-[10px] text-slate-600">no recent log events</p>
            ) : (
              <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                {logs.map((l) => (
                  <li key={l.id} className="flex gap-2 text-slate-400">
                    <span className="shrink-0 tabular-nums text-slate-600">{fmtT(l.ts)}</span>
                    <span
                      className={
                        l.level === 'ERROR' || l.level === 'FATAL'
                          ? 'text-red-400'
                          : l.level === 'WARN'
                            ? 'text-amber-400'
                            : 'text-slate-500'
                      }
                    >
                      {l.level}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export const ServiceDetail = memo(ServiceDetailInner)
export default ServiceDetail
