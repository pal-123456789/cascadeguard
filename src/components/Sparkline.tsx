import { memo } from 'react'

export interface SparklineProps {
  values: number[]
  color?: string
  height?: number
  className?: string
}

/** Tiny dependency-free sparkline: normalized inline SVG polyline + soft area fill. */
function SparklineInner({ values, color = '#8b5cf6', height = 28, className }: SparklineProps) {
  if (values.length === 0) {
    return <div style={{ height }} className={className} aria-hidden="true" />
  }

  const w = 100
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const n = values.length

  const x = (i: number): number => (n === 1 ? w / 2 : (i / (n - 1)) * w)
  const y = (v: number): number => {
    if (range === 0) return height / 2
    return height - 2 - ((v - min) / range) * (height - 4)
  }

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `0,${height} ${points} ${w},${height}`

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      className={`w-full ${className ?? ''}`}
      aria-hidden="true"
    >
      <polygon points={area} fill={color} opacity={0.12} />
      {n === 1 ? (
        <circle cx={x(0)} cy={y(values[0])} r={2} fill={color} />
      ) : (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}

export const Sparkline = memo(SparklineInner)
export default Sparkline
