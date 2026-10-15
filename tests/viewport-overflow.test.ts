import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBlankSkin } from '../src/presets.ts'
import { SkinApplier } from '../src/client/applier.ts'

const instances: SkinApplier[] = []
afterEach(() => {
  for (const instance of instances.splice(0)) instance.dispose()
  document.documentElement.removeAttribute('style')
  document.body.removeAttribute('style')
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function applyWallpaper() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:viewport-wallpaper')
  const instance = new SkinApplier({ theme: {
    getTheme: () => ({ active: { colorScheme: 'light' } }),
    overrideTokens: () => () => {},
  } } as never)
  instances.push(instance)
  const skin = createBlankSkin('Viewport wallpaper')
  skin.assets = [{ id: 'wall', kind: 'wallpaper', path: 'assets/wall.png', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
  skin.appearance.wallpaperAssetId = 'wall'
  return { instance, skin, assets: new Map([['wall', new Blob(['image'], { type: 'image/png' })]]) }
}

describe('wallpaper viewport containment', () => {
  it('contains document overflow without changing the conversation scroller', async () => {
    document.body.innerHTML = '<div id="root"><main style="height:100px;overflow-y:auto"><div style="height:2000px"></div></main></div>'
    const scroller = document.querySelector('main')!
    const before = scroller.style.cssText
    const { instance, skin, assets } = applyWallpaper()
    await instance.apply(skin, assets)
    expect(document.documentElement.style.overflow).toBe('clip')
    expect(document.body.style.overflow).toBe('clip')
    expect(scroller.style.cssText).toBe(before)
    await instance.apply(null)
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
    expect(scroller.style.cssText).toBe(before)
  })

  it('restores original shorthand and axis values on switching or unload', async () => {
    document.documentElement.style.overflowX = 'hidden'
    document.documentElement.style.setProperty('overflow-y', 'auto', 'important')
    document.body.style.overflow = 'scroll'
    const { instance, skin, assets } = applyWallpaper()
    await instance.apply(skin, assets)
    await instance.apply(createBlankSkin('Colours only'))
    expect(document.documentElement.style.overflowX).toBe('hidden')
    expect(document.documentElement.style.overflowY).toBe('auto')
    expect(document.body.style.overflow).toBe('scroll')
    await instance.apply(skin, assets)
    instance.dispose()
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.documentElement.style.overflowX).toBe('hidden')
    expect(document.documentElement.style.overflowY).toBe('auto')
  })
})
