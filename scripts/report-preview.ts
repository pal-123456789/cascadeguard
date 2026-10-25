#!/usr/bin/env node
// Renders the incident report headlessly so the export path can be verified
// without a browser. Usage: node tmp-report/report.js
import { createEngine } from '../src/core/engine/sim'
import { predictRisks } from '../src/core/ai/predictor'
import { analyzeRootCauses } from '../src/core/ai/rootcause'
import { projectStrategies } from '../src/core/ai/recovery'
import { trackAccuracy } from '../src/core/ai/accuracy'
import { SEED_TOPOLOGY } from '../src/data/topology'
import { buildIncidentReport } from '../src/core/report'

const engine = createEngine(SEED_TOPOLOGY, {
  predict: predictRisks,
  rootCause: analyzeRootCauses,
  recovery: projectStrategies,
  accuracy: trackAccuracy,
})
engine.loadScenario('pool-exhaustion', 42)
engine.setSpeed(20)
engine.start()

setTimeout(() => {
  engine.pause()
  const snap = engine.snapshot()
  console.log('--- DIAGNOSTICS ---')
  console.log('simTime', Math.round(snap.simTime / 1000), 's')
  console.log('rootCauses:', snap.rootCauses.length)
  console.log('incidents:', JSON.stringify(snap.incidents.map((i) => ({ id: i.id, origin: i.origin, services: i.services, resolved: i.resolvedAt !== undefined }))))
  console.log('alerts:', JSON.stringify(snap.alerts.slice(-6)))
  for (const s of Object.values(snap.services)) {
    console.log(
      `${s.id} status=${s.status} hist=${s.history.length} sat=${s.metrics.saturation} err=${s.metrics.errorRate}`,
    )
  }
  const db = snap.services['orders-db']
  if (db) {
    const h = db.history
    console.log('--- orders-db history (first 6, last 6) ---')
    for (const m of h.slice(0, 6)) console.log(`  t=${m.ts} err=${m.errorRate} sat=${m.saturation} p99=${m.latencyP99} mem=${m.memory}`)
    console.log('  ...')
    for (const m of h.slice(-6)) console.log(`  t=${m.ts} err=${m.errorRate} sat=${m.saturation} p99=${m.latencyP99} mem=${m.memory}`)
    const errs = h.map((m) => m.errorRate).sort((a, b) => a - b)
    const sats = h.map((m) => m.saturation).sort((a, b) => a - b)
    console.log('  err p10 =', errs[Math.floor(errs.length * 0.1)], 'max', errs[errs.length - 1])
    console.log('  sat p10 =', sats[Math.floor(sats.length * 0.1)], 'max', sats[sats.length - 1])
  }
  const md = buildIncidentReport(snap)
  console.log(md)
  console.log('\n--- report length:', md.length, 'chars ---')
  process.exit(0)
}, 9_000)
