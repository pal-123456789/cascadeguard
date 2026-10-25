import { memo } from 'react'
import type { ServiceId, ServiceState, SloImpact } from '../core/types'

export interface ImpactPanelProps {
  impact: SloImpact
  services: Record<ServiceId, ServiceState>
}

/**
 * Business Impact & SLO — translates raw telemetry into the language
 * that judges and executives care about: user impact, error-budget
 * burn rate, revenue at risk, and blast radius.
 */
function ImpactPanelInner({ impact, services }: ImpactPanelProps) {
  const burn = Number.isFinite(impact.sloBurnRate) ? impact.sloBurnRate : 1
  const pct = Number.isFinite(impact.userImpactPct) ? impact.userImpactPct : 0
  const revenue = Number.isFinite(impact.revenueAtRiskPerMin) ? impact.revenueAtRiskPerMin : 0
  const burnPct = Math.min(1, (burn - 1) / 9)

  const sev = impact.severity
  const sevColor =
    sev === 'critical' ? 'text-red-400' : sev === 'elevated' ? 'text-amber-400' : 'text-emerald-400'
  const sevBorder =
    sev === 'critical'
      ? 'border-red-500/40 bg-red-500/10'
      : sev === 'elevated'
        ? 'border-amber-500/40 bg-amber-500/10'
        : 'border-emerald-500/30 bg-emerald-500/10'

  const blast = Object.entries(services)
    .filter(([, s]) => s.status === 'failed' || s.status === 'critical' || s.status === 'degraded')
    .map(([id, s]) => ({ id, name: s.name, status: s.status }))

  const R = 26
  const C = 2 * Math.PI * R

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Business Impact &amp; SLO
        </h2>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${sevBorder} ${sevColor}`}>
          {sev.toUpperCase()}
        </span>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* SLO burn ring */}
          <svg width="66" height="66" viewBox="0 0 66 66" className="shrink-0">
            <circle cx="33" cy="33" r={R} fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="33"
              cy="33"
              r={R}
              fill="none"
              stroke={burn > 5 ? '#f87171' : burn > 2 ? '#fbbf24' : '#34d399'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${C * burnPct} ${C}`}
              transform="rotate(-90 33 33)"
              style={{ transition: 'stroke-dasharray 600ms ease' }}
            />
            <text
              x="33"
              y="31"
              textAnchor="middle"
              className="fill-slate-100 font-mono"
              fontSize="15"
              fontWeight="700"
            >
              {burn.toFixed(1)}×
            </text>
            <text x="33" y="43" textAnchor="middle" className="fill-slate-500" fontSize="7.5" letterSpacing="0.8">
              SLO BURN
            </text>
          </svg>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div>
              <div className="flex items-baseline justify-between text-[10px] text-slate-500">
                <span>User-facing flow degraded</span>
                <span className="font-mono tabular-nums text-slate-200">{(pct * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500"
                  style={{ width: `${Math.max(2, pct * 100)}%`, transition: 'width 500ms ease' }}
                />
              </div>
            </div>
            <div className="flex items-baseline justify-between text-[10px] text-slate-500">
              <span>Revenue at risk</span>
              <span className="font-mono tabular-nums text-slate-200">
                ${(revenue / 1000).toFixed(1)}k/min
              </span>
            </div>
            <div className="flex items-baseline justify-between text-[10px] text-slate-500">
              <span>Services impacted</span>
              <span className="font-mono tabular-nums text-slate-200">
                {impact.affectedServices} / {Object.keys(services).length}
              </span>
            </div>
          </div>
        </div>

        {blast.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-edge pt-2">
            {blast.map((b) => (
              <span
                key={b.id}
                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                  b.status === 'failed'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : b.status === 'critical'
                      ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                {b.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export const ImpactPanel = memo(ImpactPanelInner)
export default ImpactPanel
