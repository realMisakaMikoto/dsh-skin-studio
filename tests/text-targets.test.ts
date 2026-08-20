import { afterEach, describe, expect, it } from 'vitest'
import {
  createTextPickCandidate, findTextOverrideTargets, listTextPickCandidates, textExclusionReason,
} from '../src/client/text-targets.ts'

afterEach(() => { document.getElementById('root')?.remove() })

function rootWith(html: string): HTMLElement {
  const root = document.createElement('div')
  root.id = 'root'
  root.innerHTML = html
  document.body.append(root)
  return root
}

describe('free-text structural targets', () => {
  it('targets a direct Text node without selecting sibling icons or controls', () => {
    const root = rootWith('<div class="abc_action" role="button" aria-label="Save"><svg></svg>Save<span><button>More</button></span></div>')
    const button = root.querySelector<HTMLElement>('.abc_action')!
    const candidate = createTextPickCandidate(button, root)!
    expect(candidate.property).toBe('text')
    expect(candidate.sample).toBe('Save')
    expect(candidate.target).toMatchObject({ property: 'text', textNodeIndex: 1 })
    expect(candidate.target).not.toHaveProperty('selector')
    const resolved = findTextOverrideTargets(candidate.target, root)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.textNode?.data).toBe('Save')
    expect(createTextPickCandidate(button.querySelector('svg'), root)?.sample).toBe('Save')
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.querySelector('button')).not.toBeNull()
  })

  it('targets placeholders and every matching structural instance', () => {
    const root = rootWith('<div class="abc_composer"><input placeholder="Ask anything"></div><div class="abc_composer"><input placeholder="Ask anything"></div>')
    const first = root.querySelector<HTMLInputElement>('input')!
    const candidate = createTextPickCandidate(first, root)!
    expect(candidate.property).toBe('placeholder')
    expect(findTextOverrideTargets(candidate.target, root).map(target => target.element)).toEqual([...root.querySelectorAll('input')])
  })

  it('enumerates separate direct text nodes and skips contenteditable values', () => {
    const root = rootWith('<button class="abc_split">First<span></span>Second</button><div contenteditable="true">User draft</div>')
    const candidates = listTextPickCandidates(root)
    expect(candidates.map(candidate => candidate.sample)).toEqual(['First', 'Second'])
    expect(createTextPickCandidate(root.querySelector('[contenteditable]'), root)).toBeUndefined()
  })

  it('reports the required exclusion reasons', () => {
    const root = rootWith(`
      <button aria-label="Settings">Settings</button>
      <div role="dialog" aria-label="Settings"><button>Dialog action</button></div>
      <div role="dialog" aria-label="Share"><button>Share action</button></div>
      <div data-chat-flow-kind="assistant"><span>Model answer</span></div>
      <div role="treeitem" aria-expanded="false"><span>Project Alpha</span></div>
      <button aria-haspopup="menu" aria-label="Project Beta"><svg viewBox="0 0 16 16"><path d="M5.19629 1.57104"></path></svg><span>Project Beta</span></button>
      <div role="treeitem" aria-selected="false"><span>Conversation Alpha</span></div>
      <header><nav><span>Conversation breadcrumb</span></nav></header>
      <button class="abc_safe">Safe action</button>
    `)
    const elements = [...root.querySelectorAll<HTMLElement>('span, button')]
    const reasonFor = (text: string) => textExclusionReason(elements.find(element => element.textContent === text)!)
    expect(reasonFor('Settings')).toBe('settings')
    expect(reasonFor('Dialog action')).toBe('settings')
    expect(reasonFor('Share action')).toBeNull()
    expect(reasonFor('Model answer')).toBe('chat-content')
    expect(reasonFor('Project Alpha')).toBe('project-name')
    expect(reasonFor('Project Beta')).toBe('project-name')
    expect(reasonFor('Conversation Alpha')).toBe('session-name')
    expect(reasonFor('Conversation breadcrumb')).toBe('session-name')
    expect(reasonFor('Safe action')).toBeNull()
  })
})
