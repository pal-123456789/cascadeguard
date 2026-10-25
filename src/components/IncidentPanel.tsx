import { memo } from 'react'
import type { Alert, Incident } from '../core/types'

export interface IncidentPanelProps {
  incidents: Incident[]
  alerts: Alert[]
  simTime: number
}

const SEV_STYLE: Record<Incident['severity'], string> = {
  'SEV-1': 'border-red-500/40 bg-red-500/15 text-red-300',
  'SEV-2': 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  'SEV-3': 'border-amber-500/40 bg-amber-500/15 text-amber-300',
}

const ALERT_DOT: Record<Alert['severity'], string> = {
  critical: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.9)]',
  warning: 'bg-amber-400',
  info: 'bg-sky-400',
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function IncidentPanelInner({ incidents, alerts, simTime }: IncidentPanelProps) {
  const active = incidents.filter((i) => i.resolvedAt === undefined).pop()
  const resolved = incidents.filter((i) => i.resolvedAt !== undefined).slice(-4)
  const recentAlerts = alerts.slice(-5)

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Incidents</h2>
        {active && (
          <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
            ACTIVE
          </span>
        )}
      </div>

      {/* Alerts ticker strip */}
      <div className="space-y-0.5 border-b border-edge bg-panel2/40 px-3 py-1.5">
        {recentAlerts.length === 0 ? (
          <div className="text-[10px] text-slate-600">No alerts yet</div>
        ) : (
          recentAlerts.map((a) => (
            <div key={a.id} className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ALERT_DOT[a.severity]}`} />
              <span className="shrink-0 font-mono text-slate-600">{fmtClock(a.ts)}</span>
              <span className="truncate text-slate-400" title={a.message}>
                {a.service ? `${a.service} — ` : ''}
                {a.message}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 p-3">
        {active ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider ${SEV_STYLE[active.severity]}`}
              >
                {active.severity}
              </span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-slate-400">
                elapsed {fmtClock(Math.max(0, simTime - active.startedAt))}
              </span>
            </div>
            <div className="mt-1.5 text-xs font-medium leading-snug text-slate-100">{active.title}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {active.origin && (
                <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] text-red-300">
                  origin: {active.origin}
                </span>
              )}
              {active.services.map((s) => (
                <span
                  key={s}
                  className="rounded border border-edge bg-panel2 px-1.5 py-0.5 font-mono text-[9px] text-slate-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            No active incidents
          </div>
        )}

        {resolved.length > 0 && (
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-wider text-slate-600">Recently resolved</div>
            <div className="space-y-1">
              {resolved.map((i) => (
                <div key={i.id} className="flex min-w-0 items-center gap-2 text-[10px]">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      i.severity === 'SEV-1' ? 'bg-red-400' : i.severity === 'SEV-2' ? 'bg-orange-400' : 'bg-amber-400'
                    }`}
                  />
                  <span className="truncate text-slate-400" title={i.title}>
                    {i.title}
                  </span>
                  <span className="ml-auto shrink-0 font-mono tabular-nums text-slate-600">
                    {Math.max(1, Math.round(((i.resolvedAt ?? i.startedAt) - i.startedAt) / 1000))}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export const IncidentPanel = memo(IncidentPanelInner)
export default IncidentPanel
