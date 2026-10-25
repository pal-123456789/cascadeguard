import type { ScenarioDef } from '../types'

/**
 * Fault scenario library. Each id is interpreted by the engine's
 * fault dynamics. Metadata drives the UI selector.
 */
export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'pool-exhaustion',
    name: 'Connection Pool Exhaustion',
    tagline: 'Orders-DB pool leak starves the order path',
    description:
      'A connection leak on Orders-DB slowly drains the pool. Saturation creeps up, queries queue, retries amplify through Orders API and Inventory API, and the cascade reaches the gateway. The classic silent killer.',
    faultStartMs: 45_000,
  },
  {
    id: 'memory-leak',
    name: 'Memory Leak → OOM',
    tagline: 'Payments API heap creep ends in OOM',
    description:
      'Payments API leaks heap every request. GC thrash degrades latency long before the OOM kill — the predictor should catch the creep minutes in advance, then watch the blast radius hit Payments-DB and Kafka.',
    faultStartMs: 30_000,
  },
  {
    id: 'traffic-surge',
    name: 'Traffic Surge (3×)',
    tagline: 'Flash-sale traffic overloads the edge',
    description:
      'A marketing spike triples traffic for three minutes. The gateway and Inventory API saturate, the Redis cache stampedes, and overload spills into Orders-DB. Tests capacity planning and shed-load strategies.',
    faultStartMs: 20_000,
  },
  {
    id: 'retry-storm',
    name: 'Retry Storm',
    tagline: 'A 30s blip becomes a self-sustaining storm',
    description:
      'Payments-DB suffers a brief blip, but Payments API retries with 4× amplification. When the blip heals, the retry backlog is already self-sustaining — the system attacks itself. A circuit-breaker or shed-load saves it.',
    faultStartMs: 25_000,
  },
]

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id)
export const DEFAULT_SCENARIO = SCENARIOS[0].id
