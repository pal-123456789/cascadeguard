import { memo } from 'react'
import type { PredictionLedgerEntry, ServiceId, ServiceState } from '../core/types'

export interface PredictionLedgerProps {
  ledger: PredictionLedgerEntry[]
  services: Record<ServiceId, ServiceState>
}

function fmtT(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/**
 * Prediction Ledger — the auditable trail of every warning CascadeGuard
 * raised, and whether it came true. This is the "proof" panel: a judge
 * can read the exact moment a prediction was made and the exact moment
 * the service actually failed.
 */
function PredictionLedgerInner({ ledger, services }: PredictionLedgerProps) {
  const rows = ledger.slice(-12).reverse()

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Prediction Ledger
        </h2>
        <span className="font-mono text-[9px] tracking-wider text-slate-600">
          {ledger.length} RAISED · {ledger.filter((e) => e.outcome === 'confirmed').length} CONFIRMED
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-slate-500">
          No predictions raised yet — the cluster is within tolerance. Warnings will appear here the
          moment risk crosses the prediction threshold.
        </p>
      ) : (
        <div className="max-h-[188px] overflow-y-auto">
          {rows.map((e) => {
            const name = services[e.service]?.name ?? e.service
            const confirmed = e.outcome === 'confirmed'
            const falseAlarm = e.outcome === 'false-alarm'
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 border-b border-edge/60 px-3 py-1.5 last:border-b-0 hover:bg-panel2/50"
              >
                <span className="font-mono text-[10px] tabular-nums text-slate-500">{fmtT(e.madeAt)}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">{name}</span>
                <span className="font-mono text-[10px] tabular-nums text-violet-300">
                  {(e.risk * 100).toFixed(0)}%
                </span>
                {confirmed ? (
                  <span
                    className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300"
                    title={`Service failed at ${fmtT(e.failedAt ?? e.madeAt)}`}
                  >
                    ✓ HIT · {Math.round((e.leadTimeMs ?? 0) / 1000)}s early
                  </span>
                ) : falseAlarm ? (
                  <span className="rounded border border-edge bg-panel2 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                    no failure
                  </span>
                ) : (
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
                    PENDING
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="border-t border-edge px-3 py-1.5 text-[10px] leading-relaxed text-slate-500">
        Each row is a warning raised from telemetry alone — never from ground truth — scored
        automatically when the simulation decides whether the failure really happened.
      </p>
    </section>
  )
}

export const PredictionLedger = memo(PredictionLedgerInner)
export default PredictionLedger
