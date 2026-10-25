import { useCallback, useState } from 'react'
import { actions, useSimulation } from './core/store'
import { SCENARIOS } from './core/engine/scenarios'
import type { ScenarioDef, ServiceId } from './core/types'
import AccuracyPanel from './components/AccuracyPanel'
import ImpactPanel from './components/ImpactPanel'
import IncidentPanel from './components/IncidentPanel'
import LogStream from './components/LogStream'
import PredictionLedger from './components/PredictionLedger'
import RecoveryPanel from './components/RecoveryPanel'
import RiskPanel from './components/RiskPanel'
import RootCausePanel from './components/RootCausePanel'
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
          <IncidentPanel incidents={snap.incidents} alerts={snap.alerts} simTime={snap.simTime} />
          <ImpactPanel impact={snap.impact} services={snap.services} />
          <AccuracyPanel accuracy={snap.accuracy} />
          <RiskPanel
            risks={snap.risks}
            services={snap.services}
            selectedId={selected}
            tick={snap.tick}
            scenarioId={snap.scenarioId}
          />
          <PredictionLedger ledger={snap.ledger} services={snap.services} />
          <RootCausePanel hypotheses={snap.rootCauses} services={snap.services} />
          <RecoveryPanel
            projections={snap.projections}
            appliedStrategies={snap.appliedStrategies}
            services={snap.services}
          />
        </aside>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-edge bg-panel/60 px-3 py-1.5 text-[10px] text-slate-500">
        <span>
          <span className="font-semibold tracking-wider text-slate-600">HOW IT WORKS</span>
          <span className="mx-1.5 text-slate-700">·</span>
          Simulated cluster → telemetry → AI prediction → verified against ground truth
        </span>
        <span className="font-mono">Orcathon 2026 · CascadeGuard</span>
      </footer>
    </div>
  )
}
