import { afterEach, describe, expect, it } from 'vitest'
import { createComponentTarget, describeComponentTarget, findPickableComponent } from '../src/client/component-picker.ts'

afterEach(() => { document.getElementById('root')?.remove() })

describe('component picker', () => {
  it('selects the interactive component instead of a decorative child', () => {
    const root = document.createElement('div')
    root.id = 'root'
    const button = document.createElement('button')
    button.className = 'hHd-Xa_iconButton hHd-Xa_active'
    const icon = document.createElement('span')
    icon.className = 'icon'
    button.append(icon); root.append(button); document.body.append(root)
    const picked = findPickableComponent(icon, root)
    expect(picked).toBe(button)
    const target = createComponentTarget(picked!)
    expect(target).toEqual({ tagName: 'button', role: null, classNames: ['hHd-Xa_iconButton'] })
    expect(describeComponentTarget(target)).toBe('icon Button')
  })

  it('walks from a non-container input to its component wrapper', () => {
    const root = document.createElement('div')
    root.id = 'root'
    const wrapper = document.createElement('div')
    wrapper.className = 'abc_composer'
    const input = document.createElement('textarea')
    wrapper.append(input); root.append(wrapper); document.body.append(root)
    expect(findPickableComponent(input, root)).toBe(wrapper)
  })

  it('prefers the complete control boundary over an inner scrolling layer', () => {
    const root = document.createElement('div')
    root.id = 'root'
    const card = document.createElement('div')
    card.className = 'abc_card'
    const scroll = document.createElement('div')
    scroll.className = 'abc_scroll'
    const input = document.createElement('textarea')
    input.getBoundingClientRect = () => ({ width: 400, height: 52 } as DOMRect)
    scroll.getBoundingClientRect = () => ({ width: 400, height: 52 } as DOMRect)
    card.getBoundingClientRect = () => ({ width: 400, height: 118 } as DOMRect)
    scroll.append(input); card.append(scroll); root.append(card); document.body.append(root)
    expect(findPickableComponent(input, root)).toBe(card)
  })
})
