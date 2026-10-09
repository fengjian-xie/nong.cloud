// @vitest-environment jsdom
// Test-only Node I/O; the production TypeScript build has no Node runtime dependency.
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const source = readFileSync('../miniapp/preview/choice-menu.js', 'utf8')
let choice
const change = vi.fn()
beforeEach(() => {
  document.body.innerHTML = '<div id="choice" class="xq-choice"><button role="combobox" aria-label="角色页面预览" aria-controls="choices"></button><div id="choices" role="listbox" aria-label="角色页面预览" hidden></div></div>'
  new Function('window', source)(window)
  choice = window.XqChoiceMenu(document.getElementById('choice'))
  choice.update([{ value: 'one|farmer', label: '种植户 · 示例账号' }, { value: 'one|team', label: '农服队 · 示例账号' }], 'one|farmer', change)
})
afterEach(() => { choice.destroy(); document.body.replaceChildren(); change.mockClear() })
describe('小程序浏览器预览单选浮层', () => {
  it('点击切换只传递一次选择，更新后同步标签和选中项', () => {
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.click(screen.getByRole('option', { name: '农服队 · 示例账号' }))
    expect(change).toHaveBeenCalledExactlyOnceWith('one|team')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    choice.update([{ value: 'one|team', label: '农服队 · 示例账号' }], 'one|team', change)
    expect(trigger.textContent).toBe('农服队 · 示例账号')
    fireEvent.click(trigger)
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true')
  })
  it('Escape与点击外部关闭；方向键、Home/End选择保留单选', () => {
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'End' })
    expect(trigger.getAttribute('aria-activedescendant')).toBe('choices-1')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(change).not.toHaveBeenCalled()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    fireEvent.keyDown(trigger, { key: 'Home' })
    fireEvent.keyDown(trigger, { key: 'End' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(change).toHaveBeenCalledExactlyOnceWith('one|team')
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
