import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ComponentMediaRule, SkinManifestV1, SkinMode, ThemeTokenModes } from '../model.ts'
import { COPY_SLOT_IDS, VISUAL_ASSET_SLOT_IDS, type CopySlotId, type SkinLocale, type VisualAssetSlotId } from '../skin-slots.ts'
import { buildThemeTokenOverrides } from '../tokens.ts'
import { defaultCopyValue, findCopySlotTargets, findVisualSlotTargets, type CopyTargetProperty } from './semantic-slots.ts'
import { findTextOverrideTargets, type ResolvedTextTarget } from './text-targets.ts'

const SOURCE = 'dsh-skin-studio'
const SYSTEM_UI = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
const SYSTEM_CODE = '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
const MAX_COMPONENT_LAYERS = 200
const MAX_COMPONENT_VIDEO_LAYERS = 12
const SIDEBAR_WORDMARK_SPLIT_HEIGHT = 32
const SIDEBAR_WORDMARK_SINGLE_WIDTH = 188
const SIDEBAR_WORDMARK_SINGLE_ROW_HEIGHT = 72

interface ComponentLayerState {
  layer: HTMLSpanElement
  media: HTMLImageElement | HTMLVideoElement
  scrim: HTMLSpanElement
  rule: ComponentMediaRule
}

interface ComponentTargetState {
  position: string
  isolation: string
}

interface VisualSlotTargetState {
  original: HTMLElement | SVGElement
  replacement: HTMLImageElement
  display: string
  observedParent: Element | null
  slotId: VisualAssetSlotId
  overflowTarget: HTMLElement | null
  overflow: string
  layoutTarget: HTMLElement | null
  layoutHeight: string
}

interface CopySlotTargetState {
  element: HTMLElement
  property: CopyTargetProperty
  original: string
  lastApplied: string
}

interface SyncedAriaState {
  element: HTMLElement
  original: string
  lastApplied: string
}

interface TextOverrideTargetState {
  target: ResolvedTextTarget
  original: string
  lastApplied: string
  aria?: SyncedAriaState
}

interface HiddenBrandMarkState {
  element: HTMLElement
  display: string
}

export class SkinApplier {
  private releaseOverride: () => void = () => {}
  private layer: HTMLDivElement | undefined
  private media: HTMLImageElement | HTMLVideoElement | undefined
  private scrim: HTMLDivElement | undefined
  private mediaUrl: string | undefined
  private previousBodyIsolation: string | undefined
  private root: HTMLElement | undefined
  private previousRootPosition: string | undefined
  private previousRootZIndex: string | undefined
  private mainTarget: HTMLElement | undefined
  private resizeObserver: ResizeObserver | undefined
  private mutationObserver: MutationObserver | undefined
  private layoutFrame: number | undefined
  private componentLayers = new Map<string, Map<HTMLElement, ComponentLayerState>>()
  private componentTargetStyles = new Map<HTMLElement, ComponentTargetState>()
  private componentMediaUrls = new Map<string, string>()
  private componentObserver: MutationObserver | undefined
  private componentVideoObserver: IntersectionObserver | undefined
  private componentVideos = new Map<HTMLSpanElement, HTMLVideoElement>()
  private visibleComponentVideos = new Set<HTMLVideoElement>()
  private componentFrame: number | undefined
  private visualSlotTargets = new Map<VisualAssetSlotId, Map<Element, VisualSlotTargetState>>()
  private hiddenBrandMarkSeats = new Map<HTMLElement, HiddenBrandMarkState>()
  private copySlotTargets = new Map<CopySlotId, Map<HTMLElement, Map<CopyTargetProperty, CopySlotTargetState>>>()
  private textOverrideTargets = new Map<string, Map<Node, TextOverrideTargetState>>()
  private semanticAssetUrls = new Map<string, string>()
  private semanticObserver: MutationObserver | undefined
  private semanticResizeObserver: ResizeObserver | undefined
  private semanticFrame: number | undefined
  private faces: FontFace[] = []
  private fontUrls: string[] = []
  private revision = 0
  private current: SkinManifestV1 | null = null
  private assets = new Map<string, Blob>()
  private mode: SkinMode
  private locale: SkinLocale
  private motionQuery: MediaQueryList | undefined
  private reduceMotion = false

  constructor(private readonly ctx: ClientContext) {
    this.mode = ctx.theme.getTheme().active.colorScheme
    this.locale = ctx.locale?.getLocale().active ?? 'zh'
    if (typeof matchMedia !== 'undefined') {
      this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
      this.reduceMotion = this.motionQuery.matches
      this.motionQuery.addEventListener('change', this.onMotionPreferenceChange)
    }
  }

  setMode(mode: SkinMode): void {
    this.mode = mode
    this.paintBackdrop()
    this.paintComponentMedia()
  }

  setLocale(locale: SkinLocale): void {
    this.locale = locale
    for (const [slotId, elements] of this.copySlotTargets) {
      for (const properties of elements.values()) {
        for (const state of properties.values()) state.original = defaultCopyValue(slotId, locale, state.property)
      }
    }
    this.refreshSemanticOverrides()
  }

  private onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    this.reduceMotion = event.matches
    this.updateAllVideoPlayback()
  }

  private prepareVideo(video: HTMLVideoElement, component: boolean): void {
    const shouldAutoplay = !this.reduceMotion && (!component || this.componentVideoObserver === undefined)
    video.muted = true
    video.defaultMuted = true
    video.autoplay = shouldAutoplay
    video.loop = shouldAutoplay
    video.playsInline = true
    video.preload = shouldAutoplay ? 'auto' : 'metadata'
    video.disablePictureInPicture = true
  }

  private updateVideoPlayback(video: HTMLVideoElement, component: boolean): void {
    const visible = !component || this.componentVideoObserver === undefined || this.visibleComponentVideos.has(video)
    const shouldPlay = !this.reduceMotion && visible
    video.muted = true
    video.defaultMuted = true
    video.autoplay = shouldPlay
    video.loop = shouldPlay
    video.playsInline = true
    video.preload = shouldPlay ? 'auto' : 'metadata'
    video.disablePictureInPicture = true
    if (shouldPlay) void video.play().catch(() => {})
    else video.pause()
  }

  private updateAllVideoPlayback(): void {
    if (this.media instanceof HTMLVideoElement) this.updateVideoPlayback(this.media, false)
    for (const video of this.componentVideos.values()) this.updateVideoPlayback(video, true)
  }

  async apply(skin: SkinManifestV1 | null, assets: ReadonlyMap<string, Blob> = new Map()): Promise<void> {
    const revision = ++this.revision
    this.current = skin
    this.assets = new Map(assets)
    this.clearVisualAssets()
    if (skin === null) {
      this.releaseOverride()
      this.releaseOverride = () => {}
      return
    }
    const tokens = buildThemeTokenOverrides(skin)
    await this.loadFonts(skin, tokens)
    if (revision !== this.revision) return
    const nextRelease = this.ctx.theme.overrideTokens(SOURCE, tokens)
    this.releaseOverride()
    this.releaseOverride = nextRelease
    await this.loadBackdrop(skin)
    this.loadComponentMedia(skin)
    this.loadSemanticOverrides(skin)
  }

  private loadSemanticOverrides(skin: SkinManifestV1): void {
    for (const assetId of Object.values(skin.visualAssetOverrides)) {
      if (this.semanticAssetUrls.has(assetId)) continue
      const blob = this.assets.get(assetId)
      const descriptor = skin.assets.find(asset => asset.id === assetId && asset.kind === 'visual-asset')
      if (blob !== undefined && descriptor !== undefined) this.semanticAssetUrls.set(assetId, URL.createObjectURL(blob))
    }
    const hasVisualOverrides = Object.keys(skin.visualAssetOverrides).length > 0
    const hasCopyOverrides = Object.keys(skin.copyOverrides).some(slotId => slotId !== 'settings.title')
    const hasTextOverrides = skin.textOverrides.length > 0
    if (!hasVisualOverrides && !hasCopyOverrides && !hasTextOverrides) return
    if (typeof MutationObserver !== 'undefined') {
      this.semanticObserver = new MutationObserver(this.scheduleSemanticRefresh)
      this.semanticObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'aria-label', 'aria-labelledby', 'aria-controls', 'aria-expanded', 'aria-selected',
          'class', 'contenteditable', 'data-chat-flow-kind', 'data-testid', 'href', 'id', 'placeholder', 'role', 'title',
        ],
      })
    }
    if (hasVisualOverrides) {
      window.addEventListener('resize', this.scheduleSemanticRefresh)
      if (typeof ResizeObserver !== 'undefined') this.semanticResizeObserver = new ResizeObserver(this.scheduleSemanticRefresh)
      const revision = this.revision
      void document.fonts?.ready.then(() => {
        if (this.revision === revision) this.scheduleSemanticRefresh()
      })
    }
    this.refreshSemanticOverrides()
  }

  private createVisualSlotTarget(target: Element, slotId: VisualAssetSlotId, url: string): VisualSlotTargetState | undefined {
    if (!(target instanceof HTMLElement) && !(target instanceof SVGElement)) return undefined
    const computed = getComputedStyle(target)
    const replacement = document.createElement('img')
    replacement.dataset.dshSkinStudioVisualSlot = slotId
    replacement.alt = ''
    replacement.draggable = false
    replacement.ariaHidden = 'true'
    replacement.src = url
    const className = target.getAttribute('class')
    if (className !== null) replacement.setAttribute('class', className)
    const closestButton = target.closest('button')
    const overflowTarget = slotId === 'sidebar-brand-wordmark' && closestButton instanceof HTMLElement
      ? closestButton
      : null
    const overflow = overflowTarget?.style.overflow ?? ''
    if (overflowTarget !== null) overflowTarget.style.overflow = 'visible'
    const layoutTarget = slotId === 'sidebar-brand-wordmark'
      && this.current?.sidebarBrandLayout === 'single'
      && closestButton?.parentElement instanceof HTMLElement
      ? closestButton.parentElement
      : null
    const layoutHeight = layoutTarget?.style.height ?? ''
    if (layoutTarget !== null) layoutTarget.style.height = `${SIDEBAR_WORDMARK_SINGLE_ROW_HEIGHT}px`
    Object.assign(replacement.style, {
      display: computed.display === 'none' ? 'inline-block' : computed.display,
      width: 'auto',
      objectFit: 'contain',
      objectPosition: 'center',
      aspectRatio: 'auto',
      maxWidth: 'none',
      maxHeight: 'none',
      pointerEvents: 'none',
    })
    const state = {
      original: target,
      replacement,
      display: target.style.display,
      observedParent: target.parentElement,
      slotId,
      overflowTarget,
      overflow,
      layoutTarget,
      layoutHeight,
    }
    if (state.observedParent !== null) this.semanticResizeObserver?.observe(state.observedParent)
    replacement.addEventListener('load', () => { this.syncVisualSlotSize(state) }, { once: true })
    this.syncVisualSlotSize(state)
    target.after(replacement)
    return state
  }

  private syncVisualSlotSize(state: VisualSlotTargetState): void {
    const attributeDimension = (axis: 'width' | 'height'): string | undefined => {
      const attribute = state.original.getAttribute(axis)
      return attribute !== null && /^\d+(?:\.\d+)?$/.test(attribute) ? `${attribute}px` : undefined
    }
    const attributeWidth = attributeDimension('width')
    const attributeHeight = attributeDimension('height')
    let rect: DOMRect | undefined
    let computed: CSSStyleDeclaration | undefined
    if (attributeWidth === undefined || attributeHeight === undefined) {
      state.original.style.display = state.display
      rect = state.original.getBoundingClientRect()
      computed = getComputedStyle(state.original)
    }
    const layoutDimension = (axis: 'width' | 'height'): string | undefined => {
      if (rect === undefined || computed === undefined) return undefined
      const measured = rect[axis]
      if (measured > 0) return `${measured}px`
      const fallback = computed[axis]
      return fallback !== '' && fallback !== 'auto' && fallback !== 'none' ? fallback : undefined
    }
    const width = attributeWidth ?? layoutDimension('width')
    const height = attributeHeight ?? layoutDimension('height')
    if (width !== undefined && height !== undefined
      && state.replacement.naturalWidth > 0 && state.replacement.naturalHeight > 0) {
      const targetWidth = Number.parseFloat(width)
      const targetHeight = Number.parseFloat(height)
      const singleBrand = state.slotId === 'sidebar-brand-wordmark'
        && this.current?.sidebarBrandLayout === 'single'
      const visualWidth = targetWidth
      const visualHeight = state.slotId === 'sidebar-brand-wordmark'
        ? Math.max(targetHeight, SIDEBAR_WORDMARK_SPLIT_HEIGHT)
        : targetHeight
      const scaleForWidth = visualWidth / state.replacement.naturalWidth
      const scaleForHeight = visualHeight / state.replacement.naturalHeight
      const scale = singleBrand
        ? SIDEBAR_WORDMARK_SINGLE_WIDTH / state.replacement.naturalWidth
        : state.slotId === 'sidebar-brand-wordmark'
          ? Math.min(scaleForWidth, scaleForHeight)
          : Math.max(scaleForWidth, scaleForHeight)
      if (Number.isFinite(scale) && scale > 0) {
        state.replacement.style.width = `${state.replacement.naturalWidth * scale}px`
        state.replacement.style.height = `${state.replacement.naturalHeight * scale}px`
      }
    } else {
      if (width !== undefined) state.replacement.style.width = width
      if (height !== undefined) state.replacement.style.height = height
    }
    state.original.style.display = 'none'
  }

  private removeVisualSlotTarget(state: VisualSlotTargetState): void {
    if (state.observedParent !== null) this.semanticResizeObserver?.unobserve(state.observedParent)
    if (state.original.isConnected) state.original.style.display = state.display
    if (state.overflowTarget?.isConnected === true) state.overflowTarget.style.overflow = state.overflow
    if (state.layoutTarget?.isConnected === true) state.layoutTarget.style.height = state.layoutHeight
    state.replacement.remove()
  }

  private readCopyTarget(state: Pick<CopySlotTargetState, 'element' | 'property'>): string {
    if (state.property === 'text') return state.element.textContent ?? ''
    return state.element.getAttribute(state.property) ?? ''
  }

  private writeCopyTarget(state: Pick<CopySlotTargetState, 'element' | 'property'>, value: string): void {
    if (state.property === 'text') {
      if (state.element.textContent !== value) state.element.textContent = value
      return
    }
    if (state.element.getAttribute(state.property) !== value) state.element.setAttribute(state.property, value)
  }

  private removeCopySlotTarget(slotId: CopySlotId, state: CopySlotTargetState): void {
    const current = this.readCopyTarget(state)
    if (current !== state.lastApplied) state.original = current
    this.writeCopyTarget(state, state.original)
    if (state.element.getAttribute('data-dsh-skin-studio-copy-slot') === slotId) {
      state.element.removeAttribute('data-dsh-skin-studio-copy-slot')
    }
  }

  private refreshVisualSlots(): void {
    if (this.current === null) return
    for (const slotId of VISUAL_ASSET_SLOT_IDS) {
      const assetId = this.current.visualAssetOverrides[slotId]
      const url = assetId === undefined ? undefined : this.semanticAssetUrls.get(assetId)
      const targets = url === undefined ? [] : findVisualSlotTargets(slotId)
      const targetSet = new Set(targets)
      const states = this.visualSlotTargets.get(slotId) ?? new Map<Element, VisualSlotTargetState>()
      this.visualSlotTargets.set(slotId, states)
      for (const [target, state] of states) {
        if (!target.isConnected || !targetSet.has(target)) {
          this.removeVisualSlotTarget(state)
          states.delete(target)
        } else this.syncVisualSlotSize(state)
      }
      if (url === undefined) continue
      for (const target of targets) {
        if (states.has(target)) continue
        const state = this.createVisualSlotTarget(target, slotId, url)
        if (state !== undefined) states.set(target, state)
      }
    }
  }

  private expandedBrandMarkSeat(mark: Element): HTMLElement | undefined {
    const button = mark.closest('button')
    const wordmark = button?.querySelector('svg[viewBox="26 0 156 24"]')
    if (button === null || button === undefined || wordmark === null || wordmark === undefined) return undefined
    const identity = [...button.children].find(child => child.contains(mark) && child.contains(wordmark))
    const seat = identity === undefined ? undefined : [...identity.children].find(child => child.contains(mark))
    return seat instanceof HTMLElement ? seat : undefined
  }

  private refreshSidebarBrandLayout(): void {
    if (this.current === null) return
    const wordmarkAssetId = this.current.visualAssetOverrides['sidebar-brand-wordmark']
    const single = this.current.sidebarBrandLayout === 'single'
      && wordmarkAssetId !== undefined
      && this.semanticAssetUrls.has(wordmarkAssetId)
    const seats = single
      ? findVisualSlotTargets('sidebar-brand-mark').map(mark => this.expandedBrandMarkSeat(mark)).filter((seat): seat is HTMLElement => seat !== undefined)
      : []
    const seatSet = new Set(seats)
    for (const [seat, state] of this.hiddenBrandMarkSeats) {
      if (!seat.isConnected || !seatSet.has(seat)) {
        if (seat.isConnected) seat.style.display = state.display
        this.hiddenBrandMarkSeats.delete(seat)
      }
    }
    for (const seat of seats) {
      if (!this.hiddenBrandMarkSeats.has(seat)) {
        this.hiddenBrandMarkSeats.set(seat, { element: seat, display: seat.style.display })
      }
      seat.style.display = 'none'
    }
  }

  private refreshCopySlots(): void {
    if (this.current === null) return
    for (const slotId of COPY_SLOT_IDS) {
      const custom = this.current.copyOverrides[slotId]?.[this.locale]
      const targets = custom === undefined ? [] : findCopySlotTargets(slotId)
      const states = this.copySlotTargets.get(slotId) ?? new Map<HTMLElement, Map<CopyTargetProperty, CopySlotTargetState>>()
      this.copySlotTargets.set(slotId, states)
      for (const [element, properties] of states) {
        for (const [property, state] of properties) {
          const retained = targets.some(target => target.element === element && target.property === property)
          if (!element.isConnected || !retained || custom === undefined) {
            this.removeCopySlotTarget(slotId, state)
            properties.delete(property)
          }
        }
        if (properties.size === 0) states.delete(element)
      }
      if (custom === undefined) continue
      for (const target of targets) {
        let properties = states.get(target.element)
        if (properties === undefined) {
          properties = new Map()
          states.set(target.element, properties)
        }
        let state = properties.get(target.property)
        if (state === undefined) {
          state = {
            element: target.element,
            property: target.property,
            original: this.readCopyTarget(target),
            lastApplied: custom,
          }
          properties.set(target.property, state)
          target.element.setAttribute('data-dsh-skin-studio-copy-slot', slotId)
        } else {
          const current = this.readCopyTarget(state)
          if (current !== state.lastApplied) state.original = current
          state.lastApplied = custom
        }
        this.writeCopyTarget(state, custom)
      }
    }
  }

  private textTargetKey(target: ResolvedTextTarget): Node {
    return target.property === 'text' ? target.textNode! : target.element
  }

  private readTextOverrideTarget(state: Pick<TextOverrideTargetState, 'target'>): string {
    return state.target.property === 'text'
      ? state.target.textNode?.data ?? ''
      : state.target.element.getAttribute('placeholder') ?? ''
  }

  private writeTextOverrideTarget(state: Pick<TextOverrideTargetState, 'target'>, value: string): void {
    if (state.target.property === 'text') {
      if (state.target.textNode !== undefined && state.target.textNode.data !== value) state.target.textNode.data = value
    } else if (state.target.element.getAttribute('placeholder') !== value) {
      state.target.element.setAttribute('placeholder', value)
    }
  }

  private matchingAriaTarget(state: Pick<TextOverrideTargetState, 'target' | 'original'>): HTMLElement | undefined {
    const labelled = state.target.element.closest<HTMLElement>('[aria-label]')
    return labelled?.getAttribute('aria-label') === state.original ? labelled : undefined
  }

  private refreshTextOverrideState(state: TextOverrideTargetState, custom: string): void {
    const current = this.readTextOverrideTarget(state)
    if (current !== state.lastApplied) state.original = current
    if (state.aria !== undefined) {
      const currentAria = state.aria.element.getAttribute('aria-label') ?? ''
      if (currentAria !== state.aria.lastApplied) state.aria.original = currentAria
      if (state.aria.original !== state.original) {
        if (currentAria === state.aria.lastApplied) state.aria.element.setAttribute('aria-label', state.aria.original)
        delete state.aria
      }
    }
    if (state.aria === undefined) {
      const element = this.matchingAriaTarget(state)
      if (element !== undefined) state.aria = { element, original: state.original, lastApplied: custom }
    }
    state.lastApplied = custom
    this.writeTextOverrideTarget(state, custom)
    if (state.aria !== undefined) {
      state.aria.lastApplied = custom
      if (state.aria.element.getAttribute('aria-label') !== custom) state.aria.element.setAttribute('aria-label', custom)
    }
  }

  private removeTextOverrideTarget(ruleId: string, state: TextOverrideTargetState): void {
    const current = this.readTextOverrideTarget(state)
    if (current !== state.lastApplied) state.original = current
    this.writeTextOverrideTarget(state, state.original)
    if (state.aria !== undefined) {
      const currentAria = state.aria.element.getAttribute('aria-label') ?? ''
      if (currentAria !== state.aria.lastApplied) state.aria.original = currentAria
      if (state.aria.element.isConnected) state.aria.element.setAttribute('aria-label', state.aria.original)
    }
    if (state.target.element.getAttribute('data-dsh-skin-studio-text-override') === ruleId) {
      state.target.element.removeAttribute('data-dsh-skin-studio-text-override')
    }
  }

  private refreshTextOverrides(): void {
    if (this.current === null) return
    const ruleIds = new Set(this.current.textOverrides.map(rule => rule.id))
    for (const [ruleId, states] of this.textOverrideTargets) {
      if (ruleIds.has(ruleId)) continue
      for (const state of states.values()) {
        this.removeTextOverrideTarget(ruleId, state)
      }
      this.textOverrideTargets.delete(ruleId)
    }
    for (const rule of this.current.textOverrides) {
      const custom = rule.replacements[this.locale]
      const targets = custom === undefined ? [] : findTextOverrideTargets(rule.target)
      const targetKeys = new Set(targets.map(target => this.textTargetKey(target)))
      const states = this.textOverrideTargets.get(rule.id) ?? new Map<Node, TextOverrideTargetState>()
      this.textOverrideTargets.set(rule.id, states)
      for (const [key, state] of states) {
        if (!key.isConnected || !targetKeys.has(key) || custom === undefined) {
          this.removeTextOverrideTarget(rule.id, state)
          states.delete(key)
        }
      }
      if (custom === undefined) continue
      for (const target of targets) {
        const key = this.textTargetKey(target)
        let state = states.get(key)
        if (state === undefined) {
          const original = target.property === 'text' ? target.textNode?.data ?? '' : target.element.getAttribute('placeholder') ?? ''
          state = { target, original, lastApplied: custom }
          states.set(key, state)
          target.element.setAttribute('data-dsh-skin-studio-text-override', rule.id)
        }
        this.refreshTextOverrideState(state, custom)
      }
    }
  }

  private refreshSemanticOverrides(): void {
    this.refreshVisualSlots()
    this.refreshSidebarBrandLayout()
    this.refreshCopySlots()
    this.refreshTextOverrides()
  }

  private scheduleSemanticRefresh = (): void => {
    if (this.semanticFrame !== undefined) cancelAnimationFrame(this.semanticFrame)
    this.semanticFrame = requestAnimationFrame(() => {
      this.semanticFrame = undefined
      this.refreshSemanticOverrides()
    })
  }

  private clearSemanticOverrides(): void {
    window.removeEventListener('resize', this.scheduleSemanticRefresh)
    this.semanticObserver?.disconnect()
    this.semanticObserver = undefined
    this.semanticResizeObserver?.disconnect()
    this.semanticResizeObserver = undefined
    if (this.semanticFrame !== undefined) cancelAnimationFrame(this.semanticFrame)
    this.semanticFrame = undefined
    for (const states of this.visualSlotTargets.values()) {
      for (const state of states.values()) this.removeVisualSlotTarget(state)
    }
    this.visualSlotTargets.clear()
    for (const state of this.hiddenBrandMarkSeats.values()) {
      if (state.element.isConnected) state.element.style.display = state.display
    }
    this.hiddenBrandMarkSeats.clear()
    for (const [ruleId, states] of this.textOverrideTargets) {
      for (const state of states.values()) this.removeTextOverrideTarget(ruleId, state)
    }
    this.textOverrideTargets.clear()
    for (const [slotId, elements] of this.copySlotTargets) {
      for (const properties of elements.values()) {
        for (const state of properties.values()) this.removeCopySlotTarget(slotId, state)
      }
    }
    this.copySlotTargets.clear()
    for (const url of this.semanticAssetUrls.values()) URL.revokeObjectURL(url)
    this.semanticAssetUrls.clear()
  }

  private async loadFonts(skin: SkinManifestV1, tokens: Record<string, ThemeTokenModes>): Promise<void> {
    for (const [slot, reference] of [['ui', skin.appearance.uiFont], ['code', skin.appearance.codeFont]] as const) {
      let family = reference.family || (slot === 'ui' ? SYSTEM_UI : SYSTEM_CODE)
      if (reference.kind === 'asset' && reference.assetId !== null) {
        const blob = this.assets.get(reference.assetId)
        if (blob !== undefined) {
          const url = URL.createObjectURL(blob)
          try {
            const face = new FontFace(`DshSkin-${skin.id}-${slot}`, `url(${JSON.stringify(url)})`)
            await face.load()
            document.fonts.add(face)
            this.faces.push(face)
            this.fontUrls.push(url)
            family = `"${face.family}", ${slot === 'ui' ? SYSTEM_UI : SYSTEM_CODE}`
          } catch {
            URL.revokeObjectURL(url)
          }
        }
      }
      const modes = { light: family, dark: family }
      if (slot === 'ui') tokens['--dsw-font-family'] = modes
      else {
        tokens['--ds-font-family-code'] = modes
        tokens['--dsw-font-mono'] = modes
      }
    }
  }

  private loadBackdrop(skin: SkinManifestV1): void {
    const assetId = skin.appearance.wallpaperAssetId
    const blob = assetId === null ? undefined : this.assets.get(assetId)
    if (blob === undefined) return
    const descriptor = skin.assets.find(asset => asset.id === assetId)
    if (descriptor === undefined) return
    this.mediaUrl = URL.createObjectURL(blob)
    this.layer = document.createElement('div')
    this.layer.dataset.dshSkinStudioBackdrop = ''
    this.layer.dataset.dshSkinStudioScope = 'main'
    Object.assign(this.layer.style, {
      position: 'fixed', top: '0', right: '0', bottom: '0', left: '0',
      overflow: 'hidden', pointerEvents: 'none', zIndex: '0',
    })
    this.media = descriptor.mimeType.startsWith('video/') ? document.createElement('video') : document.createElement('img')
    this.media.dataset.dshSkinStudioMedia = descriptor.mimeType.startsWith('video/') ? 'video' : 'image'
    Object.assign(this.media.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      objectFit: 'cover', objectPosition: 'center', maxWidth: 'none', maxHeight: 'none',
    })
    if (this.media instanceof HTMLVideoElement) {
      this.prepareVideo(this.media, false)
    } else {
      this.media.alt = ''
      this.media.draggable = false
    }
    this.media.src = this.mediaUrl
    this.scrim = document.createElement('div')
    this.scrim.dataset.dshSkinStudioScrim = ''
    Object.assign(this.scrim.style, { position: 'absolute', inset: '0' })
    this.layer.append(this.media, this.scrim)
    this.previousBodyIsolation = document.body.style.isolation
    document.body.style.isolation = 'isolate'
    this.root = document.getElementById('root') ?? undefined
    if (this.root !== undefined) {
      this.previousRootPosition = this.root.style.position
      this.previousRootZIndex = this.root.style.zIndex
      const rootPosition = getComputedStyle(this.root).position
      if (rootPosition === '' || rootPosition === 'static') this.root.style.position = 'relative'
      this.root.style.zIndex = '1'
    }
    document.body.prepend(this.layer)
    this.startBackdropLayout()
    this.paintBackdrop()
    if (this.media instanceof HTMLVideoElement) this.updateVideoPlayback(this.media, false)
  }

  private paintBackdrop(): void {
    if (this.media === undefined || this.scrim === undefined || this.current === null || this.mediaUrl === undefined) return
    const settings = this.current.appearance[this.mode]
    this.media.style.opacity = String(settings.wallpaperOpacity)
    this.media.style.filter = `blur(${this.current.appearance.wallpaperBlurPx}px)`
    const bounds = this.layer?.getBoundingClientRect()
    const shortestSide = Math.min(bounds?.width ?? 0, bounds?.height ?? 0)
    const blurScale = shortestSide > 0 ? 1 + (this.current.appearance.wallpaperBlurPx * 4) / shortestSide : 1
    this.media.style.transform = blurScale > 1 ? `scale(${blurScale})` : 'none'
    this.scrim.style.background = this.mode === 'light' ? '#ffffff' : '#000000'
    this.scrim.style.opacity = String(settings.scrimOpacity)
  }

  private findMainTarget(): HTMLElement | undefined {
    if (this.root === undefined) return undefined
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const candidates: Array<{ element: HTMLElement; depth: number; left: number }> = []
    const parents = [this.root, ...this.root.querySelectorAll<HTMLElement>('div')]
    for (const parent of parents) {
      const parentRect = parent.getBoundingClientRect()
      if (parentRect.width < viewportWidth * 0.8 || parentRect.height < viewportHeight * 0.75) continue
      for (const child of parent.children) {
        if (!(child instanceof HTMLElement)) continue
        const rect = child.getBoundingClientRect()
        const validLeft = rect.left >= 40 && rect.left <= Math.min(520, viewportWidth - 40)
        const fillsRight = rect.right >= viewportWidth - 2
        const fillsHeight = rect.height >= viewportHeight * 0.75
        if (!validLeft || !fillsRight || !fillsHeight) continue
        let depth = 0
        for (let node: HTMLElement | null = child; node !== null && node !== this.root; node = node.parentElement) depth++
        candidates.push({ element: child, depth, left: rect.left })
      }
    }
    candidates.sort((first, second) => first.depth - second.depth || second.left - first.left)
    return candidates[0]?.element
  }

  private layoutBackdrop(): void {
    if (this.layer === undefined) return
    const nextTarget = this.findMainTarget()
    if (nextTarget !== this.mainTarget) {
      if (this.mainTarget !== undefined) this.resizeObserver?.unobserve(this.mainTarget)
      this.mainTarget = nextTarget
      if (this.mainTarget !== undefined) this.resizeObserver?.observe(this.mainTarget)
    }
    const rect = this.mainTarget?.getBoundingClientRect()
    const left = rect === undefined ? 0 : Math.max(0, Math.min(window.innerWidth - 1, Math.round(rect.left)))
    const top = rect === undefined ? 0 : Math.max(0, Math.round(rect.top))
    this.layer.style.left = `${left}px`
    this.layer.style.top = `${top}px`
    this.layer.style.right = '0'
    this.layer.style.bottom = '0'
    this.paintBackdrop()
  }

  private scheduleBackdropLayout = (): void => {
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame)
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = undefined
      this.layoutBackdrop()
    })
  }

  private startBackdropLayout(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.scheduleBackdropLayout)
      if (this.root !== undefined) this.resizeObserver.observe(this.root)
    }
    if (typeof MutationObserver !== 'undefined' && this.root !== undefined) {
      this.mutationObserver = new MutationObserver(records => {
        if (this.mainTarget === undefined || !this.mainTarget.isConnected || records.some(record =>
          [...record.removedNodes].some(node => node === this.mainTarget || (node instanceof Element && node.contains(this.mainTarget!))))) {
          this.scheduleBackdropLayout()
        }
      })
      this.mutationObserver.observe(this.root, { childList: true, subtree: true })
    }
    window.addEventListener('resize', this.scheduleBackdropLayout)
    this.layoutBackdrop()
  }

  private stopBackdropLayout(): void {
    window.removeEventListener('resize', this.scheduleBackdropLayout)
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    this.mutationObserver?.disconnect()
    this.mutationObserver = undefined
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame)
    this.layoutFrame = undefined
    this.mainTarget = undefined
  }

  private loadComponentMedia(skin: SkinManifestV1): void {
    for (const rule of skin.appearance.componentMedia) {
      if (rule.assetId === null || this.componentMediaUrls.has(rule.assetId)) continue
      const blob = this.assets.get(rule.assetId)
      const descriptor = skin.assets.find(asset => asset.id === rule.assetId && asset.kind === 'component-media')
      if (blob !== undefined && descriptor !== undefined) this.componentMediaUrls.set(rule.assetId, URL.createObjectURL(blob))
    }
    if (this.componentMediaUrls.size === 0) return
    if (typeof IntersectionObserver !== 'undefined') {
      this.componentVideoObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const video = this.componentVideos.get(entry.target as HTMLSpanElement)
          if (video === undefined) continue
          if (entry.isIntersecting) this.visibleComponentVideos.add(video)
          else this.visibleComponentVideos.delete(video)
          this.updateVideoPlayback(video, true)
        }
      })
    }
    if (typeof MutationObserver !== 'undefined') {
      this.componentObserver = new MutationObserver(this.scheduleComponentRefresh)
      this.componentObserver.observe(document.body, { childList: true, subtree: true })
    }
    window.addEventListener('resize', this.scheduleComponentRefresh)
    this.refreshComponentMedia()
  }

  private componentMatches(element: HTMLElement, rule: ComponentMediaRule): boolean {
    if (element.tagName.toLowerCase() !== rule.target.tagName) return false
    if (rule.target.role !== null && element.getAttribute('role') !== rule.target.role) return false
    return rule.target.classNames.every(name => element.classList.contains(name))
  }

  private findComponentTargets(rule: ComponentMediaRule): HTMLElement[] {
    const root = document.getElementById('root')
    if (root === null) return []
    return [...root.querySelectorAll<HTMLElement>(rule.target.tagName)].filter(element =>
      this.componentMatches(element, rule)
      && element.closest('[data-dsh-skin-studio-ui]') === null
      && element.closest('[data-dsh-skin-studio-component-layer]') === null)
  }

  private createComponentLayer(target: HTMLElement, rule: ComponentMediaRule, url: string): ComponentLayerState {
    if (!this.componentTargetStyles.has(target)) {
      this.componentTargetStyles.set(target, { position: target.style.position, isolation: target.style.isolation })
      const position = getComputedStyle(target).position
      if (position === '' || position === 'static') target.style.position = 'relative'
      target.style.isolation = 'isolate'
    }
    const layer = document.createElement('span')
    layer.dataset.dshSkinStudioComponentLayer = rule.id
    layer.ariaHidden = 'true'
    Object.assign(layer.style, {
      position: 'absolute', inset: '0', display: 'block', overflow: 'hidden',
      borderRadius: 'inherit', pointerEvents: 'none', zIndex: '-1',
    })
    const descriptor = this.current?.assets.find(asset => asset.id === rule.assetId)
    const media = descriptor?.mimeType.startsWith('video/') === true ? document.createElement('video') : document.createElement('img')
    Object.assign(media.style, {
      position: 'absolute', maxWidth: 'none', maxHeight: 'none', objectFit: 'cover', objectPosition: 'center',
    })
    if (media instanceof HTMLVideoElement) {
      this.prepareVideo(media, true)
    } else {
      media.alt = ''
      media.draggable = false
    }
    media.src = url
    const scrim = document.createElement('span')
    Object.assign(scrim.style, { position: 'absolute', inset: '0', display: 'block' })
    layer.append(media, scrim)
    target.prepend(layer)
    const state = { layer, media, scrim, rule }
    this.paintComponentLayer(state)
    if (media instanceof HTMLVideoElement) {
      this.componentVideos.set(layer, media)
      if (this.componentVideoObserver !== undefined) this.componentVideoObserver.observe(layer)
      else this.updateVideoPlayback(media, true)
    }
    return state
  }

  private isBehindOpenDialog(target: HTMLElement): boolean {
    return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(dialog => {
      if (dialog.contains(target) || dialog.getAttribute('aria-hidden') === 'true') return false
      const style = getComputedStyle(dialog)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
  }

  private syncComponentTargetStacking(): void {
    for (const [target, previous] of this.componentTargetStyles) {
      const suspended = this.isBehindOpenDialog(target)
      if (suspended) {
        target.style.position = previous.position
        target.style.isolation = previous.isolation
      } else {
        const position = getComputedStyle(target).position
        if (position === '' || position === 'static') target.style.position = 'relative'
        target.style.isolation = 'isolate'
      }
      for (const layers of this.componentLayers.values()) {
        const state = layers.get(target)
        if (state === undefined) continue
        state.layer.style.display = suspended ? 'none' : 'block'
        if (suspended && state.media instanceof HTMLVideoElement) {
          this.visibleComponentVideos.delete(state.media)
          this.updateVideoPlayback(state.media, true)
        }
      }
    }
  }

  private paintComponentLayer(state: ComponentLayerState): void {
    const appearance = state.rule[this.mode]
    const spread = state.rule.blurPx * 2
    Object.assign(state.media.style, {
      top: `${-spread}px`, left: `${-spread}px`,
      width: `calc(100% + ${spread * 2}px)`, height: `calc(100% + ${spread * 2}px)`,
      opacity: String(appearance.opacity), filter: `blur(${state.rule.blurPx}px)`,
    })
    state.scrim.style.background = this.mode === 'light' ? '#ffffff' : '#000000'
    state.scrim.style.opacity = String(appearance.scrimOpacity)
  }

  private paintComponentMedia(): void {
    for (const layers of this.componentLayers.values()) {
      for (const state of layers.values()) this.paintComponentLayer(state)
    }
  }

  private refreshComponentMedia(): void {
    if (this.current === null) return
    let layerCount = 0
    let videoLayerCount = 0
    for (const rule of this.current.appearance.componentMedia) {
      const url = rule.assetId === null ? undefined : this.componentMediaUrls.get(rule.assetId)
      const isVideo = rule.assetId !== null && this.current.assets.find(asset => asset.id === rule.assetId)?.mimeType.startsWith('video/') === true
      const layers = this.componentLayers.get(rule.id) ?? new Map<HTMLElement, ComponentLayerState>()
      this.componentLayers.set(rule.id, layers)
      const targets = url === undefined ? [] : this.findComponentTargets(rule)
      const remainingLayers = Math.max(0, MAX_COMPONENT_LAYERS - layerCount)
      const remainingVideos = isVideo ? Math.max(0, MAX_COMPONENT_VIDEO_LAYERS - videoLayerCount) : remainingLayers
      const targetSet = new Set(targets.slice(0, Math.min(remainingLayers, remainingVideos)))
      for (const [target, state] of layers) {
        if (!target.isConnected || !targetSet.has(target) || !state.layer.isConnected || state.layer.parentElement !== target) {
          this.removeComponentLayer(target, state)
          layers.delete(target)
        }
      }
      for (const target of targetSet) {
        if (!layers.has(target) && url !== undefined) layers.set(target, this.createComponentLayer(target, rule, url))
      }
      layerCount += layers.size
      if (isVideo) videoLayerCount += layers.size
    }
    this.syncComponentTargetStacking()
  }

  private removeComponentLayer(target: HTMLElement, state: ComponentLayerState): void {
    if (state.media instanceof HTMLVideoElement) {
      this.componentVideoObserver?.unobserve(state.layer)
      this.componentVideos.delete(state.layer)
      this.visibleComponentVideos.delete(state.media)
      state.media.pause()
      state.media.removeAttribute('src')
      state.media.load()
    }
    state.layer.remove()
    const stillUsed = [...this.componentLayers.values()].some(layers => [...layers.keys()].some(element => element === target && layers.get(element) !== state))
    if (!stillUsed) {
      const previous = this.componentTargetStyles.get(target)
      if (previous !== undefined) {
        target.style.position = previous.position
        target.style.isolation = previous.isolation
        this.componentTargetStyles.delete(target)
      }
    }
  }

  private scheduleComponentRefresh = (): void => {
    if (this.componentFrame !== undefined) cancelAnimationFrame(this.componentFrame)
    this.componentFrame = requestAnimationFrame(() => {
      this.componentFrame = undefined
      this.refreshComponentMedia()
    })
  }

  private clearComponentMedia(): void {
    window.removeEventListener('resize', this.scheduleComponentRefresh)
    this.componentObserver?.disconnect()
    this.componentObserver = undefined
    this.componentVideoObserver?.disconnect()
    this.componentVideoObserver = undefined
    this.componentVideos.clear()
    this.visibleComponentVideos.clear()
    if (this.componentFrame !== undefined) cancelAnimationFrame(this.componentFrame)
    this.componentFrame = undefined
    for (const layers of this.componentLayers.values()) {
      for (const [target, state] of layers) this.removeComponentLayer(target, state)
    }
    this.componentLayers.clear()
    for (const [target, previous] of this.componentTargetStyles) {
      target.style.position = previous.position
      target.style.isolation = previous.isolation
    }
    this.componentTargetStyles.clear()
    for (const url of this.componentMediaUrls.values()) URL.revokeObjectURL(url)
    this.componentMediaUrls.clear()
  }

  private clearVisualAssets(): void {
    this.clearSemanticOverrides()
    this.clearComponentMedia()
    this.stopBackdropLayout()
    if (this.media instanceof HTMLVideoElement) {
      this.media.pause()
      this.media.removeAttribute('src')
      this.media.load()
    }
    this.layer?.remove()
    this.layer = undefined
    this.media = undefined
    this.scrim = undefined
    if (this.mediaUrl !== undefined) URL.revokeObjectURL(this.mediaUrl)
    this.mediaUrl = undefined
    if (this.previousBodyIsolation !== undefined) document.body.style.isolation = this.previousBodyIsolation
    this.previousBodyIsolation = undefined
    if (this.root !== undefined) {
      if (this.previousRootPosition !== undefined) this.root.style.position = this.previousRootPosition
      if (this.previousRootZIndex !== undefined) this.root.style.zIndex = this.previousRootZIndex
    }
    this.root = undefined
    this.previousRootPosition = undefined
    this.previousRootZIndex = undefined
    for (const face of this.faces) document.fonts.delete(face)
    this.faces = []
    for (const url of this.fontUrls) URL.revokeObjectURL(url)
    this.fontUrls = []
  }

  dispose(): void {
    ++this.revision
    this.clearVisualAssets()
    this.motionQuery?.removeEventListener('change', this.onMotionPreferenceChange)
    this.motionQuery = undefined
    this.releaseOverride()
    this.releaseOverride = () => {}
  }
}
