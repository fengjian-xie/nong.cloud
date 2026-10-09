// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChoiceMenu } from './ChoiceMenu'

afterEach(cleanup)
const options = [{ value: 'farmer', label: '种植户' }, { value: 'team', label: '农服队' }]
describe('自定义身份单选浮层', () => {
  it('只呈现提供的身份，单选关闭并恢复触发器焦点', () => {
    const change = vi.fn()
    render(<ChoiceMenu label="工作身份" value="farmer" options={options} onChange={change}/>)
    const trigger = screen.getByRole('combobox')
    expect(trigger.textContent).toBe('种植户')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: '种植户' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('option', { name: '农服队' }))
    expect(change).toHaveBeenCalledExactlyOnceWith('team')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('键盘选择、Escape取消、Tab和点击外部关闭，不误切身份', () => {
    const change = vi.fn()
    render(<ChoiceMenu label="工作身份" value="farmer" options={options} onChange={change}/>)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'End' })
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: '农服队' }).id)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(change).not.toHaveBeenCalled()
    fireEvent.keyDown(trigger, { key: ' ' })
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(change).toHaveBeenCalledExactlyOnceWith('team')
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
