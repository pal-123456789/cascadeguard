import { createEngine } from '../src/core/engine/sim'
import { predictRisks } from '../src/core/ai/predictor'
import { analyzeRootCauses } from '../src/core/ai/rootcause'
import { projectStrategies } from '../src/core/ai/recovery'
import { trackAccuracy } from '../src/core/ai/accuracy'
import { SEED_TOPOLOGY } from '../src/data/topology'
import { SCENARIOS } from '../src/core/engine/scenarios'
import type { SimulationSnapshot } from '../src/core/types'

const scenarioId = process.argv[2] ?? SCENARIOS[0].id
const watch = process.argv[3] ?? 'orders-db'

const engine = createEngine(SEED_TOPOLOGY, {
  predict: predictRisks,
  rootCause: analyzeRootCauses,
  recovery: projectStrategies,
  accuracy: trackAccuracy,
})
engine.loadScenario(scenarioId, 42)
engine.setSpeed(10)

console.log(`scenario=${scenarioId} watching=${watch}`)
console.log('simTime  sat   err   cpu   mem   risk  pred  failed')

let printed = 0
engine.subscribe((snap: SimulationSnapshot) => {
  const svc = snap.services[watch]
  if (!svc) return
  const risk = snap.risks[watch]
  const interesting =
    svc.metrics.saturation > 0.5 || svc.metrics.errorRate > 0.02 || risk?.predicted || svc.metrics.failed
  if (!interesting && printed > 40) return
  console.log(
    [
      String(Math.round(snap.simTime / 1000)).padStart(6),
      svc.metrics.saturation.toFixed(2).padStart(5),
      svc.metrics.errorRate.toFixed(2).padStart(5),
      svc.metrics.cpu.toFixed(2).padStart(5),
      svc.metrics.memory.toFixed(2).padStart(5),
      (risk?.risk ?? 0).toFixed(2).padStart(5),
      risk?.predicted ? 'YES' : ' - ',
      svc.metrics.failed ? 'DEAD' : '  - ',
    ].join(' '),
  )
  printed++
})

engine.start()
setTimeout(() => {
  engine.pause()
  process.exit(0)
}, 12_000)
