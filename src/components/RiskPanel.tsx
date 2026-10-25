import { memo, useRef } from 'react'
import type { RiskAssessment, ServiceState } from '../core/types'
import Sparkline from './Sparkline'

export interface RiskPanelProps {
  risks: Record<string, RiskAssessment>
  services: Record<string, ServiceState>
  selectedId: string | null
  /** current engine tick — used to key history pushes */
  tick: number
  /** scenario id — resets history when the scenario changes */
  scenarioId: string
}

const HISTORY_CAP = 48

interface Tone {
  text: string
  hex: string
}

function riskTone(risk: number): Tone {
  const pct = risk * 100
  if (pct >= 62) return { text: 'text-violet-300', hex: '#8b5cf6' }
  if (pct >= 40) return { text: 'text-amber-300', hex: '#f59e0b' }
  return { text: 'text-slate-300', hex: '#64748b' }
}

function fmtTtf(ms: number): string {
  const s = Math.max(0, ms / 1000)
  return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`
}

function RiskPanelInner({ risks, services, selectedId, tick, scenarioId }: RiskPanelProps) {
  // Risks are point-in-time; keep a component-level sliding history per service.
  const historyRef = useRef<Map<string, number[]>>(new Map())
  const lastTickRef = useRef(-1)
  const scenarioRef = useRef(scenarioId)

  // Reset history when the scenario changes.
  if (scenarioRef.current !== scenarioId) {
    scenarioRef.current = scenarioId
    historyRef.current.clear()
    lastTickRef.current = -1
  }

  // Push current risk values once per engine tick (guard skips StrictMode double-render).
  if (tick !== lastTickRef.current) {
    lastTickRef.current = tick
    for (const [id, r] of Object.entries(risks)) {
      const arr = historyRef.current.get(id)
      if (arr) {
        arr.push(r.risk)
        if (arr.length > HISTORY_CAP) arr.shift()
      } else {
        historyRef.current.set(id, [r.risk])
      }
    }
  }

  const entries = Object.values(risks)
  const top = [...entries].sort((a, b) => b.risk - a.risk).slice(0, 6)

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Failure Predictions
        </h2>
        <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-violet-300">
          {entries.filter((r) => r.predicted).length} predicted
        </span>
      </div>
      <div className="space-y-2 p-3">
        {top.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-3 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            All systems nominal
          </div>
        ) : (
          top.map((r) => {
            const svc = services[r.service]
            const tone = riskTone(r.risk)
            const pct = Math.round(r.risk * 100)
            const drivers = [...r.drivers].sort((a, b) => b.contribution - a.contribution).slice(0, 2)
            const hist = historyRef.current.get(r.service)
            const spark = hist ? hist.slice() : []
            return (
              <div
                key={r.service}
                className={`rounded-lg border p-2.5 transition-colors hover:border-slate-600 ${
                  r.predicted
                    ? 'border-violet-500/50 bg-violet-500/[0.05] shadow-[0_0_16px_rgba(139,92,246,0.12)]'
                    : 'border-edge bg-panel2/50'
                } ${selectedId === r.service ? 'ring-1 ring-sky-400/80' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-slate-200">
                      {svc?.name ?? r.service}
                    </div>
                    <div className="truncate font-mono text-[9px] text-slate-600">{r.service}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-mono text-xl font-semibold leading-none tabular-nums ${tone.text}`}>
                      {pct}%
                    </div>
                    {r.predicted && (
                      <div className="mt-1 text-[8px] font-semibold tracking-[0.2em] text-violet-300">
                        PREDICTED
                      </div>
                    )}
                  </div>
                </div>
                {r.ttfMs !== undefined && (
                  <div className="mt-1.5 font-mono text-[10px] text-violet-300">
                    ~{fmtTtf(r.ttfMs)} to failure
                  </div>
                )}
                {drivers.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {drivers.map((d) => (
                      <span
                        key={d.label}
                        className="rounded border border-edge bg-slate-800/70 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                        style={{ opacity: 0.55 + d.contribution * 0.45 }}
                      >
                        {d.label} {Math.round(d.contribution * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <Sparkline values={spark} color={tone.hex} height={24} />
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export const RiskPanel = memo(RiskPanelInner)
export default RiskPanel
