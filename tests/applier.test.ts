import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBlankSkin } from '../src/presets.ts'
import { SkinApplier } from '../src/client/applier.ts'

describe('SkinApplier', () => {
  afterEach(() => {
    document.querySelector('[data-dsh-skin-studio-backdrop]')?.remove()
    document.getElementById('root')?.remove()
    document.body.style.isolation = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('replaces and retracts the official theme override layer', async () => {
    const releases: Array<ReturnType<typeof vi.fn>> = []
    const overrideTokens = vi.fn(() => {
      const release = vi.fn(); releases.push(release); return release
    })
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens } }
    const applier = new SkinApplier(ctx as never)
    await applier.apply(createBlankSkin('Preview'))
    await applier.apply(createBlankSkin('Next'))
    expect(overrideTokens).toHaveBeenCalledTimes(2)
    expect(releases[0]).toHaveBeenCalledOnce()
    applier.dispose()
    expect(releases[1]).toHaveBeenCalledOnce()
  })

  it('renders and cleans up a muted looping video backdrop', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:motion')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Motion')
    skin.assets = [{ id: 'motion', path: 'assets/motion.mp4', kind: 'wallpaper', mimeType: 'video/mp4', size: 16, sha256: '0'.repeat(64) }]
    skin.appearance.wallpaperAssetId = 'motion'
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['motion', new Blob(['video'], { type: 'video/mp4' })]]))
    const video = document.querySelector<HTMLVideoElement>('video[data-dsh-skin-studio-media="video"]')
    expect(video).not.toBeNull()
    expect(video).toMatchObject({ muted: true, autoplay: true, loop: true, playsInline: true })
    expect(play).toHaveBeenCalledOnce()
    expect(document.body.style.isolation).toBe('isolate')
    applier.dispose()
    expect(document.querySelector('[data-dsh-skin-studio-backdrop]')).toBeNull()
    expect(document.body.style.isolation).toBe('')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:motion')
  })

  it('covers only the responsive main content area', async () => {
    vi.stubGlobal('innerWidth', 1280)
    vi.stubGlobal('innerHeight', 900)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:image')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const box = (x: number, y: number, width: number, height: number): DOMRect => ({
      x, y, width, height, top: y, left: x, right: x + width, bottom: y + height,
      toJSON: () => ({}),
    }) as DOMRect
    const root = document.createElement('div')
    root.id = 'root'
    const shell = document.createElement('div')
    const frame = document.createElement('div')
    const sidebar = document.createElement('div')
    const main = document.createElement('div')
    root.append(shell); shell.append(frame); frame.append(sidebar, main); document.body.append(root)
    let viewportWidth = 1280
    root.getBoundingClientRect = () => box(0, 0, viewportWidth, 900)
    shell.getBoundingClientRect = () => box(0, 0, viewportWidth, 900)
    frame.getBoundingClientRect = () => box(0, 0, viewportWidth, 900)
    sidebar.getBoundingClientRect = () => box(0, 0, 280, 900)
    let mainLeft = 280
    main.getBoundingClientRect = () => box(mainLeft, 0, viewportWidth - mainLeft, 900)
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Scoped image')
    skin.assets = [{ id: 'image', path: 'assets/image.png', kind: 'wallpaper', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.appearance.wallpaperAssetId = 'image'
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['image', new Blob(['image'], { type: 'image/png' })]]))
    const layer = document.querySelector<HTMLElement>('[data-dsh-skin-studio-backdrop]')
    const image = document.querySelector<HTMLImageElement>('img[data-dsh-skin-studio-media="image"]')
    expect(layer?.dataset.dshSkinStudioScope).toBe('main')
    expect(layer?.style.left).toBe('280px')
    expect(layer?.style.right).toBe('0px')
    expect(layer?.style.zIndex).toBe('0')
    expect(image?.style.width).toBe('100%')
    expect(image?.style.height).toBe('100%')
    expect(image?.style.objectFit).toBe('cover')
    expect(root.style.position).toBe('relative')
    expect(root.style.zIndex).toBe('1')
    mainLeft = 64
    window.dispatchEvent(new Event('resize'))
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(layer?.style.left).toBe('64px')
    viewportWidth = 390
    mainLeft = 280
    vi.stubGlobal('innerWidth', viewportWidth)
    window.dispatchEvent(new Event('resize'))
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(layer?.style.left).toBe('280px')
    applier.dispose()
    expect(root.style.position).toBe('')
    expect(root.style.zIndex).toBe('')
  })

  it('applies component media to every matching component and restores their styles', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:component')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const root = document.createElement('div')
    root.id = 'root'
    const first = document.createElement('button')
    first.className = 'abc_composer'
    root.append(first)
    document.body.append(root)
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Component media')
    skin.assets = [{ id: 'component-image', path: 'assets/component-image.png', kind: 'component-media', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.appearance.componentMedia = [{
      id: 'component-composer', name: 'composer',
      target: { tagName: 'button', role: null, classNames: ['abc_composer'] },
      assetId: 'component-image', blurPx: 3,
      light: { opacity: 0.8, scrimOpacity: 0.1 }, dark: { opacity: 0.7, scrimOpacity: 0.2 },
    }]
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['component-image', new Blob(['image'], { type: 'image/png' })]]))
    const firstLayer = first.querySelector<HTMLElement>('[data-dsh-skin-studio-component-layer="component-composer"]')
    expect(firstLayer).not.toBeNull()
    expect(firstLayer?.querySelector('img')?.style.objectFit).toBe('cover')
    expect(first.style.position).toBe('relative')
    expect(first.style.isolation).toBe('isolate')
    const second = document.createElement('button')
    second.className = 'abc_composer'
    root.append(second)
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(second.querySelector('[data-dsh-skin-studio-component-layer="component-composer"]')).not.toBeNull()
    applier.dispose()
    expect(document.querySelector('[data-dsh-skin-studio-component-layer]')).toBeNull()
    expect(first.style.position).toBe('')
    expect(first.style.isolation).toBe('')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:component')
  })

  it('keeps page components behind open dialogs while preserving dialog component media', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dialog-safe')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const root = document.createElement('div')
    root.id = 'root'
    const outside = document.createElement('button')
    outside.className = 'abc_component'
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const inside = document.createElement('button')
    inside.className = 'abc_component'
    dialog.append(inside)
    root.append(outside, dialog)
    document.body.append(root)
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Dialog-safe components')
    skin.assets = [{ id: 'component-image', path: 'assets/component-image.png', kind: 'component-media', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.appearance.componentMedia = [{ id: 'component-rule', name: 'component', target: { tagName: 'button', role: null, classNames: ['abc_component'] }, assetId: 'component-image', blurPx: 0, light: { opacity: 1, scrimOpacity: 0.5 }, dark: { opacity: 1, scrimOpacity: 0.5 } }]
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['component-image', new Blob(['image'], { type: 'image/png' })]]))
    const outsideLayer = outside.querySelector<HTMLElement>('[data-dsh-skin-studio-component-layer]')!
    const insideLayer = inside.querySelector<HTMLElement>('[data-dsh-skin-studio-component-layer]')!
    expect(outsideLayer.style.display).toBe('none')
    expect(outside.style.isolation).toBe('')
    expect(insideLayer.style.display).toBe('block')
    expect(inside.style.isolation).toBe('isolate')
    dialog.remove()
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(outsideLayer.style.display).toBe('block')
    expect(outside.style.isolation).toBe('isolate')
    applier.dispose()
  })

  it('replaces semantic visual slots once and restores the original node', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hero-mark')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const root = document.createElement('div')
    root.id = 'root'
    root.innerHTML = '<main><svg viewBox="0 0 1051 468"></svg></main>'
    document.body.append(root)
    const original = root.querySelector<SVGElement>('svg')!
    let visualWidth = 1000
    let visualHeight = 1000
    original.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: visualWidth, bottom: visualHeight,
      width: visualWidth, height: visualHeight, toJSON: () => ({}),
    }) as DOMRect
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Visual slots')
    skin.assets = [{ id: 'hero-mark', path: 'assets/hero-mark.png', kind: 'visual-asset', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.visualAssetOverrides['hero-backdrop-illustration'] = 'hero-mark'
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['hero-mark', new Blob(['image'], { type: 'image/png' })]]))
    expect(original.style.display).toBe('none')
    const replacement = root.querySelector<HTMLImageElement>('[data-dsh-skin-studio-visual-slot="hero-backdrop-illustration"]')!
    Object.defineProperty(replacement, 'naturalWidth', { configurable: true, value: 200 })
    Object.defineProperty(replacement, 'naturalHeight', { configurable: true, value: 300 })
    replacement.dispatchEvent(new Event('load'))
    expect(replacement.style.width).toBe('1000px')
    expect(replacement.style.height).toBe('1500px')
    expect(replacement.style.objectFit).toBe('contain')
    expect(replacement.style.maxWidth).toBe('none')
    visualWidth = 500
    visualHeight = 500
    window.dispatchEvent(new Event('resize'))
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(replacement.style.width).toBe('500px')
    expect(replacement.style.height).toBe('750px')
    Object.defineProperty(replacement, 'naturalWidth', { configurable: true, value: 600 })
    Object.defineProperty(replacement, 'naturalHeight', { configurable: true, value: 500 })
    visualWidth = 1000
    visualHeight = 1000
    window.dispatchEvent(new Event('resize'))
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(Number.parseFloat(replacement.style.width)).toBeCloseTo(600 * 1000 / 500)
    expect(replacement.style.height).toBe('1000px')
    expect(root.querySelectorAll('[data-dsh-skin-studio-visual-slot="hero-backdrop-illustration"]')).toHaveLength(1)
    await applier.apply(skin, new Map([['hero-mark', new Blob(['image'], { type: 'image/png' })]]))
    expect(root.querySelectorAll('[data-dsh-skin-studio-visual-slot="hero-backdrop-illustration"]')).toHaveLength(1)
    await applier.apply(null)
    expect(original.style.display).toBe('')
    expect(root.querySelector('[data-dsh-skin-studio-visual-slot]')).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalled()
    applier.dispose()
  })

  it('keeps title visual sizing stable when layout rectangles fluctuate during reload', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stable-title')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const root = document.createElement('div')
    root.id = 'root'
    root.innerHTML = '<main><div><span><svg width="34" height="25" viewBox="0 0 23.16 17.04"></svg></span><span>探索未至之境</span><span>预览版</span></div></main>'
    document.body.append(root)
    const original = root.querySelector<SVGElement>('svg')!
    const transientRect = vi.fn(() => ({
      x: 0, y: 0, top: 0, left: 0, right: 340, bottom: 250,
      width: 340, height: 250, toJSON: () => ({}),
    }) as DOMRect)
    original.getBoundingClientRect = transientRect
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Stable title visual')
    skin.assets = [{ id: 'title-mark', path: 'assets/title-mark.png', kind: 'visual-asset', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.visualAssetOverrides['hero-whale-logo'] = 'title-mark'
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['title-mark', new Blob(['image'], { type: 'image/png' })]]))
    const replacement = root.querySelector<HTMLImageElement>('[data-dsh-skin-studio-visual-slot="hero-whale-logo"]')!
    Object.defineProperty(replacement, 'naturalWidth', { configurable: true, value: 600 })
    Object.defineProperty(replacement, 'naturalHeight', { configurable: true, value: 500 })
    replacement.dispatchEvent(new Event('load'))
    expect(Number.parseFloat(replacement.style.width)).toBeCloseTo(34)
    expect(Number.parseFloat(replacement.style.height)).toBeCloseTo(500 * 34 / 600)
    window.dispatchEvent(new Event('resize'))
    await new Promise(resolve => { window.setTimeout(resolve, 30) })
    expect(Number.parseFloat(replacement.style.width)).toBeCloseTo(34)
    expect(Number.parseFloat(replacement.style.height)).toBeCloseTo(500 * 34 / 600)
    expect(transientRect).not.toHaveBeenCalled()
    applier.dispose()
  })

  it('applies localized copy slots, switches locale, and restores defaults', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    root.innerHTML = '<main><div><span><svg width="34" viewBox="0 0 23.16 17.04"></svg></span><span>探索未至之境</span><span>预览版</span></div></main>'
    document.body.append(root)
    const title = root.querySelectorAll<HTMLElement>('span')[1]!
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Copy slots')
    skin.copyOverrides['welcome.title'] = { zh: '今天一起写代码', en: 'Build something today' }
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin)
    expect(title.textContent).toBe('今天一起写代码')
    applier.setLocale('en')
    expect(title.textContent).toBe('Build something today')
    await applier.apply(null)
    expect(title.textContent).toBe('Into the Unknown')
    expect(title.hasAttribute('data-dsh-skin-studio-copy-slot')).toBe(false)
    applier.dispose()
  })

  it('skips unavailable semantic slots without failing the skin', async () => {
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Unavailable slot')
    skin.assets = [{ id: 'hero-mark', path: 'assets/hero-mark.png', kind: 'visual-asset', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.visualAssetOverrides['hero-whale-logo'] = 'hero-mark'
    const applier = new SkinApplier(ctx as never)
    await expect(applier.apply(skin, new Map([['hero-mark', new Blob(['image'], { type: 'image/png' })]]))).resolves.toBeUndefined()
    expect(document.querySelector('[data-dsh-skin-studio-visual-slot]')).toBeNull()
    applier.dispose()
  })

  it('uses a still frame when reduced motion is requested and reacts to changes', async () => {
    let onChange: ((event: MediaQueryListEvent) => void) | undefined
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => { onChange = listener }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reduced-motion')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Reduced motion')
    skin.assets = [{ id: 'motion', path: 'assets/motion.mp4', kind: 'wallpaper', mimeType: 'video/mp4', size: 16, sha256: '0'.repeat(64) }]
    skin.appearance.wallpaperAssetId = 'motion'
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['motion', new Blob(['video'], { type: 'video/mp4' })]]))
    const video = document.querySelector<HTMLVideoElement>('video[data-dsh-skin-studio-media="video"]')!
    expect(video).toMatchObject({ autoplay: false, loop: false, preload: 'metadata' })
    expect(play).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    onChange?.({ matches: false } as MediaQueryListEvent)
    expect(video).toMatchObject({ autoplay: true, loop: true, preload: 'auto' })
    expect(play).toHaveBeenCalledOnce()
    onChange?.({ matches: true } as MediaQueryListEvent)
    expect(video.autoplay).toBe(false)
    expect(pause).toHaveBeenCalledTimes(2)
    applier.dispose()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledOnce()
  })

  it('plays component videos only while their layer is visible', async () => {
    let onIntersection: IntersectionObserverCallback | undefined
    class TestIntersectionObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = '0px'
      thresholds = [0]
      constructor(callback: IntersectionObserverCallback) { onIntersection = callback }
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:component-video')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const root = document.createElement('div')
    root.id = 'root'
    const target = document.createElement('button')
    target.className = 'abc_video'
    root.append(target)
    document.body.append(root)
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Visible component video')
    skin.assets = [{ id: 'component-video', path: 'assets/component-video.mp4', kind: 'component-media', mimeType: 'video/mp4', size: 16, sha256: '0'.repeat(64) }]
    skin.appearance.componentMedia = [{ id: 'component-video-rule', name: 'video', target: { tagName: 'button', role: null, classNames: ['abc_video'] }, assetId: 'component-video', blurPx: 0, light: { opacity: 1, scrimOpacity: 0.5 }, dark: { opacity: 1, scrimOpacity: 0.5 } }]
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['component-video', new Blob(['video'], { type: 'video/mp4' })]]))
    const layer = target.querySelector<HTMLElement>('[data-dsh-skin-studio-component-layer]')!
    const video = layer.querySelector<HTMLVideoElement>('video')!
    expect(video.autoplay).toBe(false)
    expect(play).not.toHaveBeenCalled()
    onIntersection?.([{ target: layer, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(play).toHaveBeenCalledOnce()
    expect(video.autoplay).toBe(true)
    onIntersection?.([{ target: layer, isIntersecting: false } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(video.autoplay).toBe(false)
    expect(pause).toHaveBeenCalledOnce()
    applier.dispose()
  })

  it('caps simultaneous component video layers', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:component-video-cap')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const root = document.createElement('div')
    root.id = 'root'
    for (let index = 0; index < 20; index++) {
      const target = document.createElement('button')
      target.className = 'abc_video'
      root.append(target)
    }
    document.body.append(root)
    const ctx = { theme: { getTheme: () => ({ active: { colorScheme: 'light' } }), overrideTokens: vi.fn(() => vi.fn()) } }
    const skin = createBlankSkin('Capped component videos')
    skin.assets = [{ id: 'component-video', path: 'assets/component-video.mp4', kind: 'component-media', mimeType: 'video/mp4', size: 16, sha256: '0'.repeat(64) }]
    skin.appearance.componentMedia = [{ id: 'component-video-rule', name: 'video', target: { tagName: 'button', role: null, classNames: ['abc_video'] }, assetId: 'component-video', blurPx: 0, light: { opacity: 1, scrimOpacity: 0.5 }, dark: { opacity: 1, scrimOpacity: 0.5 } }]
    const applier = new SkinApplier(ctx as never)
    await applier.apply(skin, new Map([['component-video', new Blob(['video'], { type: 'video/mp4' })]]))
    expect(document.querySelectorAll('[data-dsh-skin-studio-component-layer]')).toHaveLength(12)
    applier.dispose()
  })
})
