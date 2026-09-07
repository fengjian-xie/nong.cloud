import type { DashboardData } from '../types'

const width = 680
const height = 250
const pad = { left: 40, right: 18, top: 22, bottom: 35 }

function points(values: number[], max: number) {
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  return values.map((value, index) => `${pad.left + (index * innerW) / (values.length - 1)},${pad.top + innerH - (value / max) * innerH}`).join(' ')
}

export function TrendChart({ trend, label }: { trend: DashboardData['trend']; label: string }) {
  const max = Math.max(50, Math.ceil(Math.max(...trend.map((item) => item.tasks)) / 30) * 30)
  const taskPoints = points(trend.map((item) => item.tasks), max)
  const alertPoints = points(trend.map((item) => item.alerts), max)
  const weatherPoints = points(trend.map((item) => item.weather), max)
  return (
    <div className="chart-wrap">
      <div className="chart-legend"><span><i className="green" />农事任务</span><span><i className="amber" />风险预警</span><span><i className="sage" />气象提醒</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}农事任务、风险预警与气象提醒趋势图`}>
        {[0, .25, .5, .75, 1].map((ratio) => {
          const v = Math.round(max * ratio)
          const y = pad.top + (height - pad.top - pad.bottom) - (v / max) * (height - pad.top - pad.bottom)
          return <g key={v}><line x1={pad.left} y1={y} x2={width - pad.right} y2={y} className="grid-line" /><text x={8} y={y + 4}>{v}</text></g>
        })}
        <polyline points={taskPoints} className="trend-line task" />
        <polyline points={alertPoints} className="trend-line alert" />
        <polyline points={weatherPoints} className="trend-line weather" />
        {trend.map((item, index) => {
          const x = pad.left + (index * (width - pad.left - pad.right)) / (trend.length - 1)
          return <g key={item.date}><circle cx={x} cy={taskPoints.split(' ')[index].split(',')[1]} r="4" className="task-dot" /><text x={x} y={height - 10} textAnchor="middle">{item.date}</text></g>
        })}
      </svg>
    </div>
  )
}
