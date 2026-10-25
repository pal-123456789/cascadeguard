import { memo } from 'react'
import type { AccuracyStats } from '../core/types'

export interface AccuracyPanelProps {
  accuracy: AccuracyStats
}

function safePct(v: number): string {
  return `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`
}

function AccuracyPanelInner({ accuracy }: AccuracyPanelProps) {
  const precision = Number.isFinite(accuracy.precision) ? accuracy.precision : 0
  const recall = Number.isFinite(accuracy.recall) ? accuracy.recall : 0
  const leadS = Number.isFinite(accuracy.avgLeadTimeMs) ? accuracy.avgLeadTimeMs / 1000 : 0
  const hits = Number.isFinite(accuracy.hits) ? accuracy.hits : 0
  const missed = Number.isFinite(accuracy.missed) ? accuracy.missed : 0
  const falseAlarms = Number.isFinite(accuracy.falseAlarms) ? accuracy.falseAlarms : 0

  const tiles: ReadonlyArray<{ label: string; value: string; accent: string }> = [
    { label: 'Precision', value: safePct(precision * 100), accent: 'text-emerald-300' },
    { label: 'Recall', value: safePct(recall * 100), accent: 'text-emerald-300' },
    { label: 'Avg lead time', value: `${leadS.toFixed(1)}s`, accent: 'text-sky-300' },
    { label: 'Predictions resolved', value: String(Math.max(0, Math.round(hits))), accent: 'text-violet-300' },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Model Accuracy</h2>
        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE · VS GROUND TRUTH
        </span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-edge bg-panel2/60 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t.label}</div>
              <div className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${t.accent}`}>{t.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-[10px] tabular-nums">
          <span className="text-emerald-400">{Math.round(hits)} hits</span>
          <span className="text-amber-400">{Math.round(missed)} missed</span>
          <span className="text-red-400">{Math.round(falseAlarms)} false alarms</span>
        </div>
        <p className="mt-2 border-t border-edge pt-2 text-[10px] leading-relaxed text-slate-500">
          Every prediction is scored automatically — the simulation knows which services actually fail
          and when.
        </p>
      </div>
    </section>
  )
}

export const AccuracyPanel = memo(AccuracyPanelInner)
export default AccuracyPanel
