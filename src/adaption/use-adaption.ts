// ============================================================
// Adaption Integration — "Best Use of Adaption" ($100 sponsor track)
// Uses the sponsor's Adaptive Intelligence / Data Quality pipeline
// to clean simulated telemetry before feeding the predictor.
// ============================================================

const ADAPTION_KEY = 'pt_live_7365e2c39068eb2e3e743627d8a8001f8cd3cb3d'
const ADAPTION_ENDPOINT = 'https://api.adaption.ai/v1/data-quality/clean'

export interface TelemetryRecord {
  timestamp: number
  service: string
  latencyMs: number
  errorRate: number
  saturation: number
  rawMessage: string
}

export async function cleanTelemetry(payload: TelemetryRecord[]): Promise<TelemetryRecord[]> {
  try {
    const res = await fetch(ADAPTION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADAPTION_KEY}`,
        'Content-Type': 'application/json',
        'X-Project': 'CascadeGuard-Orcathon-2026',
      },
      body: JSON.stringify({
        dataset: 'orcathon-cascadeguard-telemetry-v1',
        records: payload.map((r) => ({
          ...r,
          rawMessage: r.rawMessage.slice(0, 500),
        })),
        pipeline: ['data-quality', 'improve-dataset-quality', 'normalize-ranges'],
      }),
    })
    if (!res.ok) throw new Error(`Adaption status ${res.status}`)
    const data = (await res.json()) as { cleaned: TelemetryRecord[] }
    return data.cleaned ?? payload
  } catch {
    // Graceful fallback: if the endpoint is unreachable or unauthenticated,
    // return the original payload unmodified — predictor continues.
    return payload
  }
}
