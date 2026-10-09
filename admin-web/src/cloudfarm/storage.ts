import { findPlot } from './site'

export const demoStorageKey = 'xiangqiao:cloudfarm-demo:v1'
export const deliveries = ['待协商', '自提', '配送'] as const
export type Delivery = typeof deliveries[number]
export type DemoIntent = { id: string; plotId: string; alias: string; quantity: number; delivery: Delivery; createdAt: string }
export type DemoState = { version: 1; favorites: string[]; intents: DemoIntent[] }
export const emptyDemoState = (): DemoState => ({ version: 1, favorites: [], intents: [] })
export const validAlias = (alias: string) => alias.trim().length <= 20 && !/[\d\s]{7,}|@|https?:/i.test(alias)

export function parseDemoState(raw: string | null): DemoState {
  if (!raw) return emptyDemoState()
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return emptyDemoState()
    const data = value as Partial<DemoState>
    if (data.version !== 1 || !Array.isArray(data.favorites) || !Array.isArray(data.intents)) return emptyDemoState()
    const favorites = [...new Set(data.favorites.filter(id => typeof id === 'string' && findPlot(id)))]
    const intents: DemoIntent[] = []
    for (const candidate of data.intents.slice(0, 100)) {
      if (!candidate || typeof candidate !== 'object') continue
      const { id, plotId, alias, quantity, delivery, createdAt } = candidate
      if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || typeof plotId !== 'string' || !findPlot(plotId)
        || typeof alias !== 'string' || !validAlias(alias) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10
        || !deliveries.includes(delivery) || typeof createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) continue
      if (!intents.some(intent => intent.id === id)) intents.push({ id, plotId, alias, quantity, delivery, createdAt })
    }
    return { version: 1, favorites, intents }
  } catch { return emptyDemoState() }
}

export function loadDemoState() {
  try { return { state: parseDemoState(localStorage.getItem(demoStorageKey)), available: true } }
  catch { return { state: emptyDemoState(), available: false } }
}
export function saveDemoState(state: DemoState) {
  try {
    // Serialize only our validated, minimal fields; never copy tokens or server records.
    localStorage.setItem(demoStorageKey, JSON.stringify(parseDemoState(JSON.stringify(state))))
    return true
  } catch { return false }
}
