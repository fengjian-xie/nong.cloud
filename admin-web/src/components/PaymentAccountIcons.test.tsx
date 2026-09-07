// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PaymentAccountIcons } from './PaymentAccountIcons'

afterEach(cleanup)
it('仅保留微信支付账户，可查看、绑定并关闭', () => {
  const onBind = vi.fn()
  render(<PaymentAccountIcons payments={{ wechatBinding: '未绑定' }} onBind={onBind} />)
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: '支付宝账户' })).toBeNull()
  expect(screen.queryByRole('button', { name: '银行卡账户' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '微信支付账户' }))
  fireEvent.click(screen.getByRole('button', { name: '立即绑定' }))
  expect(onBind).toHaveBeenCalledWith('wechatBinding', '微信支付')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('group', { name: '微信支付绑定信息' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '微信支付账户' }))
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('group', { name: '微信支付绑定信息' })).toBeNull()
})
