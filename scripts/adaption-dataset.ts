#!/usr/bin/env node
/** Adaption dataset script — generates a clean telemetry dataset
 *  from simulated server logs, using the sponsor's data-quality pipeline.
 *  Run: pnpm ts-node scripts/adaption-dataset.ts (or build + node). */
import { cleanTelemetry } from '../src/adaption/use-adaption'

// Synthetic telemetry snapshot representing the live simulation state
const sampleTelemetry = [
  { timestamp: 11_000, service: 'orders-db', latencyMs: 247, errorRate: 0.22, saturation: 0.87, rawMessage: 'pool utilization 87% wait 180ms ERR_DB_POOL_EXHAUSTED' },
  { timestamp: 11_300, service: 'orders-db', latencyMs: 312, errorRate: 0.34, saturation: 0.94, rawMessage: 'HikariPool-1 connection is not available' },
  { timestamp: 13_200, service: 'payments-api', latencyMs: 43, errorRate: 0.02, saturation: 0.31, rawMessage: 'payment captured txn_739201 43ms' },
  { timestamp: 13_500, service: 'edge-gateway', latencyMs: 89, errorRate: 0.08, saturation: 0.72, rawMessage: 'GET /api/orders 504 gateway timeout after 892ms' },
]

async function main() {
  console.log('Adaption — cleaning telemetry dataset for CascadeGuard...')
  console.log('Records before clean:', sampleTelemetry.length)
  const cleaned = await cleanTelemetry(sampleTelemetry)
  console.log('Records after clean:', cleaned.length)
  console.log('First cleaned record:', JSON.stringify(cleaned[0]))
  console.log('Pipeline: [data-quality, improve-dataset-quality, normalize-ranges]')
}

main()
