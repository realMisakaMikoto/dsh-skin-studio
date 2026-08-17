import { afterEach, describe, expect, it } from 'vitest'
import {
  findCopySlotTargets, findVisualSlotTargets, inspectSemanticSlotAvailability,
} from '../src/client/semantic-slots.ts'

afterEach(() => { document.getElementById('root')?.remove() })

function buildDshShell(): HTMLElement {
  const root = document.createElement('div')
  root.id = 'root'
  root.innerHTML = `
    <aside>
      <button aria-label="新建会话"><svg viewBox="0 0 182 24"></svg></button>
      <button aria-label="新建会话"><svg viewBox="0 0 16 16"></svg><span>新会话</span></button>
      <div role="treeitem" aria-expanded="false"><span><svg viewBox="0 0 16 16"><path transform="translate(1.5 2.429)" d="M5.05582 0.518756"></path></svg></span><span>temp</span></div>
    </aside>
    <main>
      <div><span><svg width="34" viewBox="0 0 23.16 17.04"></svg></span><span>探索未至之境</span><span>预览版</span></div>
      <svg viewBox="0 0 1051 468"></svg>
      <button aria-haspopup="menu" aria-label="选择工作区"><svg viewBox="0 0 16 16"><path d="M5.19629 1.57104"></path></svg><span>选择工作区</span></button>
      <textarea placeholder="描述你想要构建的内容"></textarea>
    </main>
    <div role="dialog" aria-labelledby="settings-heading"><h2 id="settings-heading">设置</h2></div>
  `
  document.body.append(root)
  return root
}

describe('semantic DSH slot compatibility layer', () => {
  it('locates stable visual slots without exposing selectors to a skin', () => {
    buildDshShell()
    expect(findVisualSlotTargets('hero-whale-logo')).toHaveLength(1)
    expect(findVisualSlotTargets('hero-backdrop-illustration')).toHaveLength(1)
    expect(findVisualSlotTargets('sidebar-brand-wordmark')).toHaveLength(1)
    expect(findVisualSlotTargets('workspace-folder-icon')).toHaveLength(2)
  })

  it('locates semantic copy properties and reports unavailable slots safely', () => {
    buildDshShell()
    expect(findCopySlotTargets('welcome.title')).toMatchObject([{ property: 'text' }])
    expect(findCopySlotTargets('composer.welcome-placeholder')).toMatchObject([{ property: 'placeholder' }])
    expect(findCopySlotTargets('sidebar.new-session').map(target => target.property)).toEqual(['text', 'aria-label'])
    expect(inspectSemanticSlotAvailability().visual['hero-whale-logo']).toBe(true)
    document.getElementById('root')!.replaceChildren()
    expect(inspectSemanticSlotAvailability().visual['hero-whale-logo']).toBe(false)
  })
})
