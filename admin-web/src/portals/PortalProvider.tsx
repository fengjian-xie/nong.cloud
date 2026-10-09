import { createContext, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFarm } from '../farm/FarmProvider'
import type { Action, FarmState } from '../farm/model'
import { now, transition, uid } from '../farm/model'
import { getRole } from './config'
import type { RoleId } from './config'
import { createPortalSeed, reducePortal, scopedBatches, scopedPlots } from './model'
import type { PortalAction, PortalCommand, PortalState } from './model'

type FarmCommand = Action extends infer A ? A extends Action ? Omit<A, 'at' | 'eventId'> : never : never
const KEY = 'xiangqiao-role-demo-journal-v1'
type Value = { state: PortalState; accountId: string; notice: string; warning: string; commit: (role: RoleId, command: PortalCommand) => boolean; farmCommit: (role: RoleId, command: FarmCommand) => boolean }
const Context = createContext<Value | null>(null)
function restore(farm: FarmState, storageKey: string) {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(raw) || raw.length > 1000 || raw.some(a => !a || !getRole(a.role) || typeof a.type !== 'string' || typeof a.at !== 'string' || typeof a.eventId !== 'string')) throw new Error('Invalid journal')
    const actions = raw as PortalAction[]
    // Accepted historical events remain history even when a card is later lost or inventory changes.
    return { state: actions.reduce((s, a) => reducePortal(s, a, farm, true), createPortalSeed()), actions, warning: '' }
  } catch { return { state: createPortalSeed(), actions: [] as PortalAction[], warning: '角色演示缓存不可用，已恢复示例；原缓存未删除。' } }
}
export function PortalProvider({ children, accountId }: { children: ReactNode; accountId?: string }) {
  const farm = useFarm()
  const storageKey = accountId ? `xiangqiao:work-demo:portal:${accountId}` : KEY
  const [initial] = useState(() => restore(farm.state, storageKey))
  const [state, setState] = useState(initial.state)
  const current = useRef(initial.state)
  const journal = useRef(initial.actions)
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState(initial.warning)
  function fail(error: unknown) { setNotice(error instanceof Error ? error.message : '操作失败'); return false }
  function commit(role: RoleId, command: PortalCommand) {
    try {
      if (journal.current.length >= 1000) throw new Error('本地演示日志已满，请在正式环境接入业务数据库')
      const action = { ...command, role, accountId: accountId || 'admin-demo', eventId: uid('ROLE'), at: now() } as PortalAction
      const next = reducePortal(current.current, action, farm.state)
      current.current = next; journal.current = [...journal.current, action]; setState(next)
      try { localStorage.setItem(storageKey, JSON.stringify(journal.current)); setWarning('') }
      catch { setWarning('浏览器无法存储，本次变更仅在当前会话有效。') }
      setNotice('操作已保存到本机演示数据；未产生真实交易、付款或对外发布。')
      return true
    } catch (error) { return fail(error) }
  }
  function farmCommit(role: RoleId, command: FarmCommand) {
    try {
      const plotIds = scopedPlots(farm.state, current.current, role).map(p => p.id)
      const permitted = ['farmer', 'cooperative', 'family'].includes(role)
      if (['configure', 'sync', 'cardStatus'].includes(command.type) && 'id' in command) {
        const card = farm.state.cards.find(c => c.id === command.id)
        const owners = scopedPlots(farm.state, current.current, role).map(p => p.owner)
        if (!permitted || !card || !owners.includes(card.farmer) || (role === 'family' && (!current.current.family.view || !current.current.family.configure || command.type === 'cardStatus'))) throw new Error('无权管理该农事卡，请先获得相应代办授权；子女不能代办挂失或恢复')
      } else if (command.type === 'cropChange' || command.type === 'forecast') {
        const plotId = command.type === 'cropChange' ? command.change.plotId : command.plotId
        if (!['farmer', 'cooperative'].includes(role) || !plotIds.includes(plotId)) throw new Error('无权修改该地块')
      } else if (command.type === 'reserve') {
        if (role !== 'buyer' || command.order.buyer !== getRole(role)?.actor || !scopedBatches(farm.state, role).some(b => b.id === command.order.batchId)) throw new Error('只能以本采购主体预订公开共享库存')
        const processed = current.current.processing.filter(e => e.batchId === command.order.batchId).reduce((s, e) => s + e.input, 0)
        const batch = farm.state.batches.find(b => b.id === command.order.batchId)!
        if (command.order.quantity > batch.quantity - batch.reserved - batch.sold - processed) throw new Error('部分数量已有分拣作业，不可重复预订')
      } else if (command.type === 'orderStatus') {
        const order = farm.state.orders.find(o => o.id === command.id)
        const batch = farm.state.batches.find(b => b.id === order?.batchId)
        const cancel = role === 'buyer' && order?.buyer === getRole(role)?.actor && command.status === '已取消'
        const release = role === 'warehouse' && batch?.storage === getRole(role)?.actor && command.status === '已出库'
        if (!cancel && !release) throw new Error('无权处理该库存订单；货主授权交接需在正式端核验')
      } else throw new Error('该角色不能执行运营端操作')
      transition(farm.state, { ...command, at: now(), eventId: 'VALIDATE' } as Action)
      const result = farm.commit(command)
      if (result) setNotice('已更新共享演示数据。配置需设备同步回执才生效；未连接真实设备。')
      else setNotice('操作未保存，请检查业务条件。')
      return result
    } catch (error) { return fail(error) }
  }
  return <Context.Provider value={{ state, accountId: accountId || 'admin-demo', notice, warning: warning || farm.storageWarning, commit, farmCommit }}>{children}</Context.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePortal() { const value = useContext(Context); if (!value) throw new Error('PortalProvider required'); return value }
