export function StatusChip({ children }: { children: React.ReactNode }) {
  const text = String(children)
  const tone = /通过|完成|发布|分派|已核验/.test(text) ? 'positive' : /驳回|超时|未通过/.test(text) ? 'negative' : /待|执行|审核|纠偏|草稿/.test(text) ? 'pending' : 'neutral'
  return <span className={`status-chip ${tone}`}>{children}</span>
}
