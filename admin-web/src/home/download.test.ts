// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadText } from './download'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
describe('UTF-8文本下载', () => {
  it('使用UTF-8与BOM，移除临时链接并延迟撤销URL兼容Safari', () => {
    vi.useFakeTimers()
    const created = vi.fn(() => 'blob:local-checklist')
    const revoked = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: created })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoked })
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadText('乡桥清单.txt', '测试内容')
    expect(created.mock.calls).toHaveLength(1)
    const blob = (created.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('text/plain;charset=utf-8')
    expect(blob.size).toBe(new TextEncoder().encode('\uFEFF测试内容').length)
    expect(clicked).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoked).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoked).toHaveBeenCalledWith('blob:local-checklist')
  })
})
