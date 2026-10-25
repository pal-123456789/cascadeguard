#!/usr/bin/env node
/**
 * CascadeGuard — evaluation entry point.
 *
 * Runs every fault scenario head-less through the real engine + AI
 * modules, prints a readable results table to stdout and writes the
 * JSON report to:
 *   - public/evaluation-report.json
 *   - docs/evaluation-report.json
 *
 * Build & run (from the project root):
 *   pnpm exec vite build --ssr scripts/evaluate.ts --outDir tmp-eval --logLevel error
 *   node tmp-eval/evaluate.js
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { runEvaluation, type EvaluationReport, type ScenarioEvaluation } from '../src/core/eval/evaluation'

declare const process: {
  cwd(): string
  exit(code: number): void
  env: Record<string, string | undefined>
}

const REPORT_FILES = ['public/evaluation-report.json', 'docs/evaluation-report.json']

const pad = (v: string | number, width: number) => String(v).padEnd(width)

function fmtLead(ms: number | null): string {
  if (ms === null) return 'n/a'
  return `${(ms / 1000).toFixed(0)}s`
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

function printTable(report: EvaluationReport): void {
  const rows = report.scenarios
  console.log('')
  console.log('CascadeGuard — headless scenario evaluation')
  console.log(`seed=${report.seed}  sim=${report.simMinutes}min  generated=${report.generatedAt}`)
  console.log('')
  console.log(
    pad('SCENARIO', 26) +
      pad('LEAD(s)', 9) +
      pad('ORIGIN', 26) +
      pad('MATCH', 7) +
      pad('PREC', 7) +
      pad('REC', 7) +
      pad('FAILED', 8) +
      pad('IMPACT', 8) +
      'BEST STRATEGY',
  )
  console.log('-'.repeat(112))
  for (const s of rows) {
    const origin = s.predictedOrigin ?? '(none)'
    const truth = s.trueOrigin ?? '(none)'
    const originCell =
      s.predictedOrigin === null ? '(none)' : `${origin}${s.originMatch ? ' ✓' : ` (true: ${truth})`}`
    console.log(
      pad(s.scenarioId, 26) +
        pad(fmtLead(s.predictionLeadTimeMs), 9) +
        pad(originCell, 26) +
        pad(s.originMatch ? 'YES' : 'no', 7) +
        pad(fmtPct(s.precision), 7) +
        pad(fmtPct(s.recall), 7) +
        pad(s.servicesFailed, 8) +
        pad(s.servicesImpacted, 8) +
        (s.bestStrategyId ?? '(none)') +
        (s.bestStrategyId ? ` @${s.bestStrategySuccessProbability.toFixed(2)}` : ''),
    )
  }
  console.log('-'.repeat(112))
  const a = report.aggregate
  console.log(
    `avg lead=${fmtLead(a.avgPredictionLeadTimeMs)}  origin accuracy=${fmtPct(a.originAccuracy)}  ` +
      `avg precision=${fmtPct(a.avgPrecision)}  avg recall=${fmtPct(a.avgRecall)}  ` +
      `hits=${a.totalHits}  missed=${a.totalMissed}`,
  )
  console.log('')
}

function writeReports(report: EvaluationReport): void {
  const root = process.cwd()
  const json = `${JSON.stringify(report, null, 2)}\n`
  for (const rel of REPORT_FILES) {
    const abs = `${root}/${rel}`
    const dir = abs.slice(0, abs.lastIndexOf('/'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(abs, json, 'utf8')
    console.log(`wrote ${rel}`)
  }
}

async function main(): Promise<void> {
  const g = globalThis as { __CG_SPEED__?: number; __CG_DEBUG__?: boolean }
  g.__CG_SPEED__ = Number(process.env.CG_SPEED ?? 20)
  g.__CG_DEBUG__ = process.env.CG_DEBUG === '1'
  console.log(
    `Running CascadeGuard evaluation (4 scenarios × 12 sim-minutes, speed=${g.__CG_SPEED__})...`,
  )
  const report = await runEvaluation()
  printTable(report)
  writeReports(report)
  // the engine keeps real-time intervals alive — exit explicitly
  process.exit(0)
}

main().catch((err) => {
  console.error('evaluation failed:', err)
  process.exit(1)
})

export type { EvaluationReport, ScenarioEvaluation }
