import { AlertTriangle, ClipboardList, CloudSun, LandPlot, Sprout, Tractor, UsersRound } from 'lucide-react'
import type { Metric } from '../types'

const iconMap = { land: LandPlot, sprout: Sprout, clipboard: ClipboardList, alert: AlertTriangle, cloud: CloudSun, users: UsersRound, tractor: Tractor }

export function MetricStrip({ metrics, comparisonLabel }: { metrics: Metric[]; comparisonLabel: string }) {
  return (
    <section className="metric-strip" aria-label="运营指标">
      {metrics.map((metric) => {
        const Icon = iconMap[metric.icon as keyof typeof iconMap] ?? ClipboardList
        return (
          <article className="metric" key={metric.key}>
            <div className="metric-icon"><Icon size={24} strokeWidth={1.7} /></div>
            <div><span>{metric.label}</span><strong>{metric.value}<small>{metric.unit}</small></strong><em className={metric.delta < 0 ? 'down' : ''}>{comparisonLabel} {Math.abs(metric.delta)}% {metric.delta < 0 ? '↓' : '↑'}</em></div>
          </article>
        )
      })}
    </section>
  )
}
