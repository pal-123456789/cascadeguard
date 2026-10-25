import { memo } from 'react'
import { SEED_TOPOLOGY } from '../data/topology'
import type { RiskAssessment, ServiceId, ServiceKind, ServiceState, ServiceStatus } from '../core/types'

export interface TopologyProps {
  services: Record<string, ServiceState>
  risks: Record<string, RiskAssessment>
  selectedId: string | null
  onSelect: (id: ServiceId) => void
}

const KIND_LABELS: Record<ServiceKind, string> = {
  gateway: 'GATEWAY',
  api: 'API',
  database: 'DB',
  cache: 'CACHE',
  queue: 'QUEUE',
  worker: 'WORKER',
  storage: 'STORAGE',
  external: 'EXT',
}

interface StatusStyle {
  fill: string
  stroke: string
  accent: string
}

const STATUS_STYLE: Record<ServiceStatus, StatusStyle> = {
  healthy: { fill: '#0f172a', stroke: '#1e293b', accent: '#10b981' },
  degraded: { fill: '#171208', stroke: 'rgba(245,158,11,0.45)', accent: '#f59e0b' },
  critical: { fill: '#190d05', stroke: 'rgba(249,115,22,0.55)', accent: '#f97316' },
  failed: { fill: '#1b0909', stroke: 'rgba(239,68,68,0.7)', accent: '#ef4444' },
  recovering: { fill: '#07131f', stroke: 'rgba(56,189,248,0.5)', accent: '#38bdf8' },
}

const STATUS_LEGEND: ReadonlyArray<readonly [string, string]> = [
  ['#10b981', 'healthy'],
  ['#f59e0b', 'degraded'],
  ['#f97316', 'critical'],
  ['#ef4444', 'failed'],
  ['#38bdf8', 'recovering'],
]

function fmtRps(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n))
}

function fmtTtf(ms: number): string {
  const s = Math.max(0, ms / 1000)
  return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`
}

function TopologyInner({ services, risks, selectedId, onSelect }: TopologyProps) {
  const layout = new Map<string, { x: number; y: number }>(
    SEED_TOPOLOGY.nodes.map((n) => [n.id, n.layout] as const),
  )

  const counts: Record<ServiceStatus, number> = {
    healthy: 0,
    degraded: 0,
    critical: 0,
    failed: 0,
    recovering: 0,
  }
  for (const n of SEED_TOPOLOGY.nodes) {
    counts[services[n.id]?.status ?? 'healthy']++
  }
  const warningCount = counts.degraded + counts.critical

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Cluster Topology
        </h2>
        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums">
          <span className="text-emerald-400">{counts.healthy} ok</span>
          {warningCount > 0 && <span className="text-amber-400">{warningCount} warn</span>}
          {counts.failed > 0 && <span className="text-red-400">{counts.failed} down</span>}
          {counts.recovering > 0 && <span className="text-sky-400">{counts.recovering} rec</span>}
          <span className="text-slate-600">{SEED_TOPOLOGY.nodes.length} svc</span>
        </div>
      </div>

      <div className="p-2">
        <svg
          viewBox="0 0 860 540"
          className="h-auto w-full select-none rounded-lg border border-edge/60 bg-[#070b14]"
          role="img"
          aria-label="Service dependency topology map"
        >
          <defs>
            <pattern id="cg-grid" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(30,41,59,0.35)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="860" height="540" fill="url(#cg-grid)" />

          {/* Edges (drawn first so nodes overlay the endpoints) */}
          {SEED_TOPOLOGY.edges.map((e, i) => {
            const a = layout.get(e.from)
            const b = layout.get(e.to)
            if (!a || !b) return null
            const m = services[e.to]?.metrics
            const rps = m?.rps ?? 0
            const failed = m?.failed ?? false
            const err = m?.errorRate ?? 0
            const distress = failed || err > 0.2
            const width = 1.5 + Math.min(3.5, rps / 2000)
            const stroke = failed ? '#ef4444' : distress ? '#f59e0b' : e.critical ? '#334155' : '#1e293b'
            return (
              <line
                key={`${e.from}->${e.to}-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={distress || e.critical ? undefined : '4 4'}
                opacity={e.critical ? 1 : 0.7}
                className={distress ? 'flow' : undefined}
              />
            )
          })}

          {/* Nodes */}
          {SEED_TOPOLOGY.nodes.map((node) => {
            const st = services[node.id]
            const status: ServiceStatus = st?.status ?? 'healthy'
            const m = st?.metrics
            const rps = m?.rps ?? 0
            const err = m?.errorRate ?? 0
            const style = STATUS_STYLE[status]
            const risk = risks[node.id]
            const predicted = risk?.predicted ?? false
            const isSel = selectedId === node.id
            const kindLabel = KIND_LABELS[node.kind]
            const chipW = kindLabel.length * 4.6 + 8
            return (
              <g
                key={node.id}
                transform={`translate(${node.layout.x},${node.layout.y})`}
                onClick={() => onSelect(node.id)}
                className={`cursor-pointer transition-opacity hover:opacity-100 ${
                  isSel ? 'opacity-100' : 'opacity-95'
                }`}
              >
                {status === 'failed' && (
                  <circle className="pulse-ring" r={34} fill="none" stroke="#ef4444" strokeWidth={1.5} />
                )}
                {predicted && (
                  <circle
                    className="flow"
                    r={34}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth={1.2}
                    opacity={0.9}
                  />
                )}
                {isSel && (
                  <rect
                    x={-58}
                    y={-25}
                    width={116}
                    height={50}
                    rx={11}
                    fill="none"
                    stroke="#7dd3fc"
                    strokeWidth={1.3}
                    strokeDasharray="3 3"
                  />
                )}
                <rect
                  x={-55}
                  y={-22}
                  width={110}
                  height={44}
                  rx={8}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={1}
                  style={
                    status === 'failed' || status === 'critical'
                      ? { filter: `drop-shadow(0 0 6px ${style.accent}66)` }
                      : undefined
                  }
                />
                <rect x={-55} y={-22} width={3.5} height={44} rx={1.75} fill={style.accent} />
                <text x={-46} y={-5} fontSize={11} fontWeight={600} fill="#e2e8f0">
                  {node.name}
                </text>
                <rect x={-46} y={2} width={chipW} height={11} rx={3} fill={style.accent} opacity={0.14} />
                <text
                  x={-46 + chipW / 2}
                  y={10}
                  fontSize={6.5}
                  fontWeight={700}
                  letterSpacing={0.5}
                  fill={style.accent}
                  textAnchor="middle"
                >
                  {kindLabel}
                </text>
                <text
                  x={48}
                  y={10.5}
                  fontSize={8.5}
                  fill={err > 0.2 ? '#f59e0b' : '#64748b'}
                  textAnchor="end"
                  className="font-mono"
                >
                  {fmtRps(rps)} rps
                </text>

                {/* Risk halo: violet dashed ring + pill + TTF countdown */}
                {predicted && risk && (
                  <>
                    <g transform="translate(0,-49)">
                      <rect
                        x={-27}
                        y={-7}
                        width={54}
                        height={13}
                        rx={6.5}
                        fill="rgba(139,92,246,0.18)"
                        stroke="rgba(139,92,246,0.55)"
                        strokeWidth={0.8}
                      />
                      <text x={0} y={2.5} fontSize={7.5} textAnchor="middle" fill="#c4b5fd" className="font-mono">
                        risk {Math.round(risk.risk * 100)}%
                      </text>
                    </g>
                    {risk.ttfMs !== undefined && (
                      <text x={0} y={-28} fontSize={7.5} textAnchor="middle" fill="#a78bfa" className="font-mono">
                        TTF ~{fmtTtf(risk.ttfMs)}
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge px-3 py-2 text-[10px] text-slate-500">
        {STATUS_LEGEND.map(([color, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-violet-400" />
          predicted risk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 bg-amber-400" />
          distress flow
        </span>
        <span className="ml-auto hidden text-slate-600 sm:inline">click a node to inspect</span>
      </div>
    </section>
  )
}

export const Topology = memo(TopologyInner)
export default Topology
