// Headless integration smoke test — runs engine + AI modules in Node.
// Build with esbuild, run with node. Asserts the demo story end-to-end.
declare const process: { exit(code: number): void }
import { createEngine } from './engine/sim'
import { predictRisks } from './ai/predictor'
import { analyzeRootCauses } from './ai/rootcause'
import { projectStrategies } from './ai/recovery'
import { trackAccuracy } from './ai/accuracy'
import { SEED_TOPOLOGY } from '../data/topology'
import { SCENARIOS } from './engine/scenarios'
import type { SimulationSnapshot } from './types'

const SIM_MINUTES = 10
const TARGET_SIM_MS = SIM_MINUTES * 60_000

const engine = createEngine(SEED_TOPOLOGY, {
  predict: predictRisks,
  rootCause: analyzeRootCauses,
  recovery: projectStrategies,
  accuracy: trackAccuracy,
})

const results: string[] = []
const ok = (cond: boolean, label: string) => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  return cond
}

engine.loadScenario(SCENARIOS[0].id, 42)
engine.setSpeed(20)
engine.start()

let maxRiskSeen = 0
let predictedBeforeFailure = false
let firstFailureTs: number | null = null
let firstPredictionTs: number | null = null
let sawRootCauses = false
let sawRecommended = false
let sawLogs = false
let accuracy: SimulationSnapshot['accuracy'] | null = null

const unsub = engine.subscribe((snap) => {
  if (snap.logs.length > 0) sawLogs = true
  for (const r of Object.values(snap.risks)) {
    if (r.risk > maxRiskSeen) maxRiskSeen = r.risk
    if (r.predicted && firstPredictionTs === null) firstPredictionTs = snap.simTime
  }
  for (const s of Object.values(snap.services)) {
    if (s.metrics.failed && firstFailureTs === null) firstFailureTs = snap.simTime
  }
  if (snap.rootCauses.length > 0) sawRootCauses = true
  if (snap.projections.some((p) => p.verdict === 'recommended')) sawRecommended = true
  if (snap.simTime > TARGET_SIM_MS) {
    accuracy = snap.accuracy
    unsub()
    report(snap)
  }
})

function report(snap: SimulationSnapshot) {
  engine.pause()
  const incidents = snap.incidents.length
  const lead = firstFailureTs !== null && firstPredictionTs !== null ? firstFailureTs - firstPredictionTs : null

  ok(sawLogs, `logs streaming (${snap.logs.length} in window)`)
  ok(incidents >= 1, `incident detected (count=${incidents})`)
  ok(maxRiskSeen > 0.5, `predictor produced meaningful risk (max=${maxRiskSeen.toFixed(2)})`)
  ok(
    predictedBeforeFailure && lead !== null && lead > 0,
    `prediction preceded failure by ${lead !== null ? Math.round(lead / 1000) : '?'}s`,
  )
  ok(sawRootCauses, 'root-cause hypotheses produced during incident')
  ok(sawRecommended, 'recovery optimizer produced a recommended strategy')
  ok(accuracy !== null && accuracy.hits + accuracy.falseAlarms > 0, `accuracy tracker resolved predictions (${JSON.stringify(accuracy)})`)

  console.log('--- SMOKE RESULTS ---')
  results.forEach((r) => console.log(r))
  console.log(`scenario=${snap.scenarioId} simTime=${(snap.simTime / 60000).toFixed(1)}min`)
  console.log('accuracy=', JSON.stringify(snap.accuracy))
  console.log('incidents=', JSON.stringify(snap.incidents.map((i) => ({ sev: i.severity, origin: i.origin, title: i.title }))))
  const failedNow = Object.values(snap.services).filter((s) => s.metrics.failed).map((s) => s.id)
  console.log('failedNow=', failedNow.join(',') || '(none)')
  const fails = results.filter((r) => r.startsWith('FAIL')).length
  console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
  process.exit(fails === 0 ? 0 : 1)
}

// safety timeout
setTimeout(() => {
  console.log('TIMEOUT — engine did not reach target sim time')
  process.exit(2)
}, 180_000)
