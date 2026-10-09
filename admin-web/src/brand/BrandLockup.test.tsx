// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import mark from '../../public/brand/xiangqiao-vi-mark.svg?raw'
import favicon from '../../public/brand/favicon.svg?raw'
import lockup from '../../public/brand/xiangqiao-vi-lockup.svg?raw'
import reverseLockup from '../../public/brand/xiangqiao-vi-lockup-reverse.svg?raw'
import { BrandLockup, BrandMark } from './BrandLockup'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('乡桥农业 VI V1.0', () => {
  it('品牌组合不被产品名称替换', () => {
    render(<BrandLockup context="用户工作台" domain="work.nong.cloud"/>)
    expect(screen.getByRole('img').getAttribute('alt')).toBe('乡桥农业 · 连接乡土，共享丰收')
    expect(screen.getByText('用户工作台')).toBeTruthy()
    expect(screen.getByText('work.nong.cloud')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('src')).toContain('/brand/xiangqiao-vi-lockup.svg')
  })
  it('独立站和子目录部署都使用正确的资产基路径', () => {
    vi.stubEnv('BASE_URL', '/brand-site/')
    render(<BrandLockup reverse context="乡桥农事中心"/>)
    expect(screen.getByRole('img').getAttribute('src')).toBe('/brand-site/brand/xiangqiao-vi-lockup-reverse.svg')
  })
  it('三笔乡严格使用手册中的路径、圆角和三种颜色', () => {
    const { container } = render(<BrandMark/>)
    const paths = [...container.querySelectorAll('path')]
    expect(paths.map(p => p.getAttribute('d'))).toEqual(['M 90 25 L 42 80 L 118 44', 'M 120 47 L 52 112 L 150 70', 'M 150 69 L 62 144 L 178 96'])
    expect(paths.map(p => p.getAttribute('stroke'))).toEqual(['#0F3D2E', '#3E9B5F', '#E8B54A'])
    paths.forEach(p => { expect(p.getAttribute('stroke-width')).toBe('14'); expect(p.getAttribute('stroke-linecap')).toBe('round'); expect(p.getAttribute('stroke-linejoin')).toBe('round') })
  })
  it('反白版本保留金色第三笔', () => {
    const { container } = render(<BrandMark reverse/>)
    expect([...container.querySelectorAll('path')].map(p => p.getAttribute('stroke'))).toEqual(['#F4F2EA', '#F4F2EA', '#E8B54A'])
    expect(reverseLockup).toContain('stroke="#E8B54A"')
    expect(reverseLockup).not.toContain('stroke="#3E9B5F"')
  })
  it('网站图标和下载标志不再使用旧桥芽提案', () => {
    expect(favicon.trim()).toBe(mark.trim())
    expect(lockup).toContain('乡桥农业')
    expect(lockup).toContain('连接乡土，共享丰收')
    expect(lockup).not.toContain('乡桥农事中心')
    expect(lockup).not.toMatch(/<script|<foreignObject|linearGradient|radialGradient/)
  })
  it('正色与反白下载素材同步新Slogan，不保留旧口号', () => {
    for (const asset of [lockup, reverseLockup]) {
      expect(asset).toContain('连接乡土，共享丰收')
      expect(asset).not.toContain('持续创新，让农业更简单')
    }
  })
})
