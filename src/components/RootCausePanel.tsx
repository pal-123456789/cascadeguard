import { Fragment, memo } from 'react'
import type { RootCauseHypothesis, ServiceState } from '../core/types'

export interface RootCausePanelProps {
  hypotheses: RootCauseHypothesis[]
  services: Record<string, ServiceState>
}

function RootCausePanelInner({ hypotheses, services }: RootCausePanelProps) {
  const name = (id: string): string => services[id]?.name ?? id

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Root Cause Analysis
        </h2>
        {hypotheses.length > 0 && (
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-300">
            {hypotheses.length} chain{hypotheses.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        {hypotheses.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-3 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            No anomaly chains under investigation
          </div>
        ) : (
          hypotheses.slice(0, 4).map((h, i) => (
            <div
              key={`${h.service}-${i}`}
              className="rounded-lg border border-edge bg-panel2/50 p-2.5 transition-colors hover:border-slate-600"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-7 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-bold ${
                    i === 0
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                      : 'border-edge bg-panel2 text-slate-500'
                  }`}
                >
                  #{i + 1}
                </span>
                <span className="truncate text-xs font-medium text-slate-200">{name(h.service)}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                  {Math.round(h.confidence * 100)}%
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                    style={{ width: `${Math.min(100, Math.max(2, Math.round(h.confidence * 100)))}%` }}
                  />
                </div>
              </div>

              {h.chain.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {h.chain.map((id, j) => (
                    <Fragment key={`${id}-${j}`}>
                      {j > 0 && <span className="text-[10px] text-slate-600">→</span>}
                      <span className="rounded border border-edge bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                        {name(id)}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}

              {h.evidence.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {h.evidence.slice(0, 4).map((ev, j) => (
                    <li key={j} className="flex gap-1.5 text-[11px] leading-snug text-slate-400">
                      <span className="mt-px shrink-0 text-slate-600">▸</span>
                      <span className="min-w-0">{ev}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export const RootCausePanel = memo(RootCausePanelInner)
export default RootCausePanel
