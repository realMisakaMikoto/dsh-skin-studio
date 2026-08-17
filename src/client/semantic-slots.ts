import {
  COPY_SLOT_IDS, COPY_SLOTS, VISUAL_ASSET_SLOT_IDS,
  type CopySlotId, type SkinLocale, type VisualAssetSlotId,
} from '../skin-slots.ts'

export type CopyTargetProperty = 'text' | 'placeholder' | 'aria-label'
export interface CopySlotTarget {
  element: HTMLElement
  property: CopyTargetProperty
}

export function defaultCopyValue(id: CopySlotId, locale: SkinLocale, property: CopyTargetProperty): string {
  if (id === 'sidebar.new-session' && property === 'aria-label') return locale === 'zh' ? '新建会话' : 'New session'
  return COPY_SLOTS.find(slot => slot.id === id)!.original[locale]
}

const PLUGIN_UI = '[data-dsh-skin-studio-ui]'
const COPY_MARKER = 'data-dsh-skin-studio-copy-slot'

function elements<E extends Element>(root: ParentNode, selector: string): E[] {
  return [...root.querySelectorAll<E>(selector)].filter(element => element.closest(PLUGIN_UI) === null)
}

function isOriginalCopy(value: string | null | undefined, slotId: CopySlotId): boolean {
  if (value === null || value === undefined) return false
  const slot = COPY_SLOTS.find(item => item.id === slotId)!
  return value === slot.original.zh || value === slot.original.en
}

function heroFishTargets(root: ParentNode): SVGElement[] {
  return elements<SVGElement>(root, 'svg[viewBox="0 0 23.16 17.04"]')
    .filter(svg => svg.getAttribute('width') === '34' || [...(svg.parentElement?.parentElement?.children ?? [])]
      .some(child => isOriginalCopy(child.textContent, 'welcome.title') || child.getAttribute(COPY_MARKER) === 'welcome.title'))
}

function heroHeadlineChild(root: ParentNode, index: number): HTMLElement | undefined {
  const headline = heroFishTargets(root)[0]?.parentElement?.parentElement
  const child = headline?.children[index]
  return child instanceof HTMLElement ? child : undefined
}

function isFolderSvg(svg: SVGElement): boolean {
  if (svg.getAttribute('viewBox') !== '0 0 16 16') return false
  const paths = [...svg.querySelectorAll('path')]
  return paths.some(path => path.getAttribute('d')?.startsWith('M5.19629 1.57104') === true
    || path.getAttribute('d')?.startsWith('M5.05582 0.518756') === true
    || path.getAttribute('transform') === 'translate(1.5 2.429)')
}

export function findVisualSlotTargets(id: VisualAssetSlotId, root: ParentNode = document): Element[] {
  switch (id) {
    case 'hero-whale-logo': return heroFishTargets(root)
    case 'hero-backdrop-illustration': return elements(root, 'svg[viewBox="0 0 1051 468"]')
    case 'sidebar-brand-wordmark': return elements(root, 'svg[viewBox="0 0 182 24"]')
    case 'workspace-folder-icon': return elements<SVGElement>(root, 'svg[viewBox="0 0 16 16"]')
      .filter(svg => isFolderSvg(svg) && (svg.closest('[role="treeitem"]') !== null || svg.closest('button[aria-haspopup="menu"]') !== null))
  }
}

function directTextChild(button: HTMLElement, slotId: CopySlotId): HTMLElement | undefined {
  return [...button.children].find(child => child instanceof HTMLElement
    && (isOriginalCopy(child.textContent, slotId) || child.getAttribute(COPY_MARKER) === slotId)) as HTMLElement | undefined
}

export function findCopySlotTargets(id: CopySlotId, root: ParentNode = document): CopySlotTarget[] {
  switch (id) {
    case 'welcome.title': {
      const element = heroHeadlineChild(root, 1)
      return element === undefined ? [] : [{ element, property: 'text' }]
    }
    case 'welcome.badge': {
      const element = heroHeadlineChild(root, 2)
      return element === undefined ? [] : [{ element, property: 'text' }]
    }
    case 'composer.welcome-placeholder': {
      if (heroFishTargets(root).length === 0) return []
      const target = elements<HTMLTextAreaElement>(root, 'textarea').find(element =>
        isOriginalCopy(element.placeholder, id) || element.getAttribute(COPY_MARKER) === id)
      return target === undefined ? [] : [{ element: target, property: 'placeholder' }]
    }
    case 'workspace.choose': {
      const button = elements<HTMLButtonElement>(root, 'button[aria-haspopup="menu"]').find(element =>
        isOriginalCopy(element.getAttribute('aria-label'), id) || element.getAttribute(COPY_MARKER) === id)
      if (button === undefined) return []
      const text = directTextChild(button, id)
      return [
        ...(text === undefined ? [] : [{ element: text, property: 'text' as const }]),
        { element: button, property: 'aria-label' as const },
      ]
    }
    case 'sidebar.new-session': {
      const button = elements<HTMLButtonElement>(root, 'button').find(element => directTextChild(element, id) !== undefined)
      if (button === undefined) return []
      return [
        { element: directTextChild(button, id)!, property: 'text' },
        { element: button, property: 'aria-label' },
      ]
    }
    case 'settings.title': {
      for (const dialog of elements<HTMLElement>(root, '[role="dialog"]')) {
        const labelledBy = dialog.getAttribute('aria-labelledby')
        const heading = labelledBy === null ? undefined : document.getElementById(labelledBy)
        if (heading instanceof HTMLElement
          && (isOriginalCopy(heading.textContent, id) || heading.getAttribute(COPY_MARKER) === id)) {
          return [{ element: heading, property: 'text' }]
        }
      }
      return []
    }
  }
}

export interface SemanticSlotAvailability {
  visual: Record<VisualAssetSlotId, boolean>
  copy: Record<CopySlotId, boolean>
}

export function inspectSemanticSlotAvailability(root: ParentNode = document): SemanticSlotAvailability {
  return {
    visual: Object.fromEntries(VISUAL_ASSET_SLOT_IDS.map(id => [id, findVisualSlotTargets(id, root).length > 0])) as Record<VisualAssetSlotId, boolean>,
    copy: Object.fromEntries(COPY_SLOT_IDS.map(id => [id, findCopySlotTargets(id, root).length > 0])) as Record<CopySlotId, boolean>,
  }
}
