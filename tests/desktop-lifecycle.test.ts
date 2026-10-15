import { IDBFactory } from 'fake-indexeddb'
import { Blob as NodeBlob } from 'node:buffer'
import { strToU8, zipSync } from 'fflate/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SkinApplier } from '../src/client/applier.ts'
import { createController } from '../src/client/controller.ts'
import { createSkinStudioStore } from '../src/client/store.ts'
import { createBlankSkin } from '../src/presets.ts'
import { describeAsset } from '../src/package-format.ts'
import { ACTIVE_SNAPSHOT_KEY, SkinRepository } from '../src/storage.ts'
import { matchesComponentTarget, textExclusionReason } from '../src/client/text-targets.ts'
import { findVisualSlotTargets } from '../src/client/semantic-slots.ts'
import type { ThemeTokenModes } from '../src/model.ts'

const disposers: Array<() => void> = []

function context() {
  return {
    theme: {
      getTheme: () => ({ active: { colorScheme: 'light' as const } }),
      exportInspectTokens: () => [],
      overrideTokens: vi.fn((_source: string, _tokens: Record<string, ThemeTokenModes>) => vi.fn()),
    },
    locale: { getLocale: () => ({ active: 'en' }), register: vi.fn(() => vi.fn()) },
    on: vi.fn(() => vi.fn()),
  }
}

function shell(): HTMLElement {
  const root = document.createElement('div')
  root.id = 'root'
  root.innerHTML = `
    <aside class="_2H3hWW_root"><button aria-label="New session">
      <span><span><svg viewBox="0 0 16 16"></svg><span class="_2H3hWW_newSessionLabel">New Session</span></span></span>
    </button></aside>
    <main><div><span><svg width="34" viewBox="0 0 23.16 17.04"></svg></span>
      <span><span data-title>Into the Unknown</span><span class="Hqq-bq_previewBadge">Preview</span></span>
    </div><div contenteditable="true" data-placeholder="Describe what you want to build, / commands, @ files or sessions"><p>Keep my draft</p></div>
      <div data-composer-placeholder>Describe what you want to build, / commands, @ files or sessions</div>
      <button class="wq12jW_trigger">Model</button><button class="_2WTFBq_trigger">Access</button>
      <div class="unrelated_root">Other component</div>
    </main>`
  document.body.append(root)
  return root
}

function applier(ctx = context()): SkinApplier {
  const instance = new SkinApplier(ctx as never)
  disposers.push(() => instance.dispose())
  return instance
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('BroadcastChannel', undefined)
  localStorage.clear()
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:desktop-${Math.random()}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  document.body.replaceChildren()
  document.body.style.isolation = ''
  Reflect.deleteProperty(document, 'fonts')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('desktop runtime lifecycle', () => {
  it('maps upstream component seats to the desktop without affecting unrelated roots or triggers', () => {
    const root = shell()
    const target = { tagName: 'div', role: null, classNames: ['hHd-Xa_root'] }
    expect(matchesComponentTarget(root.querySelector('aside')!, { ...target, tagName: 'aside' })).toBe(true)
    expect(matchesComponentTarget(root.querySelector('.unrelated_root')!, target)).toBe(false)
    const model = { tagName: 'button', role: null, classNames: ['_7KE1Ra_trigger'] }
    expect(matchesComponentTarget(root.querySelector('.wq12jW_trigger')!, model)).toBe(true)
    expect(matchesComponentTarget(root.querySelector('._2WTFBq_trigger')!, model)).toBe(false)
  })

  it('recognizes desktop folder artwork and still protects a real workspace name', () => {
    const root = shell()
    const workspace = document.createElement('button')
    workspace.setAttribute('aria-haspopup', 'menu')
    workspace.setAttribute('aria-label', 'My project')
    workspace.innerHTML = '<svg viewBox="0 0 16 16"><path d="M1.50439 3.11059"></path></svg><span>My project</span>'
    root.append(workspace)
    expect(findVisualSlotTargets('workspace-folder-icon')).toContain(workspace.querySelector('svg'))
    expect(textExclusionReason(workspace.querySelector('span')!)).toBe('project-name')
  })

  it('preserves nested sidebar icons and editor draft while applying and retracting fixed copy', async () => {
    const root = shell()
    const skin = createBlankSkin('Copy')
    skin.copyOverrides['welcome.title'] = { en: 'My studio' }
    skin.copyOverrides['sidebar.new-session'] = { en: 'New scene' }
    skin.copyOverrides['composer.welcome-placeholder'] = { en: 'What shall we create?' }
    const instance = applier()
    const icon = root.querySelector('aside svg')
    const editor = root.querySelector<HTMLElement>('[contenteditable]')!
    const draft = editor.innerHTML
    await instance.apply(skin)
    expect(root.querySelector('[data-title]')).toHaveTextContent('My studio')
    expect(root.querySelector('._2H3hWW_newSessionLabel')).toHaveTextContent('New scene')
    expect(root.querySelector('aside svg')).toBe(icon)
    expect(editor.getAttribute('data-placeholder')).toBe('What shall we create?')
    expect(root.querySelector('[data-composer-placeholder]')).toHaveTextContent('What shall we create?')
    expect(editor.innerHTML).toBe(draft)
    await instance.apply(null)
    expect(root.querySelector('[data-title]')).toHaveTextContent('Into the Unknown')
    expect(root.querySelector('._2H3hWW_newSessionLabel')).toHaveTextContent('New Session')
    expect(editor.getAttribute('data-placeholder')).toBe('Describe what you want to build, / commands, @ files or sessions')
    expect(editor.innerHTML).toBe(draft)
  })

  it('switches A to B to default and restores all videos, objects and theme layers', async () => {
    shell()
    const ctx = context()
    const instance = applier(ctx)
    const makeSkin = (name: string) => {
      const skin = createBlankSkin(name)
      skin.assets = [{ id: 'motion', path: 'assets/motion.mp4', kind: 'wallpaper', mimeType: 'video/mp4', size: 16, sha256: '0'.repeat(64) }]
      skin.appearance.wallpaperAssetId = 'motion'
      return skin
    }
    const assets = new Map([['motion', new Blob(['video'], { type: 'video/mp4' })]])
    await instance.apply(makeSkin('A'), assets)
    const firstVideo = document.querySelector('video')!
    await instance.apply(makeSkin('B'), assets)
    expect(firstVideo.hasAttribute('src')).toBe(false)
    expect(document.querySelectorAll('[data-dsh-skin-studio-backdrop]')).toHaveLength(1)
    await instance.apply(null)
    expect(document.querySelector('video')).toBeNull()
    expect(document.body.style.isolation).toBe('')
    expect(document.getElementById('root')?.style.zIndex).toBe('')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(ctx.theme.overrideTokens.mock.calls[0]?.[0]).toBe('@local/dsh-desktop-skin-studio')
    for (const call of ctx.theme.overrideTokens.mock.results) expect(call.value).toHaveBeenCalledOnce()
  })

  it('does not resurrect a skin or font after default or disposal wins a pending load', async () => {
    const pending = deferred<FontFace>()
    const fontSet = { add: vi.fn(), delete: vi.fn(), ready: Promise.resolve() }
    Object.defineProperty(document, 'fonts', { configurable: true, value: fontSet })
    class DeferredFont {
      constructor(readonly family: string) {}
      load() { return pending.promise }
    }
    vi.stubGlobal('FontFace', DeferredFont)
    const ctx = context()
    const instance = applier(ctx)
    const skin = createBlankSkin('Pending font')
    skin.assets = [{ id: 'font', path: 'assets/font.woff2', kind: 'ui-font', mimeType: 'font/woff2', size: 8, sha256: '0'.repeat(64) }]
    skin.appearance.uiFont = { kind: 'asset', assetId: 'font', family: 'Custom' }
    const loading = instance.apply(skin, new Map([['font', new Blob(['font'])]]))
    await instance.apply(null)
    instance.dispose()
    pending.resolve({ family: 'Late font' } as FontFace)
    await loading
    expect(fontSet.add).not.toHaveBeenCalled()
    expect(ctx.theme.overrideTokens).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    await instance.apply(createBlankSkin('After disposal'))
    expect(ctx.theme.overrideTokens).not.toHaveBeenCalled()
  })

  it('recreates a removed visual replacement and remains stable after its own mutations', async () => {
    const root = shell()
    const skin = createBlankSkin('Logo')
    skin.assets = [{ id: 'logo', path: 'assets/logo.png', kind: 'visual-asset', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.visualAssetOverrides['hero-whale-logo'] = 'logo'
    const instance = applier()
    const frames = vi.spyOn(window, 'requestAnimationFrame')
    await instance.apply(skin, new Map([['logo', new Blob(['image'])]]))
    const replacement = root.querySelector('[data-dsh-skin-studio-visual-slot]')!
    replacement.remove()
    await vi.waitFor(() => { expect(root.querySelector('[data-dsh-skin-studio-visual-slot]')).not.toBeNull() })
    const stableFrames = frames.mock.calls.length
    await new Promise(resolve => { window.setTimeout(resolve, 80) })
    expect(frames.mock.calls.length).toBeLessThanOrEqual(stableFrames + 1)
    await instance.apply(null)
    expect(root.querySelector('[data-dsh-skin-studio-visual-slot]')).toBeNull()
    expect(root.querySelector<SVGElement>('svg[width="34"]')?.style.display).toBe('')
  })
})

describe('desktop controller lifecycle', () => {
  it('publishes all 17 skins without a separate actions connection and restores selection', async () => {
    const store = createSkinStudioStore()
    const runtime = createController(context() as never, store)
    disposers.push(runtime.dispose)
    await runtime.ready
    expect(store.getSnapshot()).toMatchObject({ ready: true, persistent: true })
    expect(store.getSnapshot().skins).toHaveLength(17)
    const id = store.getSnapshot().skins[0]!.id
    await runtime.controller.activate(id)
    expect(JSON.parse(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)!)).toMatchObject({ id })
    await runtime.controller.activate(null)
    expect(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)).toBeNull()
  })

  it('keeps bundled skins usable and exposes initialization failure when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('Storage unavailable') } })
    const store = createSkinStudioStore()
    const runtime = createController(context() as never, store)
    disposers.push(runtime.dispose)
    await runtime.ready
    expect(store.getSnapshot()).toMatchObject({ ready: true, persistent: false })
    expect(store.getSnapshot().skins).toHaveLength(17)
    expect(runtime.controller.initializationError?.()).toContain('Storage unavailable')
  })

  it('retains existing media when saving metadata and updates a replaced active package', async () => {
    vi.stubGlobal('Blob', NodeBlob)
    const store = createSkinStudioStore()
    const runtime = createController(context() as never, store)
    disposers.push(runtime.dispose)
    await runtime.ready
    const skin = createBlankSkin('Original')
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const blob = new NodeBlob([bytes], { type: 'image/png' }) as unknown as Blob
    skin.assets = [await describeAsset('image', 'wallpaper', blob)]
    skin.appearance.wallpaperAssetId = 'image'
    await runtime.controller.saveAndActivate(skin, new Map([['image', blob]]))
    skin.name = 'Edited metadata'
    await runtime.controller.saveAndActivate(skin, new Map())
    expect((await runtime.controller.assets(skin.id)).get('image')).toBeDefined()
    skin.name = 'Replacement'
    const packageFile = new NodeBlob([zipSync({
      'manifest.json': strToU8(JSON.stringify(skin), true),
      'assets/image.png': strToU8(String.fromCharCode(...bytes), true),
    })]) as unknown as Blob
    await runtime.controller.importPackage(packageFile, 'replace')
    expect(JSON.parse(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)!)).toMatchObject({ id: skin.id, name: 'Replacement' })
    expect(store.getSnapshot().skins.find(item => item.id === skin.id)?.name).toBe('Replacement')
  })

  it('does not publish after disposal while initialization is pending', async () => {
    const pending = deferred<void>()
    const seed = vi.spyOn(SkinRepository.prototype, 'seed').mockImplementation(() => pending.promise)
    const store = createSkinStudioStore()
    const runtime = createController(context() as never, store)
    disposers.push(runtime.dispose)
    await vi.waitFor(() => { expect(seed).toHaveBeenCalled() })
    runtime.dispose()
    const revision = store.getSnapshot().revision
    pending.resolve()
    await runtime.ready
    expect(store.getSnapshot().revision).toBe(revision)
    expect(store.getSnapshot().ready).toBe(false)
  })

  it('activates a saved skin even when a transient preview races deferred storage', async () => {
    const store = createSkinStudioStore()
    const runtime = createController(context() as never, store)
    disposers.push(runtime.dispose)
    await runtime.ready
    const original = store.getSnapshot().skins[0]!
    await runtime.controller.activate(original.id)
    const skin = createBlankSkin('Saved selection')
    const entered = deferred<void>()
    const released = deferred<void>()
    const originalSave = SkinRepository.prototype.save
    vi.spyOn(SkinRepository.prototype, 'save').mockImplementation(async function (this: SkinRepository, saving, assets) {
      entered.resolve()
      await released.promise
      await originalSave.call(this, saving, assets)
    })
    const saving = runtime.controller.saveAndActivate(skin, new Map())
    await entered.promise
    await runtime.controller.preview(createBlankSkin('Transient preview'), new Map())
    await runtime.controller.cancelPreview()
    released.resolve()
    await saving
    expect(store.getSnapshot().activeId).toBe(skin.id)
    expect(JSON.parse(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)!)).toMatchObject({ id: skin.id, name: 'Saved selection' })
  })

  it('preserves a later explicit activation when an earlier save finishes afterwards', async () => {
    const store = createSkinStudioStore()
    const runtime = createController(context() as never, store)
    disposers.push(runtime.dispose)
    await runtime.ready
    const later = store.getSnapshot().skins[0]!
    const skin = createBlankSkin('Earlier save')
    const entered = deferred<void>()
    const released = deferred<void>()
    const originalSave = SkinRepository.prototype.save
    vi.spyOn(SkinRepository.prototype, 'save').mockImplementation(async function (this: SkinRepository, saving, assets) {
      entered.resolve()
      await released.promise
      await originalSave.call(this, saving, assets)
    })
    const saving = runtime.controller.saveAndActivate(skin, new Map())
    await entered.promise
    await runtime.controller.activate(later.id)
    released.resolve()
    await saving
    expect(store.getSnapshot().skins.some(item => item.id === skin.id)).toBe(true)
    expect(store.getSnapshot().activeId).toBe(later.id)
    expect(JSON.parse(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)!)).toMatchObject({ id: later.id })
  })
})
