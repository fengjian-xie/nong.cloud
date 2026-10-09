// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MerchantSharingPanel } from './MerchantSharingPanel'
afterEach(cleanup)
it('财务后台仅本地测算，未扣渠道费明确提示，改输入清除过时结果', () => {
  render(<MerchantSharingPanel/>)
  fireEvent.change(screen.getByLabelText('支付管理模块'), {target:{value:'分账测算'}})
  fireEvent.change(screen.getByLabelText('示例订单实收 / 元'),{target:{value:'100.01'}})
  fireEvent.change(screen.getByLabelText('合同约定服务费示例 / 元'),{target:{value:'10'}})
  fireEvent.change(screen.getByLabelText('中心批准上限示例 / %'),{target:{value:'10'}})
  fireEvent.click(screen.getByRole('button',{name:'计算本地示例'}))
  expect(screen.getByRole('status').textContent).toContain('90.01')
  expect(screen.getByRole('status').textContent).toContain('非可执行额度')
  fireEvent.change(screen.getByLabelText('合同约定服务费示例 / 元'),{target:{value:'20'}})
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'计算本地示例'}))
  expect(screen.getByRole('alert').textContent).toContain('批准上限')
  expect(screen.queryByRole('button',{name:/发起支付|执行分账|转账/})).toBeNull()
})
