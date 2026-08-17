import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  Button, DisclosureRow, IconPersonalizationOutline16, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { generateCounterpart, inspectContrast } from '../color.ts'
import { GUI_TOKEN_GROUPS, suggestTokenModes, type GuiTokenSpec } from '../gui-tokens.ts'
import { describeAsset, SkinPackageError } from '../package-format.ts'
import {
  PALETTE_ROLES, makeSkinId,
  type AssetKind, type ComponentMediaRule, type PaletteRole, type SkinManifestV1, type SkinMode,
} from '../model.ts'
import type { CopySlotId, SkinLocale, VisualAssetSlotId } from '../skin-slots.ts'
import { createComponentTarget, describeComponentTarget, findPickableComponent } from './component-picker.ts'
import { CopyOverrideEditor, VisualAssetEditor } from './SemanticEditors.tsx'
import type { SkinStudioKey } from './locales.ts'
import type { ConflictPolicy, SkinStudioController } from './controller.ts'
import type { createSkinStudioStore } from './store.ts'
import css from './studio.module.css'

export interface SkinStudioInjected { controller: SkinStudioController }
export type SkinStudioRowProps = PropsRuntime<'settings.general.item'>
  & PropsStore<ReturnType<typeof createSkinStudioStore>>
  & PropsLocale<'dsh.skinStudio'>
  & SkinStudioInjected

type Tab = 'library' | 'basic' | 'advanced' | 'assets' | 'copy' | 'package'
type AdvancedView = 'guided' | 'all'

function copySkin(skin: SkinManifestV1): SkinManifestV1 { return structuredClone(skin) }
function safeFileName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized === '' ? 'skin' : normalized
}
function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

function ColorField({ label, value, colorLabel, hexLabel, onChange }: {
  label: string; value: string; colorLabel: string; hexLabel: string; onChange: (value: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  const commit = (): void => {
    if (/^#[0-9a-f]{6}$/i.test(text)) onChange(text.toLowerCase())
    else setText(value)
  }
  return (
    <label className={css.colorField}>
      <span>{label}</span>
      <span className={css.colorControl}>
        <input type="color" value={value} aria-label={`${label} ${colorLabel}`} onChange={event => { onChange(event.target.value) }} />
        <input type="text" value={text} aria-label={`${label} ${hexLabel}`} spellCheck={false} onChange={event => { setText(event.target.value) }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit() }} />
      </span>
    </label>
  )
}

function TokenColorInput({ label, value, colorLabel, hexLabel, onChange }: {
  label: string; value: string; colorLabel: string; hexLabel: string; onChange: (value: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  const commit = (): void => {
    if (/^#[0-9a-f]{6}$/i.test(text)) onChange(text.toLowerCase())
    else setText(value)
  }
  return <span className={css.tokenColorInput}><input type="color" value={value} aria-label={`${label} ${colorLabel}`} onChange={event => { onChange(event.target.value) }} /><input type="text" value={text} aria-label={`${label} ${hexLabel}`} spellCheck={false} onChange={event => { setText(event.target.value) }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit() }} /></span>
}

function Slider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void
}) {
  return (
    <label className={css.sliderField}>
      <span>{label}</span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={event => { onChange(Number(event.target.value)) }} />
      <output>{step < 1 ? Math.round(value * 100) : value}{suffix}</output>
    </label>
  )
}

export function SkinStudioRow({ t, useStore, controller }: SkinStudioRowProps) {
  const skins = useStore(state => state.skins)
  const activeId = useStore(state => state.activeId)
  const ready = useStore(state => state.ready)
  const persistent = useStore(state => state.persistent)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('library')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SkinManifestV1 | null>(null)
  const [assets, setAssets] = useState<Map<string, Blob>>(new Map())
  const [mode, setMode] = useState<SkinMode>('light')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [dirty, setDirty] = useState(false)
  const [discardPending, setDiscardPending] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [regenerateConfirm, setRegenerateConfirm] = useState(false)
  const [contrastConfirmed, setContrastConfirmed] = useState(false)
  const [mediaReadabilityConfirmed, setMediaReadabilityConfirmed] = useState(false)
  const [tokenSearch, setTokenSearch] = useState('')
  const [editingTokens, setEditingTokens] = useState<Set<string>>(new Set())
  const [advancedView, setAdvancedView] = useState<AdvancedView>('guided')
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('keep')
  const [packageStatus, setPackageStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [assetError, setAssetError] = useState<'invalid' | 'too-large' | null>(null)
  const [pickingComponent, setPickingComponent] = useState(false)
  const [pickSettingsComponent, setPickSettingsComponent] = useState(false)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const importRef = useRef<HTMLInputElement | null>(null)
  const wallpaperRef = useRef<HTMLInputElement | null>(null)
  const uiFontRef = useRef<HTMLInputElement | null>(null)
  const codeFontRef = useRef<HTMLInputElement | null>(null)
  const componentMediaRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const componentRuleRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const studioRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const discardReturnFocusRef = useRef<HTMLElement | null>(null)
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ library: null, basic: null, advanced: null, assets: null, copy: null, package: null })

  const selected = skins.find(skin => skin.id === selectedId) ?? null
  const active = skins.find(skin => skin.id === activeId) ?? null
  const wallpaperAsset = draft?.assets.find(asset => asset.id === draft.appearance.wallpaperAssetId)
  const issues = draft === null ? [] : inspectContrast(draft.palettes, draft.overrides)
  const hasContrastIssues = issues.length > 0
  const hasMediaReadabilityRisk = draft?.appearance.componentMedia.some(rule => rule.assetId !== null && (['light', 'dark'] as const).some(item => rule[item].opacity > 0.35 && rule[item].scrimOpacity < 0.35)) ?? false
  const visibleTokens = useMemo(() => controller.tokenNames.filter(name => name.toLowerCase().includes(tokenSearch.toLowerCase())), [controller, tokenSearch])
  const runtimeTokens = useMemo(() => new Set(controller.tokenNames), [controller])
  const guidedGroups = useMemo(() => GUI_TOKEN_GROUPS.map(group => ({ ...group, tokens: group.tokens.filter(token => runtimeTokens.has(token.name)) })).filter(group => group.tokens.length > 0), [runtimeTokens])
  const friendlyTokens = useMemo(() => new Map(GUI_TOKEN_GROUPS.flatMap(group => group.tokens.map(token => [token.name, token] as const))), [])

  const beginEdit = async (skin: SkinManifestV1, nextTab: Tab = 'basic'): Promise<void> => {
    setSelectedId(skin.id)
    setDraft(copySkin(skin))
    setTab(nextTab)
    setAssets(await controller.assets(skin.id))
    setContrastConfirmed(false)
    setMediaReadabilityConfirmed(false)
    setEditingTokens(new Set(Object.keys(skin.overrides)))
    setDirty(false)
    setSaveStatus('idle')
    setAssetError(null)
  }

  useEffect(() => {
    if (!open || draft === null) return
    if (hasContrastIssues) {
      void controller.cancelPreview()
      return
    }
    const timer = window.setTimeout(() => { void controller.preview(draft, assets) }, 60)
    return () => { window.clearTimeout(timer) }
  }, [assets, controller, draft, hasContrastIssues, open])

  useEffect(() => {
    if (!open) return
    const dialog = studioRef.current?.closest<HTMLElement>('[role="dialog"]')
    dialog?.setAttribute('data-dsh-skin-studio-ui', '')
    const focusTimer = window.requestAnimationFrame(() => { tabRefs.current[tab]?.focus() })
    const trapFocus = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Tab') return
      const dialog = studioRef.current?.closest<HTMLElement>('[role="dialog"]')
      if (dialog === null || dialog === undefined) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getAttribute('aria-hidden') !== 'true' && element.tabIndex >= 0)
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable.at(-1)!
      if (!dialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trapFocus)
    return () => { dialog?.removeAttribute('data-dsh-skin-studio-ui'); window.cancelAnimationFrame(focusTimer); document.removeEventListener('keydown', trapFocus) }
  }, [open, tab])

  useEffect(() => {
    if (!pickingComponent) return
    const root = document.getElementById('root')
    if (root === null) { setPickingComponent(false); setOpen(true); return }
    const hiddenOverlays: Array<{ element: HTMLElement; visibility: string }> = []
    if (!pickSettingsComponent) {
      for (const dialog of document.querySelectorAll<HTMLElement>('[role="dialog"]')) {
        if (dialog.closest('[data-dsh-skin-studio-ui]') !== null) continue
        let overlay: HTMLElement | null = dialog
        while (overlay.parentElement !== null) {
          const rect = overlay.getBoundingClientRect()
          if (rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9) break
          overlay = overlay.parentElement
        }
        if (overlay !== null) {
          hiddenOverlays.push({ element: overlay, visibility: overlay.style.visibility })
          overlay.style.visibility = 'hidden'
        }
      }
    }
    const hint = document.createElement('div')
    hint.dataset.dshSkinStudioUi = ''
    hint.textContent = t('componentMedia.pickerHint')
    hint.setAttribute('role', 'status')
    hint.setAttribute('aria-live', 'polite')
    hint.setAttribute('aria-atomic', 'true')
    Object.assign(hint.style, {
      position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)', zIndex: '2147483647',
      maxWidth: 'min(560px, calc(100vw - 32px))', padding: '10px 14px', borderRadius: '10px',
      background: '#111827', color: '#ffffff', font: '600 14px/1.4 system-ui, sans-serif',
      boxShadow: '0 10px 30px rgba(0,0,0,.28)', pointerEvents: 'none',
    })
    const highlight = document.createElement('div')
    highlight.dataset.dshSkinStudioUi = ''
    Object.assign(highlight.style, {
      position: 'fixed', zIndex: '2147483646', border: '2px solid #16a3c7', borderRadius: '8px',
      background: 'rgba(22,163,199,.12)', boxShadow: '0 0 0 2px rgba(255,255,255,.9)', pointerEvents: 'none',
    })
    document.body.append(hint, highlight)
    let candidate: HTMLElement | undefined
    const pickFrom = (origin: Element | null): HTMLElement | undefined => {
      const picked = findPickableComponent(origin, root)
      return picked?.closest('[data-dsh-skin-studio-ui]') === null ? picked : undefined
    }
    const showCandidate = (next: HTMLElement | undefined): void => {
      candidate = next
      if (candidate === undefined) { highlight.style.display = 'none'; return }
      const rect = candidate.getBoundingClientRect()
      Object.assign(highlight.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
      hint.textContent = `${t('componentMedia.pickerHint')} · ${describeComponentTarget(createComponentTarget(candidate))}`
    }
    const move = (event: PointerEvent): void => { showCandidate(pickFrom(document.elementFromPoint(event.clientX, event.clientY))) }
    const keyboardCandidates: HTMLElement[] = []
    const seen = new Set<HTMLElement>()
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      const picked = pickFrom(element)
      if (picked === undefined || seen.has(picked) || getComputedStyle(picked).visibility !== 'visible') continue
      const rect = picked.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) continue
      seen.add(picked); keyboardCandidates.push(picked)
    }
    let keyboardIndex = -1
    const finish = (element?: HTMLElement): void => {
      let createdRuleId: string | undefined
      if (element !== undefined) {
        const target = createComponentTarget(element)
        const rule: ComponentMediaRule = {
          id: makeSkinId('component'), name: describeComponentTarget(target), target, assetId: null, blurPx: 0,
          light: { opacity: 1, scrimOpacity: 0.45 }, dark: { opacity: 0.9, scrimOpacity: 0.45 },
        }
        createdRuleId = rule.id
        updateDraft(next => { if (next.appearance.componentMedia.length < 64) next.appearance.componentMedia.push(rule) })
      }
      setPickingComponent(false)
      setOpen(true)
      setTab('advanced')
      const returnTarget = pickSettingsComponent ? 'settings' : 'app'
      window.setTimeout(() => {
        if (createdRuleId !== undefined) {
          const rule = componentRuleRefs.current.get(createdRuleId)
          rule?.scrollIntoView?.({ block: 'center' })
          rule?.querySelector<HTMLElement>('[data-component-upload]')?.focus()
          return
        }
        studioRef.current?.querySelector<HTMLElement>(`[data-component-picker="${returnTarget}"]`)?.focus()
      }, 120)
    }
    const click = (event: MouseEvent): void => {
      event.preventDefault(); event.stopImmediatePropagation()
      finish(candidate ?? pickFrom(event.target as Element))
    }
    const keydown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(); return }
      if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key) && keyboardCandidates.length > 0) {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
        keyboardIndex = (keyboardIndex + direction + keyboardCandidates.length) % keyboardCandidates.length
        const next = keyboardCandidates[keyboardIndex]!
        next.focus({ preventScroll: true }); showCandidate(next)
        return
      }
      if ((event.key === 'Enter' || event.key === ' ') && candidate !== undefined) {
        event.preventDefault(); event.stopImmediatePropagation(); finish(candidate); return
      }
      if (event.key === 'Tab') window.requestAnimationFrame(() => { showCandidate(pickFrom(document.activeElement)) })
    }
    const focusin = (event: FocusEvent): void => { showCandidate(pickFrom(event.target as Element)) }
    document.addEventListener('pointermove', move, true)
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin, true)
    const firstFocusable = keyboardCandidates.find(element => element.tabIndex >= 0)
    if (firstFocusable !== undefined) { keyboardIndex = keyboardCandidates.indexOf(firstFocusable); firstFocusable.focus({ preventScroll: true }); showCandidate(firstFocusable) }
    return () => {
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin, true)
      for (const hidden of hiddenOverlays) hidden.element.style.visibility = hidden.visibility
      hint.remove(); highlight.remove()
    }
  }, [pickSettingsComponent, pickingComponent, t])

  useEffect(() => {
    if (discardPending) studioRef.current?.querySelector<HTMLElement>(`.${css.discardPanel} button`)?.focus()
  }, [discardPending])

  const closeNow = (): void => {
    setPickingComponent(false)
    setOpen(false)
    setDraft(null)
    setEditingTokens(new Set())
    setDirty(false)
    setDiscardPending(false)
    setSaveStatus('idle')
    setPackageStatus('idle')
    setAssetError(null)
    setMediaReadabilityConfirmed(false)
    void controller.cancelPreview()
    window.setTimeout(() => { returnFocusRef.current?.focus() }, 0)
  }
  const requestClose = (): void => {
    if (dirty) {
      discardReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setDiscardPending(true)
      return
    }
    closeNow()
  }
  const keepEditing = (): void => {
    setDiscardPending(false)
    window.requestAnimationFrame(() => { discardReturnFocusRef.current?.focus() })
  }
  const openStudio = (): void => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedId(activeId ?? skins[0]?.id ?? null)
    setTab('library')
    setDiscardPending(false)
    setSaveStatus('idle')
    setOpen(true)
  }
  const discardDraft = (): void => {
    setDraft(null)
    setEditingTokens(new Set())
    setDirty(false)
    setDiscardPending(false)
    setSaveStatus('idle')
    setMediaReadabilityConfirmed(false)
    setTab('library')
    void controller.cancelPreview()
  }
  const updateDraft = (mutate: (next: SkinManifestV1) => void): void => {
    setDirty(true)
    setSaveStatus('idle')
    setContrastConfirmed(false)
    setMediaReadabilityConfirmed(false)
    setDraft(current => {
      if (current === null) return current
      const next = copySkin(current)
      mutate(next)
      next.updatedAt = new Date().toISOString()
      return next
    })
  }

  const pickAsset = async (file: File | undefined, kind: AssetKind): Promise<void> => {
    if (file === undefined || draft === null) return
    setAssetError(null)
    try {
      const assetId = makeSkinId('asset')
      const descriptor = await describeAsset(assetId, kind, file)
      const old = draft.assets.find(asset => asset.kind === kind)
      const nextAssets = new Map(assets)
      if (old !== undefined) nextAssets.delete(old.id)
      nextAssets.set(assetId, file)
      setAssets(nextAssets)
      updateDraft(next => {
        next.assets = [...next.assets.filter(asset => asset.kind !== kind), descriptor]
        if (kind === 'wallpaper') next.appearance.wallpaperAssetId = assetId
        else {
          const slot = kind === 'ui-font' ? 'uiFont' : 'codeFont'
          next.appearance[slot] = { kind: 'asset', assetId, family: file.name.replace(/\.woff2$/i, '') }
        }
      })
    } catch (error) {
      setAssetError(error instanceof SkinPackageError && error.code === 'too-large' ? 'too-large' : 'invalid')
    }
  }

  const removeAsset = (kind: AssetKind): void => {
    if (draft === null) return
    const old = draft.assets.find(asset => asset.kind === kind)
    if (old !== undefined) {
      const nextAssets = new Map(assets); nextAssets.delete(old.id); setAssets(nextAssets)
    }
    updateDraft(next => {
      next.assets = next.assets.filter(asset => asset.kind !== kind)
      if (kind === 'wallpaper') next.appearance.wallpaperAssetId = null
      else {
        const slot = kind === 'ui-font' ? 'uiFont' : 'codeFont'
        next.appearance[slot] = { kind: 'system', assetId: null, family: kind === 'ui-font' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : 'Consolas, "Liberation Mono", monospace' }
      }
    })
    if (kind === 'wallpaper') setAssetError(null)
  }

  const pickComponentAsset = async (file: File | undefined, ruleId: string): Promise<void> => {
    if (file === undefined || draft === null) return
    setAssetError(null)
    try {
      const assetId = makeSkinId('asset')
      const descriptor = await describeAsset(assetId, 'component-media', file)
      const rule = draft.appearance.componentMedia.find(item => item.id === ruleId)
      if (rule === undefined) return
      const oldAssetIsShared = rule.assetId !== null && draft.appearance.componentMedia.some(item => item.id !== ruleId && item.assetId === rule.assetId)
      const nextAssets = new Map(assets)
      if (rule.assetId !== null && !oldAssetIsShared) nextAssets.delete(rule.assetId)
      nextAssets.set(assetId, file)
      setAssets(nextAssets)
      updateDraft(next => {
        const nextRule = next.appearance.componentMedia.find(item => item.id === ruleId)
        if (nextRule === undefined) return
        const shared = nextRule.assetId !== null && next.appearance.componentMedia.some(item => item.id !== ruleId && item.assetId === nextRule.assetId)
        if (nextRule.assetId !== null && !shared) next.assets = next.assets.filter(asset => asset.id !== nextRule.assetId)
        next.assets.push(descriptor)
        nextRule.assetId = assetId
      })
    } catch (error) {
      setAssetError(error instanceof SkinPackageError && error.code === 'too-large' ? 'too-large' : 'invalid')
    }
  }

  const removeComponentRule = (ruleId: string): void => {
    if (draft === null) return
    const rule = draft.appearance.componentMedia.find(item => item.id === ruleId)
    const assetIsShared = rule?.assetId !== null && rule?.assetId !== undefined && draft.appearance.componentMedia.some(item => item.id !== ruleId && item.assetId === rule.assetId)
    if (rule?.assetId !== null && rule?.assetId !== undefined && !assetIsShared) {
      const nextAssets = new Map(assets); nextAssets.delete(rule.assetId); setAssets(nextAssets)
    }
    updateDraft(next => {
      const removed = next.appearance.componentMedia.find(item => item.id === ruleId)
      next.appearance.componentMedia = next.appearance.componentMedia.filter(item => item.id !== ruleId)
      const shared = removed?.assetId !== null && removed?.assetId !== undefined && next.appearance.componentMedia.some(item => item.assetId === removed.assetId)
      if (removed?.assetId !== null && removed?.assetId !== undefined && !shared) next.assets = next.assets.filter(asset => asset.id !== removed.assetId)
    })
  }

  const pickVisualAsset = async (slotId: VisualAssetSlotId, file: File | undefined): Promise<void> => {
    if (file === undefined || draft === null) return
    setAssetError(null)
    try {
      const assetId = makeSkinId('asset')
      const descriptor = await describeAsset(assetId, 'visual-asset', file)
      const oldAssetId = draft.visualAssetOverrides[slotId]
      const oldAssetIsShared = oldAssetId !== undefined && Object.entries(draft.visualAssetOverrides)
        .some(([otherSlot, candidate]) => otherSlot !== slotId && candidate === oldAssetId)
      const nextAssets = new Map(assets)
      if (oldAssetId !== undefined && !oldAssetIsShared) nextAssets.delete(oldAssetId)
      nextAssets.set(assetId, file)
      setAssets(nextAssets)
      updateDraft(next => {
        const previous = next.visualAssetOverrides[slotId]
        const shared = previous !== undefined && Object.entries(next.visualAssetOverrides)
          .some(([otherSlot, candidate]) => otherSlot !== slotId && candidate === previous)
        if (previous !== undefined && !shared) next.assets = next.assets.filter(asset => asset.id !== previous)
        next.assets.push(descriptor)
        next.visualAssetOverrides[slotId] = assetId
      })
    } catch (error) {
      setAssetError(error instanceof SkinPackageError && error.code === 'too-large' ? 'too-large' : 'invalid')
    }
  }

  const removeVisualAsset = (slotId: VisualAssetSlotId): void => {
    if (draft === null) return
    const assetId = draft.visualAssetOverrides[slotId]
    const shared = assetId !== undefined && Object.entries(draft.visualAssetOverrides)
      .some(([otherSlot, candidate]) => otherSlot !== slotId && candidate === assetId)
    if (assetId !== undefined && !shared) {
      const nextAssets = new Map(assets)
      nextAssets.delete(assetId)
      setAssets(nextAssets)
    }
    updateDraft(next => {
      const previous = next.visualAssetOverrides[slotId]
      delete next.visualAssetOverrides[slotId]
      const stillUsed = previous !== undefined && Object.values(next.visualAssetOverrides).includes(previous)
      if (previous !== undefined && !stillUsed) next.assets = next.assets.filter(asset => asset.id !== previous)
    })
  }

  const updateCopyOverride = (slotId: CopySlotId, language: SkinLocale, value: string): void => {
    updateDraft(next => {
      const localized = { ...(next.copyOverrides[slotId] ?? {}) }
      if (value.trim() === '') delete localized[language]
      else localized[language] = value
      if (Object.keys(localized).length === 0) delete next.copyOverrides[slotId]
      else next.copyOverrides[slotId] = localized
    })
  }

  const applyDraft = async (): Promise<void> => {
    if (draft === null || (issues.length > 0 && !contrastConfirmed) || (hasMediaReadabilityRisk && !mediaReadabilityConfirmed)) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      await controller.saveAndActivate(draft, assets)
      setSelectedId(draft.id)
      setDraft(copySkin(draft))
      setDirty(false)
      setSaveStatus('success')
    } catch {
      setSaveStatus('error')
    } finally { setSaving(false) }
  }

  const doImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    setPackageStatus('idle')
    try {
      const result = await controller.importPackage(file, conflictPolicy)
      setPackageStatus(result === 'imported' ? 'success' : 'idle')
    } catch { setPackageStatus('error') }
  }
  const doExport = async (): Promise<void> => {
    if (selectedId === null || !rightsConfirmed) return
    try {
      const blob = await controller.exportPackage(selectedId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${safeFileName(selected?.name ?? 'skin')}.dshskin`; link.click()
      URL.revokeObjectURL(url)
    } catch { setPackageStatus('error') }
  }

  const tokenLabel = (token: GuiTokenSpec | undefined, name: string): string => token === undefined
    ? name.replace(/^--dsw?-/, '').replaceAll('-', ' ')
    : t(`advanced.token.${token.label}` as SkinStudioKey)
  const renderTokenEditor = (name: string, token?: GuiTokenSpec) => {
    if (draft === null) return null
    const override = draft.overrides[name]
    const suggested = suggestTokenModes(name, draft)
    const label = tokenLabel(token, name)
    const editing = override !== undefined || editingTokens.has(name)
    const value = override?.[mode] ?? suggested[mode]
    return <div className={css.tokenRow} key={name}><div className={css.tokenMeta}><strong>{label}</strong><code>{name}</code></div>{!editing
      ? <div className={css.inheritedValue}><span className={css.tokenSwatch} style={{ background: suggested[mode] }} aria-hidden="true" /><span>{t('advanced.inherited')}</span><Button size="sm" variant="outline" onClick={() => { setEditingTokens(current => new Set(current).add(name)) }}>{t('advanced.customize')}</Button></div>
      : <div className={css.tokenEditor}><TokenColorInput label={`${label} ${t(`basic.mode.${mode}`)}`} value={value} colorLabel={t('aria.color')} hexLabel={t('aria.hex')} onChange={nextValue => { updateDraft(next => { const modes = next.overrides[name] ?? suggestTokenModes(name, next); next.overrides[name] = { ...modes, [mode]: nextValue } }) }} /><Button size="sm" onClick={() => { setEditingTokens(current => { const next = new Set(current); next.delete(name); return next }); if (override !== undefined) updateDraft(next => { delete next.overrides[name] }) }}>{t('advanced.reset')}</Button></div>}</div>
  }

  const renderComponentMediaRule = (rule: ComponentMediaRule) => {
    if (draft === null) return null
    const descriptor = rule.assetId === null ? undefined : draft.assets.find(asset => asset.id === rule.assetId)
    const targetCode = `${rule.target.tagName}${rule.target.role === null ? '' : `[role=${rule.target.role}]`}${rule.target.classNames.map(name => `.${name}`).join('')}`
    return <div ref={node => { if (node === null) componentRuleRefs.current.delete(rule.id); else componentRuleRefs.current.set(rule.id, node) }} className={css.componentMediaRule} key={rule.id} data-awaiting-upload={descriptor === undefined || undefined}>
      <input ref={node => { if (node === null) componentMediaRefs.current.delete(rule.id); else componentMediaRefs.current.set(rule.id, node) }} hidden type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.mp4,.webm" onChange={event => { void pickComponentAsset(event.target.files?.[0], rule.id); event.target.value = '' }} />
      <div className={css.componentMediaHeading}>
        <div><strong>{rule.name}</strong><code>{targetCode}</code></div>
        <div className={css.componentMediaActions}>
          <Button size="sm" onClick={() => { removeComponentRule(rule.id) }}>{t('componentMedia.remove')}</Button>
        </div>
      </div>
      {descriptor === undefined ? <div className={css.componentUploadPrompt} role="status"><div><strong>{t('componentMedia.nextStep')}</strong><span>{t('componentMedia.uploadHint')}</span></div><Button className={css.componentUploadButton} data-component-upload="" variant="primary" onClick={() => { componentMediaRefs.current.get(rule.id)?.click() }}>{t('componentMedia.upload')}</Button></div>
        : <div className={css.componentAssetRow}><span className={css.assetMeta}>{descriptor.mimeType.replace('image/', '').replace('video/', '').toUpperCase()} · {formatBytes(descriptor.size)}</span><Button data-component-upload="" size="sm" variant="outline" onClick={() => { componentMediaRefs.current.get(rule.id)?.click() }}>{t('componentMedia.replace')}</Button></div>}
      {descriptor !== undefined && <div className={css.componentMediaControls}>
        <Slider label={`${rule.name} ${t('componentMedia.opacity')}`} value={rule[mode].opacity} min={0} max={1} step={0.05} suffix="%" onChange={value => { updateDraft(next => { const nextRule = next.appearance.componentMedia.find(item => item.id === rule.id); if (nextRule !== undefined) nextRule[mode].opacity = value }) }} />
        <Slider label={`${rule.name} ${t('componentMedia.scrim')}`} value={rule[mode].scrimOpacity} min={0} max={1} step={0.05} suffix="%" onChange={value => { updateDraft(next => { const nextRule = next.appearance.componentMedia.find(item => item.id === rule.id); if (nextRule !== undefined) nextRule[mode].scrimOpacity = value }) }} />
        <Slider label={`${rule.name} ${t('componentMedia.blur')}`} value={rule.blurPx} min={0} max={40} step={1} suffix="px" onChange={value => { updateDraft(next => { const nextRule = next.appearance.componentMedia.find(item => item.id === rule.id); if (nextRule !== undefined) nextRule.blurPx = value }) }} />
      </div>}
    </div>
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabledTabs: Tab[] = draft === null ? ['library', 'package'] : ['library', 'basic', 'advanced', 'assets', 'copy', 'package']
    const current = Math.max(0, enabledTabs.indexOf(tab))
    let next = current
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabledTabs.length - 1
    else next = (current + (event.key === 'ArrowRight' ? 1 : -1) + enabledTabs.length) % enabledTabs.length
    const nextTab = enabledTabs[next]!
    setTab(nextTab)
    window.requestAnimationFrame(() => { tabRefs.current[nextTab]?.focus() })
  }

  const contrastWarning = draft !== null && issues.length > 0 ? <div className={css.warningPanel} role="alert"><strong>{t('contrast.title')}</strong><p>{t('contrast.description')}</p><span className={css.previewLabel}>{t('contrast.preview')}</span><div className={css.contrastPreview}>{(['light', 'dark'] as const).map(item => {
    const palette = draft.palettes[item]
    return <div key={item} style={{ background: draft.overrides['--dsw-alias-bg-base']?.[item] ?? palette.background, color: draft.overrides['--dsw-alias-label-primary']?.[item] ?? palette.foreground }}><span>{t(`basic.mode.${item}`)}</span><strong>Aa</strong><i style={{ background: draft.overrides['--dsw-alias-brand-primary']?.[item] ?? palette.accent }} /></div>
  })}</div><label><input type="checkbox" checked={contrastConfirmed} onChange={event => { setContrastConfirmed(event.target.checked) }} />{t('contrast.confirm')}</label></div> : null

  const footer = draft === null || !(['basic', 'advanced', 'assets', 'copy'] as Tab[]).includes(tab) ? undefined : (
    <div className={css.footerArea}>
      {saveStatus === 'success' && <span className={css.success} role="status">{t('action.saved')}</span>}
      {saveStatus === 'error' && <span className={css.error} role="alert">{t('action.saveError')}</span>}
      <div className={css.footerActions}>
      <Button variant="ghost" onClick={discardDraft}>{t('action.cancel')}</Button>
      <Button variant="primary" disabled={saving || draft.name.trim() === '' || (issues.length > 0 && !contrastConfirmed) || (hasMediaReadabilityRisk && !mediaReadabilityConfirmed)} onClick={() => { void applyDraft() }}>
        {saving ? t('action.saving') : t('action.apply')}
      </Button>
      </div>
    </div>
  )

  return (
    <div className={css.rowRoot} data-dsh-skin-studio-ui="">
      <DisclosureRow
        icon={<IconPersonalizationOutline16 />}
        title={t('row.title')}
        open={false}
        expandable={false}
        onToggle={() => {}}
        collapsedContent={(
          <div className={css.rowSummary}>
            <span>{active?.name ?? t('row.none')}</span>
            <Button size="sm" variant="outline" disabled={!ready && persistent} onClick={openStudio}>{t('row.open')}</Button>
          </div>
        )}
      />
      <Modal
        open={open}
        onClose={requestClose}
        title={t('modal.title')}
        description={t('modal.description')}
        closeLabel={t('modal.close')}
        className={css.modal!}
        contentClassName={css.modalContent!}
        footer={footer}
      >
        <div ref={studioRef} className={css.studio} data-dsh-skin-studio-ui="">
        {discardPending && <div className={css.discardPanel} role="alert"><div><strong>{t('discard.title')}</strong><p>{t('discard.description')}</p></div><div className={css.discardActions}><Button variant="outline" onClick={keepEditing}>{t('discard.keep')}</Button><Button variant="primary" onClick={closeNow}>{t('discard.confirm')}</Button></div></div>}
        <div className={css.status} role="status" data-warning={!persistent || undefined}>{persistent ? t('status.local') : t('status.volatile')}</div>
        <div className={css.tabs} role="tablist" aria-label={t('modal.title')}>
          {(['library', 'basic', 'advanced', 'assets', 'copy', 'package'] as const).map(item => (
            <button key={item} ref={node => { tabRefs.current[item] = node }} id={`skin-studio-tab-${item}`} type="button" role="tab" aria-selected={tab === item} aria-controls={`skin-studio-panel-${item}`} tabIndex={tab === item ? 0 : -1} disabled={draft === null && item !== 'library' && item !== 'package'} className={css.tab} onClick={() => { setTab(item) }} onKeyDown={onTabKeyDown}>
              {t(`tab.${item}` as SkinStudioKey)}
            </button>
          ))}
        </div>

        {tab === 'library' && (
          <section id="skin-studio-panel-library" role="tabpanel" aria-labelledby="skin-studio-tab-library" className={css.page}>
            <div className={css.pageHeading}>
              <h3>{t('tab.library')}</h3>
              <Button size="sm" variant="primary" onClick={() => { const skin = controller.create(); setDraft(skin); setAssets(new Map()); setEditingTokens(new Set()); setSelectedId(skin.id); setDirty(true); setSaveStatus('idle'); setTab('basic') }}>{t('library.new')}</Button>
            </div>
            <div className={css.skinList}>
              {skins.length === 0 && <p className={css.empty}>{t('library.empty')}</p>}
              {skins.map(skin => (
                <article className={css.skinItem} key={skin.id} data-active={skin.id === activeId || undefined}>
                  <div className={css.swatches} aria-hidden="true">
                    {PALETTE_ROLES.slice(0, 4).map(role => <span key={role} style={{ background: skin.palettes.light[role] }} />)}
                  </div>
                  <div className={css.skinMeta}>
                    <strong>{skin.name}</strong>
                    <span>{skin.description || skin.author || t('status.local')}</span>
                  </div>
                  <div className={css.itemActions}>
                    {skin.id === activeId ? <span className={css.activeLabel}>{t('library.active')}</span> : <Button size="sm" onClick={() => { void controller.activate(skin.id) }}>{t('library.activate')}</Button>}
                    <Button size="sm" onClick={() => { void beginEdit(skin) }}>{t('library.edit')}</Button>
                    <Button size="sm" onClick={() => { setSelectedId(skin.id); setDraft(null); setDirty(false); setRightsConfirmed(false); setPackageStatus('idle'); setTab('package'); void controller.cancelPreview() }}>{t('library.package')}</Button>
                    <Button size="sm" onClick={() => { void controller.duplicate(skin.id) }}>{t('library.duplicate')}</Button>
                    <Button size="sm" onClick={() => {
                      if (deleteConfirm === skin.id) { void controller.remove(skin.id); setDeleteConfirm(null) }
                      else setDeleteConfirm(skin.id)
                    }}>{deleteConfirm === skin.id ? t('library.deleteConfirm') : t('library.delete')}</Button>
                  </div>
                </article>
              ))}
            </div>
            <Button variant="outline" onClick={() => { void controller.activate(null) }}>{t('library.restore')}</Button>
          </section>
        )}

        {tab === 'basic' && draft !== null && (
          <section id="skin-studio-panel-basic" role="tabpanel" aria-labelledby="skin-studio-tab-basic" className={css.page}>
            <div className={css.editorSection}>
              <h3>{t('basic.identity')}</h3>
              <div className={css.identityGrid}>
                <label><span>{t('basic.name')}</span><input value={draft.name} maxLength={80} onChange={event => { updateDraft(next => { next.name = event.target.value }) }} /></label>
                <label><span>{t('basic.author')}</span><input value={draft.author} maxLength={80} onChange={event => { updateDraft(next => { next.author = event.target.value }) }} /></label>
                <label className={css.wide}><span>{t('basic.description')}</span><textarea value={draft.description} maxLength={300} rows={2} onChange={event => { updateDraft(next => { next.description = event.target.value }) }} /></label>
              </div>
            </div>
            <div className={css.modeBar}>
              <div role="group" className={css.segmented}>
                {(['light', 'dark'] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => { setMode(item); setRegenerateConfirm(false) }}>{t(`basic.mode.${item}`)}</button>)}
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                if (!regenerateConfirm) { setRegenerateConfirm(true); return }
                updateDraft(next => { next.palettes[mode] = generateCounterpart(next.palettes[mode === 'light' ? 'dark' : 'light'], mode) })
                setRegenerateConfirm(false)
              }}>{regenerateConfirm ? t('basic.regenerateConfirm') : t('basic.regenerate')}</Button>
            </div>
            <div className={css.editorSection}>
              <h3>{t('basic.colors')}</h3>
              <div className={css.colorGrid}>
                {PALETTE_ROLES.map(role => <ColorField key={role} label={t(`color.${role}` as SkinStudioKey)} value={draft.palettes[mode][role]} colorLabel={t('aria.color')} hexLabel={t('aria.hex')} onChange={value => { updateDraft(next => { next.palettes[mode][role] = value }) }} />)}
              </div>
            </div>
            <div className={css.editorSection}>
              <h3>{t('basic.wallpaper')}</h3>
              <div className={css.assetRow}>
                <input ref={wallpaperRef} hidden type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.mp4,.webm" onChange={event => { void pickAsset(event.target.files?.[0], 'wallpaper'); event.target.value = '' }} />
                <Button size="sm" variant="outline" onClick={() => { wallpaperRef.current?.click() }}>{t('basic.wallpaperUpload')}</Button>
                {draft.appearance.wallpaperAssetId !== null && <Button size="sm" onClick={() => { removeAsset('wallpaper') }}>{t('basic.wallpaperRemove')}</Button>}
                {wallpaperAsset !== undefined && <span className={css.assetMeta}>{wallpaperAsset.mimeType.replace('image/', '').replace('video/', '').toUpperCase()} · {formatBytes(wallpaperAsset.size)}</span>}
              </div>
              {assetError !== null && <p className={css.error} role="alert">{t(assetError === 'too-large' ? 'basic.wallpaperTooLarge' : 'basic.wallpaperInvalid')}</p>}
              <div className={css.sliderGrid}>
                <Slider label={t('basic.wallpaperOpacity')} value={draft.appearance[mode].wallpaperOpacity} min={0} max={1} step={0.05} suffix="%" onChange={value => { updateDraft(next => { next.appearance[mode].wallpaperOpacity = value }) }} />
                <Slider label={t('basic.surfaceOpacity')} value={draft.appearance[mode].surfaceOpacity} min={0.2} max={1} step={0.05} suffix="%" onChange={value => { updateDraft(next => { next.appearance[mode].surfaceOpacity = value }) }} />
                <Slider label={t('basic.scrim')} value={draft.appearance[mode].scrimOpacity} min={0} max={1} step={0.05} suffix="%" onChange={value => { updateDraft(next => { next.appearance[mode].scrimOpacity = value }) }} />
                <Slider label={t('basic.blur')} value={draft.appearance.wallpaperBlurPx} min={0} max={40} step={1} suffix="px" onChange={value => { updateDraft(next => { next.appearance.wallpaperBlurPx = value }) }} />
              </div>
            </div>
            <div className={css.editorSection}>
              <h3>{t('basic.fonts')}</h3>
              <div className={css.assetGrid}>
                {([['ui-font', 'uiFont', uiFontRef], ['code-font', 'codeFont', codeFontRef]] as const).map(([kind, slot, ref]) => (
                  <div className={css.fontItem} key={kind}>
                    <strong>{t(`basic.${slot}`)}</strong><span>{draft.appearance[slot].kind === 'asset' ? draft.appearance[slot].family : t('basic.fontRemove')}</span>
                    <input ref={ref} hidden type="file" accept="font/woff2,.woff2" onChange={event => { void pickAsset(event.target.files?.[0], kind); event.target.value = '' }} />
                    <div><Button size="sm" variant="outline" onClick={() => { ref.current?.click() }}>{t('basic.fontUpload')}</Button>{draft.appearance[slot].kind === 'asset' && <Button size="sm" onClick={() => { removeAsset(kind) }}>{t('basic.fontRemove')}</Button>}</div>
                  </div>
                ))}
              </div>
            </div>
            {contrastWarning}
          </section>
        )}

        {tab === 'advanced' && draft !== null && (
          <section id="skin-studio-panel-advanced" role="tabpanel" aria-labelledby="skin-studio-tab-advanced" className={css.page}>
            <p className={css.explainer}>{t('advanced.description')}</p>
            <div className={css.advancedToolbar}>
              <div><span>{t('advanced.modeHint')}</span><div role="group" className={css.segmented}>{(['light', 'dark'] as const).map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => { setMode(item) }}>{t(`basic.mode.${item}`)}</button>)}</div></div>
              <div role="group" className={css.segmented}>{(['guided', 'all'] as const).map(item => <button key={item} type="button" aria-pressed={advancedView === item} onClick={() => { setAdvancedView(item) }}>{t(`advanced.view.${item}`)}</button>)}</div>
            </div>
            <section className={css.componentMediaSection} aria-labelledby="skin-studio-component-media-title">
              <div className={css.componentMediaIntro}>
                <div><h3 id="skin-studio-component-media-title">{t('componentMedia.title')}</h3><p>{t('componentMedia.description')}</p></div>
                <div className={css.componentMediaActions}>
                  <Button data-component-picker="app" size="sm" variant="primary" disabled={draft.appearance.componentMedia.length >= 64} onClick={() => { setPickSettingsComponent(false); setOpen(false); setPickingComponent(true) }}>{t('componentMedia.pickApp')}</Button>
                  <Button data-component-picker="settings" size="sm" variant="outline" disabled={draft.appearance.componentMedia.length >= 64} onClick={() => { setPickSettingsComponent(true); setOpen(false); setPickingComponent(true) }}>{t('componentMedia.pickSettings')}</Button>
                </div>
              </div>
              {assetError !== null && <p className={css.error} role="alert">{t(assetError === 'too-large' ? 'basic.wallpaperTooLarge' : 'basic.wallpaperInvalid')}</p>}
              {draft.appearance.componentMedia.length === 0 ? <p className={css.empty}>{t('componentMedia.empty')}</p> : <div className={css.componentMediaList}>{draft.appearance.componentMedia.map(renderComponentMediaRule)}</div>}
              {hasMediaReadabilityRisk && <div className={css.warningPanel} role="alert"><strong>{t('componentMedia.readabilityTitle')}</strong><p>{t('componentMedia.readabilityDescription')}</p><label><input type="checkbox" checked={mediaReadabilityConfirmed} onChange={event => { setMediaReadabilityConfirmed(event.target.checked) }} />{t('componentMedia.readabilityConfirm')}</label></div>}
            </section>
            {contrastWarning}
            {advancedView === 'guided' ? <div className={css.componentGroups}>{guidedGroups.map(group => <section className={css.tokenGroup} key={group.id}><h3>{t(`advanced.group.${group.id}`)}</h3><div className={css.tokenList}>{group.tokens.map(token => renderTokenEditor(token.name, token))}</div></section>)}{guidedGroups.length === 0 && <p className={css.empty}>{t('advanced.empty')}</p>}</div>
              : <><label className={css.searchLabel}><span>{t('advanced.searchLabel')}</span><input className={css.search} type="search" placeholder={t('advanced.search')} value={tokenSearch} onChange={event => { setTokenSearch(event.target.value) }} /></label><div className={css.tokenList}>{visibleTokens.length === 0 && <p className={css.empty}>{t('advanced.empty')}</p>}{visibleTokens.map(name => renderTokenEditor(name, friendlyTokens.get(name)))}</div></>}
          </section>
        )}

        {tab === 'assets' && draft !== null && (
          <section id="skin-studio-panel-assets" role="tabpanel" aria-labelledby="skin-studio-tab-assets" className={css.page}>
            <VisualAssetEditor
              draft={draft}
              assets={assets}
              locale={controller.activeLocale()}
              error={assetError}
              t={t}
              onPick={(slotId, file) => { void pickVisualAsset(slotId, file) }}
              onRemove={removeVisualAsset}
            />
          </section>
        )}

        {tab === 'copy' && draft !== null && (
          <section id="skin-studio-panel-copy" role="tabpanel" aria-labelledby="skin-studio-tab-copy" className={css.page}>
            <CopyOverrideEditor
              draft={draft}
              locale={controller.activeLocale()}
              t={t}
              onChange={updateCopyOverride}
              onReset={slotId => { updateDraft(next => { delete next.copyOverrides[slotId] }) }}
            />
          </section>
        )}

        {tab === 'package' && (
          <section id="skin-studio-panel-package" role="tabpanel" aria-labelledby="skin-studio-tab-package" className={css.page}>
            <div className={css.packageBlock}>
              <h3>{t('package.import')}</h3><p>{t('package.importHint')}</p>
              <label className={css.selectLabel}><span>{t('package.conflict')}</span><select value={conflictPolicy} onChange={event => { setConflictPolicy(event.target.value as ConflictPolicy) }}><option value="keep">{t('package.keep')}</option><option value="replace">{t('package.replace')}</option><option value="cancel">{t('package.cancel')}</option></select></label>
              <input ref={importRef} hidden type="file" accept=".dshskin,application/zip" onChange={event => { void doImport(event) }} />
              <Button variant="outline" onClick={() => { importRef.current?.click() }}>{t('package.choose')}</Button>
              {packageStatus === 'success' && <p className={css.success} role="status">{t('package.success')}</p>}
              {packageStatus === 'error' && <p className={css.error} role="alert">{t('package.error')}</p>}
            </div>
            <div className={css.packageBlock}>
              <h3>{t('package.export')}</h3><p>{selected?.name ?? t('package.noSelection')}</p>
              <label className={css.checkLabel}><input type="checkbox" checked={rightsConfirmed} onChange={event => { setRightsConfirmed(event.target.checked) }} />{t('package.rights')}</label>
              <Button variant="primary" disabled={selectedId === null || !rightsConfirmed} onClick={() => { void doExport() }}>{t('package.export')}</Button>
            </div>
          </section>
        )}
        </div>
      </Modal>
    </div>
  )
}
