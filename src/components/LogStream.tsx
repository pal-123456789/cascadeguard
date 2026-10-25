import { memo, useEffect, useRef, useState } from 'react'
import type { LogEvent, LogLevel } from '../core/types'

export interface LogStreamProps {
  logs: LogEvent[]
  running: boolean
}

type LevelFilter = 'all' | 'warn' | 'error'

const FILTERS: ReadonlyArray<readonly [LevelFilter, string]> = [
  ['all', 'ALL'],
  ['warn', 'WARN+'],
  ['error', 'ERRORS'],
]

const LEVEL_RANK: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 }
const LEVEL_MIN: Record<LevelFilter, number> = { all: 0, warn: 2, error: 3 }

const LEVEL_STYLE: Record<LogLevel, string> = {
  DEBUG: 'text-slate-500',
  INFO: 'text-sky-400/90',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  FATAL: 'bg-red-500 text-red-50',
}

const SERVICE_PALETTE: ReadonlyArray<string> = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#22d3ee',
  '#fb923c',
  '#4ade80',
  '#f87171',
  '#e879f9',
]

function serviceColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SERVICE_PALETTE[h % SERVICE_PALETTE.length]
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function LogStreamInner({ logs, running }: LogStreamProps) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [svcFilter, setSvcFilter] = useState<string>('all')
  const boxRef = useRef<HTMLDivElement | null>(null)
  const stickRef = useRef(true)
  const lastKeyRef = useRef('')

  const filtered = logs.filter(
    (l) => LEVEL_RANK[l.level] >= LEVEL_MIN[levelFilter] && (svcFilter === 'all' || l.service === svcFilter),
  )
  const visible = filtered.slice(-80)
  const lastKey = visible.length > 0 ? `${visible.length}:${visible[visible.length - 1].id}` : 'empty'

  // Autoscroll to newest unless the user scrolled up.
  useEffect(() => {
    if (lastKey === lastKeyRef.current) return
    lastKeyRef.current = lastKey
    const el = boxRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [lastKey])

  const handleScroll = (): void => {
    const el = boxRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32
  }

  const serviceIds = Array.from(new Set(logs.map((l) => l.service))).sort()

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Log Stream</h2>
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${
              running
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`}
            />
            {running ? 'LIVE' : 'PAUSED'}
          </span>
          <span className="font-mono text-[9px] tabular-nums text-slate-600">{visible.length} rows</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-edge">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setLevelFilter(id)}
                className={`px-1.5 py-0.5 text-[9px] font-semibold tracking-wider transition-colors ${
                  levelFilter === id
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-panel2 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={svcFilter}
            onChange={(e) => setSvcFilter(e.target.value)}
            className="h-[22px] max-w-[120px] rounded border border-edge bg-panel2 px-1 text-[9px] text-slate-400 outline-none transition-colors hover:border-slate-600"
            aria-label="Filter logs by service"
          >
            <option value="all" className="bg-panel2">
              All services
            </option>
            {serviceIds.map((id) => (
              <option key={id} value={id} className="bg-panel2">
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={boxRef}
        onScroll={handleScroll}
        className="h-[220px] overflow-y-auto px-2 py-1"
        aria-label="Simulation log stream"
      >
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-[11px] text-slate-600">
            {logs.length === 0 ? 'Waiting for telemetry…' : 'No logs match the current filter'}
          </div>
        ) : (
          visible.map((l) => {
            const c = serviceColor(l.service)
            const isError = l.level === 'ERROR'
            const isFatal = l.level === 'FATAL'
            return (
              <div
                key={l.id}
                className={`flex items-center gap-2 rounded px-1.5 py-px font-mono text-[11px] leading-4 ${
                  isFatal ? 'bg-red-500/[0.12]' : isError ? 'bg-red-500/[0.06]' : ''
                }`}
              >
                <span className="shrink-0 text-slate-600">{fmtClock(l.ts)}</span>
                <span
                  className="min-w-[88px] max-w-[88px] shrink-0 truncate rounded border px-1 text-[9px]"
                  style={{ color: c, backgroundColor: `${c}14`, borderColor: `${c}33` }}
                  title={l.service}
                >
                  {l.service}
                </span>
                <span
                  className={`w-[42px] shrink-0 rounded text-center text-[9px] font-semibold ${LEVEL_STYLE[l.level]}`}
                >
                  {l.level}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${isFatal ? 'text-red-300' : isError ? 'text-red-200/90' : 'text-slate-300'}`}
                  title={l.message}
                >
                  {l.message}
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export const LogStream = memo(LogStreamInner)
export default LogStream
