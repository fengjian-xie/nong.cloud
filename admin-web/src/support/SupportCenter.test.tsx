// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SupportCenter } from './SupportCenter'
const owner={accountId:'farm-service',identityId:'farmer',label:'种植户（演示）'}
beforeEach(()=>localStorage.clear())
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('用户保存本地问题和回访意向，不出现坐席或支付操作',()=>{
 const view=render(<SupportCenter owner={owner}/>)
 fireEvent.change(screen.getByLabelText('问题说明（仅测试）'),{target:{value:'测试旧卡记录同步，需要协助核对'}})
 fireEvent.change(screen.getByLabelText('希望怎样回复'),{target:{value:'电话回访意向（待接入）'}})
 fireEvent.click(screen.getByRole('button',{name:'保存本地帮助登记'}))
 expect(screen.getByRole('status').textContent).toContain('未预约或拨打电话')
 expect(screen.getByRole('heading',{name:'农事卡与同步 · 待受理'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:'演示受理与分派'})).toBeNull()
 expect(screen.queryByRole('button',{name:/执行退款|执行分账/})).toBeNull()
 view.unmount();render(<SupportCenter owner={{...owner,identityId:'team'}}/>)
 expect(screen.getByText('暂无符合条件的帮助记录。')).toBeTruthy()
})
it('中心受理、分派、回复后等待用户确认，不代替用户关闭',()=>{
 render(<SupportCenter mode="admin" owner={{...owner,accountId:'admin-demo'}}/>)
 fireEvent.click(screen.getByRole('button',{name:/农事卡与同步.*种植户/}))
 fireEvent.click(screen.getByRole('button',{name:'演示受理与分派'}))
 fireEvent.change(screen.getByLabelText('处理说明（仅测试）'),{target:{value:'演示处理说明：已核对采集时配置版本'}})
 fireEvent.click(screen.getByRole('button',{name:'演示回复，待用户确认'}))
 expect(screen.getByRole('heading',{name:'农事卡与同步 · 待用户确认'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:/确认问题已解决/})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'人工帮助与回访说明'}))
 expect(screen.getByRole('status').textContent).toContain('没有发起电话')
})
it('不可用或损坏的本地储存不使帮助页面空白',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked')})
 render(<SupportCenter owner={owner}/>)
 expect(screen.getByRole('heading',{name:'遇到问题，乡桥帮你。'})).toBeTruthy()
 expect(screen.getByRole('status').textContent).toContain('储存不可用')
})
