import { memo, useEffect, useState } from 'react'

interface EvalScenario {
  scenarioId: string
  scenarioName: string
  predictionLeadTimeMs: number | null
  originMatch: boolean
  trueOrigin: string | null
  hits: number
  missed: number
  falseAlarms: number
  precision: number
  recall: number
  servicesFailed: number
  servicesImpacted: number
  bestStrategyId: string | null
  bestStrategySuccessProbability: number
}

interface EvalReport {
  generatedAt: string
  scenarios: EvalScenario[]
  aggregate: {
    avgPredictionLeadTimeMs: number
    originAccuracy: number
    avgPrecision: number
    avgRecall: number
    totalHits: number
    totalMissed: number
  }
}

/**
 * Benchmarks — the measured cross-scenario results produced by the
 * headless evaluation harness (scripts/evaluate.ts). Showing the
 * numbers in-product is what separates a demo from evidence.
 */
function BenchmarksPanelInner() {
  const [report, setReport] = useState<EvalReport | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('evaluation-report.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: EvalReport) => {
        if (alive) setReport(j)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (failed) return null
  if (!report) {
    return (
      <section className="rounded-xl border border-edge bg-panel p-3 text-[11px] text-slate-500">
        Loading measured benchmarks…
      </section>
    )
  }

  const a = report.aggregate

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Measured Benchmarks
        </h2>
        <span className="font-mono text-[9px] tracking-wider text-slate-600">
          4 SCENARIOS · HEADLESS
        </span>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Avg lead time', value: `${Math.round(a.avgPredictionLeadTimeMs / 1000)}s`, tone: 'text-sky-300' },
            { label: 'Origin accuracy', value: `${Math.round(a.originAccuracy * 100)}%`, tone: 'text-emerald-300' },
            { label: 'Avg precision', value: `${Math.round(a.avgPrecision * 100)}%`, tone: 'text-violet-300' },
            { label: 'Avg recall', value: `${Math.round(a.avgRecall * 100)}%`, tone: 'text-amber-300' },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-edge bg-panel2/60 px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{t.label}</div>
              <div className={`font-mono text-base font-semibold tabular-nums ${t.tone}`}>{t.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-2 overflow-hidden rounded-lg border border-edge">
          <table className="w-full text-left font-mono text-[10px]">
            <thead className="bg-panel2/80 text-[9px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Scenario</th>
                <th className="px-2 py-1 font-medium">Lead</th>
                <th className="px-2 py-1 font-medium">Origin</th>
                <th className="px-2 py-1 font-medium">Prec</th>
                <th className="px-2 py-1 font-medium">Impact</th>
              </tr>
            </thead>
            <tbody>
              {report.scenarios.map((s) => (
                <tr key={s.scenarioId} className="border-t border-edge/70 text-slate-300">
                  <td className="px-2 py-1">{s.scenarioId}</td>
                  <td className="px-2 py-1 tabular-nums text-sky-300">
                    {s.predictionLeadTimeMs !== null
                      ? `${Math.round(s.predictionLeadTimeMs / 1000)}s`
                      : '—'}
                  </td>
                  <td className="px-2 py-1">
                    {s.originMatch ? (
                      <span className="text-emerald-300">✓ {s.trueOrigin}</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1 tabular-nums">{Math.round(s.precision * 100)}%</td>
                  <td className="px-2 py-1 tabular-nums text-slate-400">
                    {s.servicesImpacted} svc
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 border-t border-edge pt-2 text-[10px] leading-relaxed text-slate-500">
          Produced by <span className="font-mono text-slate-400">scripts/evaluate.ts</span> — the
          same engine and AI modules run headless over every fault scenario, scoring predictions
          against ground truth.
        </p>
      </div>
    </section>
  )
}

export const BenchmarksPanel = memo(BenchmarksPanelInner)
export default BenchmarksPanel
