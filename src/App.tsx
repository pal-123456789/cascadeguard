import { useCallback, useEffect, useState } from 'react'
import { actions, useSimulation } from './core/store'
import { SCENARIOS } from './core/engine/scenarios'
import { downloadIncidentReport } from './core/report'
import type { ScenarioDef, ServiceId } from './core/types'
import AccuracyPanel from './components/AccuracyPanel'
import BenchmarksPanel from './components/BenchmarksPanel'
import ImpactPanel from './components/ImpactPanel'
import IncidentPanel from './components/IncidentPanel'
import LogStream from './components/LogStream'
import PredictionLedger from './components/PredictionLedger'
import RecoveryPanel from './components/RecoveryPanel'
import RiskPanel from './components/RiskPanel'
import RootCausePanel from './components/RootCausePanel'
import ServiceDetail from './components/ServiceDetail'
import ExplainablePanel from './components/ExplainablePanel'
import Topology from './components/Topology'

const SCENARIO_LIST: readonly ScenarioDef[] = Array.isArray(SCENARIOS) ? SCENARIOS : []
const SPEEDS: ReadonlyArray<number> = [1, 2, 4]

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const snap = useSimulation()
  const [selected, setSelected] = useState<ServiceId | null>(null)

  const handleSelect = useCallback((id: ServiceId) => {
    setSelected((prev) => (prev === id ? null : id))
  }, [])

  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const [judgeTour, setJudgeTour] = useState<number | null>(
    typeof window !== 'undefined' && window.location.search.includes('judge=1') ? 0 : null,
  )
  const [autoDemo, setAutoDemo] = useState<number | null>(null) // 0-5 steps
  useEffect(() => {
    if (judgeTour === null) return
    if (judgeTour >= 4) { setJudgeTour(null); return }
    const t = setTimeout(() => setJudgeTour((p) => (p === null ? null : p + 1)), 5500)
    return () => clearTimeout(t)
  }, [judgeTour])
  useEffect(() => {
    if (autoDemo === null) return
    if (autoDemo >= 5) { setAutoDemo(null); return }
    const t = setTimeout(() => setAutoDemo((p) => (p === null ? null : (p ?? 0) + 1)), 5000)
    return () => clearTimeout(t)
  }, [autoDemo])

  // keyboard shortcuts: space = run/pause, 1/2/4 = speed, R = restart scenario,
  // E = export incident report, Esc = close drawer, G = guided judge tour
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        actions.toggleRun()
      } else if (e.key === '1' || e.key === '2' || e.key === '4') {
        actions.setSpeed(Number(e.key))
      } else if (e.key.toLowerCase() === 'g') {
        setJudgeTour((prev) => (prev === null ? 0 : prev + 1))
      } else if (e.key.toLowerCase() === 'r') {
        actions.loadScenario(snap.scenarioId)
      } else if (e.key.toLowerCase() === 'e') {
        downloadIncidentReport(snap)
      } else if (e.key === 'Escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snap])

  const scenario = SCENARIO_LIST.find((s) => s.id === snap.scenarioId)
  const scenarioKnown = scenario !== undefined

  // live cluster verdict for the header
  const failedCount = Object.values(snap.services).filter((s) => s.status === 'failed').length
  const predictedCount = Object.values(snap.risks).filter((r) => r.predicted).length
  const activeIncident = snap.incidents.find((i) => i.resolvedAt === undefined)
  const verdictTone =
    failedCount > 0
      ? 'border-red-500/40 bg-red-500/10 text-red-300'
      : predictedCount > 0
        ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  const verdictText =
    failedCount > 0
      ? `${failedCount} DOWN${predictedCount ? ` · ${predictedCount} PREDICTED` : ''}`
      : predictedCount > 0
        ? `${predictedCount} FAILURE${predictedCount > 1 ? 'S' : ''} PREDICTED`
        : 'ALL SYSTEMS NOMINAL'

  return (
    <div className="flex min-h-screen flex-col bg-void">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-edge bg-panel/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-panel2 text-base shadow-[0_0_14px_rgba(56,189,248,0.15)]">
              🛡️
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-slate-100">CascadeGuard</div>
              <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Predict · Trace · Recover
              </div>
            </div>
          </div>

          <div className="hidden h-8 w-px bg-edge sm:block" />

          <div
            className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold tracking-wider md:inline-flex ${verdictTone}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {verdictText}
          </div>

          {activeIncident && (
            <span className="hidden rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-red-300 lg:inline">
              {activeIncident.severity}
            </span>
          )}

          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                snap.running
                  ? 'animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-lg font-semibold tabular-nums tracking-tight text-slate-100">
              T+{fmtClock(snap.simTime)}
            </span>
            <span
              className={`text-[9px] font-semibold tracking-widest ${
                snap.running ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {snap.running ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>

          {scenario && (
            <div className="hidden min-w-0 max-w-[320px] flex-1 md:block" title={scenario.description}>
              <div className="truncate text-[11px] text-slate-500">{scenario.tagline}</div>
            </div>
          )}

          <button
            onClick={() => {
              actions.loadScenario('pool-exhaustion')
              actions.setSpeed(2)
              setAutoDemo(0)
            }}
            className="rounded-md border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-sky-300 hover:bg-sky-400/20 transition-colors"
            title="Auto-run the full demo sequence"
          >
            AUTO DEMO {autoDemo !== null ? `(step ${autoDemo + 1}/5)` : ''}
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={snap.scenarioId}
              onChange={(e) => actions.loadScenario(e.target.value)}
              title={scenario?.description}
              className="h-8 max-w-[190px] rounded-md border border-edge bg-panel2 px-2 text-[11px] text-slate-300 outline-none transition-colors hover:border-slate-600 focus:border-sky-500/60"
              aria-label="Select failure scenario"
            >
              {!scenarioKnown && (
                <option value={snap.scenarioId} className="bg-panel2">
                  {snap.scenarioId}
                </option>
              )}
              {SCENARIO_LIST.map((s) => (
                <option key={s.id} value={s.id} className="bg-panel2">
                  {s.name}
                </option>
              ))}
            </select>

            <div className="flex overflow-hidden rounded-md border border-edge">
              {SPEEDS.map((m) => (
                <button
                  key={m}
                  onClick={() => actions.setSpeed(m)}
                  className={`h-8 w-9 font-mono text-[11px] transition-colors ${
                    snap.speed === m
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-panel2 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>

            <button
              onClick={() => actions.toggleRun()}
              className={`h-8 rounded-md border px-3 text-[11px] font-semibold tracking-wider transition-colors ${
                snap.running
                  ? 'border-edge bg-panel2 text-slate-300 hover:border-slate-600'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              }`}
            >
              {snap.running ? '❚❚ PAUSE' : '▶ RUN'}
            </button>

            <button
              onClick={() => downloadIncidentReport(snap)}
              title="Download the incident report as Markdown (E)"
              className="h-8 rounded-md border border-edge bg-panel2 px-2.5 text-[11px] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100"
            >
              ⤓ REPORT
            </button>
          </div>
        </div>
      </header>

      {/* ── Main grid ──────────────────────────────────────────── */}
      <main className="grid flex-1 grid-cols-1 items-start gap-3 bg-[radial-gradient(1100px_460px_at_50%_-10%,rgba(56,189,248,0.06),transparent)] p-3 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Topology
            services={snap.services}
            risks={snap.risks}
            selectedId={selected}
            onSelect={handleSelect}
          />
          <LogStream logs={snap.logs} running={snap.running} />
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-[57px] lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto lg:pr-0.5">
          {[
            { id: 'incidents', label: 'INCIDENTS', comp: <IncidentPanel incidents={snap.incidents} alerts={snap.alerts} simTime={snap.simTime} /> },
            { id: 'impact', label: 'BUSINESS IMPACT & SLO', comp: <ImpactPanel impact={snap.impact} services={snap.services} /> },
            { id: 'accuracy', label: 'MODEL ACCURACY', comp: <AccuracyPanel accuracy={snap.accuracy} /> },
            { id: 'risk', label: 'FAILURE PREDICTIONS', comp: <RiskPanel risks={snap.risks} services={snap.services} selectedId={selected} tick={snap.tick} scenarioId={snap.scenarioId} /> },
            { id: 'ledger', label: 'PREDICTION LEDGER', comp: <PredictionLedger ledger={snap.ledger} services={snap.services} /> },
            { id: 'rootcause', label: 'ROOT CAUSE ANALYSIS', comp: <RootCausePanel hypotheses={snap.rootCauses} services={snap.services} /> },
            { id: 'recovery', label: 'RECOVERY STRATEGY OPTIMIZER', comp: <RecoveryPanel projections={snap.projections} appliedStrategies={snap.appliedStrategies} services={snap.services} /> },
            { id: 'benchmarks', label: 'MEASURED BENCHMARKS', comp: <BenchmarksPanel /> },
            { id: 'explainable', label: 'EXPLAINABLE AI', comp: <ExplainablePanel service={selected ? snap.services[selected] ?? null : Object.values(snap.services).find((s) => s.status !== 'healthy') ?? null} /> },
          ].map((sec) => (
            <div
              key={sec.id}
              className={`panel-scroll rounded-xl border border-edge bg-panel transition-all duration-300 cursor-pointer hover:border-slate-600 ${expandedSection === sec.id ? 'max-h-[500px]' : 'max-h-[240px]'}`}
              onClick={() => setExpandedSection(expandedSection === sec.id ? null : sec.id)}
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-edge bg-panel2/40">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{sec.label}</span>
                <span className="text-[9px] font-mono text-slate-600">{expandedSection === sec.id ? '▼ collapse' : '▶ expand'}</span>
              </div>
              <div className={`${expandedSection === sec.id ? 'p-3' : 'p-2'}`}>
                {sec.comp}
              </div>
            </div>
          ))}
        </aside>
      </main>

      {selected && (
        <ServiceDetail
          snap={snap}
          serviceId={selected}
          onClose={() => setSelected(null)}
          onApplyStrategy={(id) => actions.applyStrategy(id)}
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-edge bg-panel/60 px-3 py-1.5 text-[10px] text-slate-500">
        <span>
          <span className="font-semibold tracking-wider text-slate-600">HOW IT WORKS</span>
          <span className="mx-1.5 text-slate-700">·</span>
          Simulated cluster → telemetry → AI prediction → verified against ground truth
          <span className="mx-1.5 text-slate-700">·</span>
          <span className="font-mono">SPACE run/pause · 1/2/4 speed · E export report</span>
        </span>
        <span className="flex items-center gap-3">
          <a href="/portfolio.html" className="transition-colors hover:text-slate-300">
            Case study
          </a>
          <a
            href="https://github.com/pal-123456789/cascadeguard/blob/main/docs/JUDGE_GUIDE.md"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-slate-300"
          >
            Judge guide
          </a>
          <a
            href="https://github.com/pal-123456789/cascadeguard"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-slate-300"
          >
            Source
          </a>
        </span>
        <span className="font-mono">Orcathon 2026 · CascadeGuard</span>
      </footer>

      {/* Judge-mode guided demo overlay */}
      {judgeTour !== null && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-4 rounded-2xl border border-sky-400/30 bg-void/80 backdrop-blur-md shadow-[0_0_60px_rgba(56,189,248,0.15)] flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
              <div className="text-sm font-extrabold tracking-tight text-white">GUIDED DEMO <span className="text-sky-400 text-xs font-normal">(press G again to skip · Esc to close)</span></div>
              <button onClick={() => setJudgeTour(null)} className="text-[11px] font-mono text-slate-400 hover:text-white border border-edge rounded px-2 py-0.5">SKIP</button>
            </div>
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Step {judgeTour + 1} of 4</div>
              {judgeTour === 0 && (
                <div>
                  <h3 className="text-xl font-extrabold text-white mb-2">1. Select the scenario</h3>
                  <p className="text-sm text-slate-300 mb-3">Pick <strong>Connection Pool Exhaustion</strong> from the dropdown. Press 2 for 2× speed. Watch Orders DB — saturation is creeping.</p>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 font-mono">ACTION: Click scenario dropdown → Connection Pool Exhaustion</div>
                </div>
              )}
              {judgeTour === 1 && (
                <div>
                  <h3 className="text-xl font-extrabold text-white mb-2">2. Watch the prediction</h3>
                  <p className="text-sm text-slate-300 mb-3">A violet PREDICTION halo appears before failure. The Prediction Ledger turns green: <strong>✓ HIT · 120s early</strong>.</p>
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-violet-300 font-mono">ACTION: Look for the violet ring and ledger row</div>
                </div>
              )}
              {judgeTour === 2 && (
                <div>
                  <h3 className="text-xl font-extrabold text-white mb-2">3. Root cause + recovery</h3>
                  <p className="text-sm text-slate-300 mb-3">Root Cause names <strong>orders-db</strong> (not the loudest API). Recovery recommends <strong>failover:orders-db @ 100%</strong> — click APPLY and the cascade is contained.</p>
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300 font-mono">ACTION: Open Root Cause → click Recovery panel → APPLY</div>
                </div>
              )}
              {judgeTour === 3 && (
                <div>
                  <h3 className="text-xl font-extrabold text-white mb-2">4. Export the evidence</h3>
                  <p className="text-sm text-slate-300 mb-3">Press <strong>E</strong> to download the incident report (Markdown). It contains the prediction ledger, root-cause chain, recovery comparison and business impact.</p>
                  <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-2 text-xs text-sky-300 font-mono">ACTION: Press E → open downloaded incident-report.md</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-demo guided sequence overlay */}
      {autoDemo !== null && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-4 rounded-2xl border border-amber-400/30 bg-void/85 backdrop-blur-md shadow-[0_0_60px_rgba(232,168,80,0.15)] flex flex-col pointer-events-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
              <div className="text-sm font-extrabold tracking-tight text-white">AUTO DEMO <span className="text-amber-300 text-xs font-normal">(auto-advancing · 5 steps)</span></div>
              <button onClick={() => setAutoDemo(null)} className="text-[11px] font-mono text-slate-400 hover:text-white border border-edge rounded px-2 py-0.5">STOP</button>
            </div>
            <div className="flex-1 px-6 py-5 overflow-y-auto">
              <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300 mb-3">Step {autoDemo + 1} of 5 · Auto-playing</div>
              {autoDemo === 0 && (
                <div><h3 className="text-xl font-extrabold text-white mb-2">1. Scenario loaded</h3><p className="text-sm text-slate-300 mb-3">Pool-Exhaustion selected · 2× speed set. Watch Orders DB saturation climb.</p><div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 font-mono">SCENARIO: pool-exhaustion · SPEED: 2×</div></div>
              )}
              {autoDemo === 1 && (
                <div><h3 className="text-xl font-extrabold text-white mb-2">2. Prediction triggered</h3><p className="text-sm text-slate-300 mb-3">Violet PREDICTION halo appears on Orders DB. Ledger shows: <strong>✓ HIT · 120s early</strong>.</p><div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-violet-300 font-mono">PREDICTION: risk 86% · LEAD: 120 s</div></div>
              )}
              {autoDemo === 2 && (
                <div><h3 className="text-xl font-extrabold text-white mb-2">3. Incident + Root Cause</h3><p className="text-sm text-slate-300 mb-3">SEV-1 alert fires. Root-cause panel: <strong>orders-db · 95% confidence</strong> — true origin, not the loudest API.</p><div className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-300 font-mono">ORIGIN: orders-db · SEVERITY: SEV-1</div></div>
              )}
              {autoDemo === 3 && (
                <div><h3 className="text-xl font-extrabold text-white mb-2">4. Recovery applied</h3><p className="text-sm text-slate-300 mb-3">Optimizer recommends <strong>failover:orders-db @ 100%</strong>. Click APPLY — cascade contained.</p><div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300 font-mono">RECOMMENDED: failover:orders-db · CONTAINED: yes</div></div>
              )}
              {autoDemo === 4 && (
                <div><h3 className="text-xl font-extrabold text-white mb-2">5. Evidence exported</h3><p className="text-sm text-slate-300 mb-3">Press <strong>E</strong> → incident report (Markdown) downloads with ledger, root-cause chain, recovery comparison, business impact.</p><div className="rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-2 text-xs text-sky-300 font-mono">EXPORT: incident-report.md · BUSINESS IMPACT: $34.2k/min · SLO: 11.37×</div></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
