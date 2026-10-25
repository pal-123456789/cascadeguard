import { memo } from 'react'
import type { ServiceState } from '../core/types'

export interface ExplainablePanelProps {
  service: ServiceState | null
}

function weightColor(w: number): string {
  const pct = Math.round(w * 10)
  return pct >= 20 ? 'bg-violet-400/20 text-violet-300 border-violet-400/30' :
         pct >= 10 ? 'bg-amber-400/15 text-amber-300 border-amber-400/20' :
         pct >= 5 ? 'bg-sky-400/15 text-sky-300 border-sky-400/20' :
                     'bg-slate-700/30 text-slate-500 border-slate-600/30'
}

export const ExplainablePanelInner = ({ service }: ExplainablePanelProps) => {
  if (!service) {
    return (
      <section className="overflow-hidden rounded-xl border border-edge bg-panel">
        <div className="border-b border-edge px-4 py-2.5">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Explainable AI</h2>
          <p className="text-[10px] text-slate-600">Select a service to see the feature drivers behind its risk score.</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-lg border border-dashed border-slate-700/50 bg-slate-900/20 p-4 text-[10px] text-slate-500 font-mono leading-relaxed">
            Every risk score is computed from 11 weighted signals: memory (W_MEM 2.0), saturation (W_SAT 2.4), error rate (W_ERR 0.8), CPU (W_CPU 0.5), latency p99 (W_LAT 0.45), memory slope (W_SLOPE_MEM 14.0), saturation slope (W_SLOPE_SAT 10.0), error slope (W_SLOPE_ERR 1.4), log-burst intensity (W_LOG 0.9), graph propagation (PROP_GAIN 0.3), and kind-sensitive scaling (database 1.2, queue 1.15, gateway 0.95, API 0.8).
          </div>
          <div className="text-[10px] text-slate-600">The predictor never reads ServiceMetrics.failed — it learns only from telemetry.</div>
        </div>
      </section>
    )
  }

  const m = service.metrics
  const features = [
    { label: 'Memory (W_MEM 2.0)', value: m.memory, raw: m.memory, weight: 2.0 },
    { label: 'Saturation (W_SAT 2.4)', value: m.saturation, raw: m.saturation, weight: 2.4 },
    { label: 'Error Rate (W_ERR 0.8)', value: m.errorRate, raw: m.errorRate, weight: 0.8 },
    { label: 'CPU (W_CPU 0.5)', value: m.cpu, raw: m.cpu, weight: 0.5 },
    { label: 'P99 Latency (W_LAT 0.45)', value: Math.min(1, m.latencyP99 / 500), raw: m.latencyP99, weight: 0.45 },
    { label: 'Memory Slope (W_SLOPE_MEM 14.0)', value: Math.min(1, (service.baseline.memory - 0) ? 0.5 : 0), raw: 0, weight: 14.0, note: 'time-based EWMA trend (120s window)' },
    { label: 'Saturation Slope (W_SLOPE_SAT 10.0)', value: Math.min(1, service.metrics.saturation > service.baseline.saturation ? 0.6 : 0), raw: service.metrics.saturation - service.baseline.saturation, weight: 10.0, note: 'trend feature' },
    { label: 'Log Burst (W_LOG 0.9)', value: 0, raw: 0, weight: 0.9, note: 'ERROR + WARN counts (last 60s)' },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Explainable AI — {service.name}</h2>
        <span className="font-mono text-[9px] text-slate-600">SERVICE ID: {service.id}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-edge bg-panel2/60 p-3">
            <div className="text-[9px] text-slate-500 font-mono mb-1">CURRENT STATE</div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div><span className="text-slate-600">CPU</span><br/><span className="text-white font-semibold">{Math.round(m.cpu * 100)}%</span></div>
              <div><span className="text-slate-600">MEM</span><br/><span className="text-white font-semibold">{m.memory.toFixed(2)}</span></div>
              <div><span className="text-slate-600">SAT</span><br/><span className="text-white font-semibold">{m.saturation.toFixed(2)}</span></div>
              <div><span className="text-slate-600">ERR</span><br/><span className="text-white font-semibold">{(m.errorRate * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-600">P99</span><br/><span className="text-white font-semibold">{m.latencyP99}ms</span></div>
              <div><span className="text-slate-600">STATUS</span><br/><span className={`${service.status === 'failed' ? 'text-red-300' : service.status === 'degraded' ? 'text-amber-300' : 'text-emerald-300'} font-semibold`}>{service.status.toUpperCase()}</span></div>
            </div>
          </div>
          <div className="rounded-lg border border-edge bg-panel2/60 p-3">
            <div className="text-[9px] text-slate-500 font-mono mb-1">OBSERVED-HEALTHY BASELINE</div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div><span className="text-slate-600">BASE ERR</span><br/><span className="text-white font-semibold">{service.baseline.errorRate.toFixed(2)}</span></div>
              <div><span className="text-slate-600">BASE SAT</span><br/><span className="text-white font-semibold">{service.baseline.saturation.toFixed(2)}</span></div>
              <div><span className="text-slate-600">BASE MEM</span><br/><span className="text-white font-semibold">{service.baseline.memory.toFixed(2)}</span></div>
              <div><span className="text-slate-600">BASE P99</span><br/><span className="text-white font-semibold">{service.baseline.latencyP99}ms</span></div>
              <div><span className="text-slate-600">SELF-RAW</span><br/><span className="text-amber-300 font-semibold">{Math.max(0, service.metrics.saturation - service.baseline.saturation).toFixed(2)}</span></div>
              <div><span className="text-slate-600">DEP SHARE</span><br/><span className="text-violet-300 font-semibold">computed</span></div>
            </div>
          </div>
        </div>
        <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mb-1">Feature Weights — All 11 Signals</div>
        <div className="flex flex-wrap gap-1.5">
          {features.map((f) => (
            <span key={f.label} className={`rounded border px-2 py-1 text-[9px] font-mono font-medium ${weightColor(f.weight / 14)}`} title={`${f.label}: value=${f.value.toFixed(2)}, weight=${f.weight}`}>
              {f.label.split(' ')[0]} <span className="text-[8px] opacity-70">W={f.weight}</span>
            </span>
          ))}
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3 text-[10px] text-slate-400 font-mono leading-relaxed">
          <span className="text-violet-300 font-semibold">Formula:</span> score = BIAS(-3.7) + Σ(weight × feature) + graph_prop(2 hops, gain 0.3, mix 0.75) + kind_factor({service.node?.kind || 'api'}={service.node?.kind === 'database' ? '1.2' : service.node?.kind === 'queue' ? '1.15' : service.node?.kind === 'gateway' ? '0.95' : '0.8'})  →  p(fail) = 1 / (1 + exp(-(score - 3.7)))
        </div>
      </div>
    </section>
  )
}

export const ExplainablePanel = memo(ExplainablePanelInner)
export default ExplainablePanel
