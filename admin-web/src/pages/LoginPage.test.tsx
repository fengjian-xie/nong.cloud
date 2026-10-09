// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }))
afterEach(cleanup)

it('管理原型登录明确区分演示范围与生产认证', () => {
  render(<LoginPage />)
  expect(screen.getByRole('heading', { name: '运营账号演示登录' })).toBeTruthy()
  expect(screen.getByText('演示县域范围')).toBeTruthy()
  expect(screen.queryByText('可信租户隔离')).toBeNull()
  expect(screen.getByText(/真实认证与对象权限待后端接入/)).toBeTruthy()
})
