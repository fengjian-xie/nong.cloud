import { useState } from 'react'
import { findPlot } from './site'
import { deliveries, emptyDemoState, loadDemoState, saveDemoState, validAlias, type DemoIntent, type DemoState } from './storage'

export function useFarmDemo() {
  const [initial] = useState(loadDemoState)
  const [state, setState] = useState(initial.state)
  const [storageAvailable, setStorageAvailable] = useState(initial.available)
  function commit(next: DemoState) {
    setState(next)
    setStorageAvailable(saveDemoState(next))
  }
  return {
    ...state, storageAvailable,
    toggleFavorite(id: string) {
      if (!findPlot(id)) return
      commit({ ...state, favorites: state.favorites.includes(id) ? state.favorites.filter(value => value !== id) : [...state.favorites, id] })
    },
    addIntent(values: Omit<DemoIntent, 'id' | 'createdAt'>) {
      if (!findPlot(values.plotId) || !validAlias(values.alias) || !deliveries.includes(values.delivery) || !Number.isInteger(values.quantity) || values.quantity < 1 || values.quantity > 10) return null
      const id = globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const intent = { ...values, id, createdAt: new Date().toISOString() }
      commit({ ...state, intents: [intent, ...state.intents].slice(0, 100) })
      return intent
    },
    cancelIntent(id: string) { commit({ ...state, intents: state.intents.filter(intent => intent.id !== id) }) },
    clearDemo() { commit(emptyDemoState()) },
  }
}
export type FarmDemo = ReturnType<typeof useFarmDemo>
