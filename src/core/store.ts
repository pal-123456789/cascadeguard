import { useSyncExternalStore } from 'react'
import { createEngine } from './engine/sim'
import { SEED_TOPOLOGY } from '../data/topology'
import { predictRisks } from './ai/predictor'
import { analyzeRootCauses } from './ai/rootcause'
import { projectStrategies } from './ai/recovery'
import { trackAccuracy } from './ai/accuracy'
import type { SimulationEngine, SimulationSnapshot } from './types'

function bootstrap(): SimulationEngine {
  const engine = createEngine(SEED_TOPOLOGY, {
    predict: predictRisks,
    rootCause: analyzeRootCauses,
    recovery: projectStrategies,
    accuracy: trackAccuracy,
  })
  engine.start()
  return engine
}

const engine: SimulationEngine = bootstrap()

let cache: SimulationSnapshot = engine.snapshot()
const listeners = new Set<() => void>()

engine.subscribe((snap) => {
  cache = snap
  listeners.forEach((l) => l())
})

function subscribeStore(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return cache
}

/** React hook — re-renders on every engine tick. */
export function useSimulation(): SimulationSnapshot {
  return useSyncExternalStore(subscribeStore, getSnapshot, getSnapshot)
}

export const actions = {
  toggleRun: () => (engine.isRunning() ? engine.pause() : engine.resume()),
  setSpeed: (mult: number) => engine.setSpeed(mult),
  loadScenario: (id: string) => engine.loadScenario(id),
  applyStrategy: (strategyId: string) => engine.applyStrategy(strategyId),
}
