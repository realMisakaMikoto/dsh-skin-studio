import {
  MAX_TEXT_OVERRIDE_PATH_DEPTH,
  type ComponentTarget, type TextOverrideTarget, type TextTargetPathSegment,
} from '../model.ts'
import { createComponentTarget, findPickableComponent } from './component-picker.ts'
import { isFolderSvg } from './semantic-slots.ts'

const PLUGIN_UI = '[data-dsh-skin-studio-ui]'
const INTERACTIVE = 'button, a, [role="button"], [role="menuitem"], [role="tab"], [role="treeitem"]'
const SETTINGS_LABELS = new Set(['settings', 'setting', 'preferences', '设置', '偏好设置'])
const WORKSPACE_PROMPTS = new Set(['choose workspace', '选择工作区'])

export type TextExclusionReason = 'session-name' | 'project-name' | 'chat-content' | 'settings'

export interface ResolvedTextTarget {
  element: HTMLElement
  property: 'text' | 'placeholder'
  textNode?: Text
}

export interface TextPickCandidate extends ResolvedTextTarget {
  sample: string
  target: TextOverrideTarget
  exclusion: TextExclusionReason | null
}

function normalized(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
}

function isSettingsEntry(element: HTMLElement): boolean {
  const control = element.closest<HTMLElement>(INTERACTIVE)
  if (control === null) return false
  const labels = [control.getAttribute('aria-label'), control.getAttribute('title'), control.textContent]
  if (labels.some(value => SETTINGS_LABELS.has(normalized(value)))) return true
  const structural = [
    control.id,
    control.getAttribute('href'),
    control.getAttribute('aria-controls'),
    control.getAttribute('data-testid'),
  ].filter((value): value is string => value !== null)
  return structural.some(value => /(?:^|[-_/#])settings?(?:$|[-_/?#])/i.test(value))
}

function isSettingsDialog(element: HTMLElement): boolean {
  const dialog = element.closest<HTMLElement>('[role="dialog"]')
  if (dialog === null) return false
  const labelledBy = dialog.getAttribute('aria-labelledby')
  const heading = labelledBy === null ? null : dialog.ownerDocument.getElementById(labelledBy)
  const labels = [dialog.getAttribute('aria-label'), dialog.getAttribute('title'), heading?.textContent]
  if (labels.some(value => SETTINGS_LABELS.has(normalized(value)))) return true
  const structural = [dialog.id, dialog.getAttribute('data-testid'), ...dialog.classList]
  return structural.some(value => /(?:^|[-_])settings?(?:$|[-_])/i.test(value ?? ''))
}

function isWorkspaceName(element: HTMLElement): boolean {
  const button = element.closest<HTMLButtonElement>('button[aria-haspopup="menu"]')
  if (button === null) return false
  const folder = [...button.querySelectorAll<SVGElement>('svg[viewBox="0 0 16 16"]')].some(isFolderSvg)
  if (!folder) return false
  const fixedMarker = button.getAttribute('data-dsh-skin-studio-copy-slot') === 'workspace.choose'
    || button.querySelector('[data-dsh-skin-studio-copy-slot="workspace.choose"]') !== null
  if (fixedMarker) return false
  return !WORKSPACE_PROMPTS.has(normalized(button.getAttribute('aria-label')))
    && !WORKSPACE_PROMPTS.has(normalized(button.textContent))
}

export function textExclusionReason(element: HTMLElement): TextExclusionReason | null {
  if (element.closest(PLUGIN_UI) !== null) return 'settings'
  if (isSettingsDialog(element) || isSettingsEntry(element)) return 'settings'
  if (element.closest('[data-chat-flow-kind]') !== null) return 'chat-content'
  if (element.closest('[role="treeitem"][aria-expanded]') !== null) return 'project-name'
  if (isWorkspaceName(element)) return 'project-name'
  if (element.closest('[role="treeitem"][aria-selected]') !== null) return 'session-name'
  const header = element.closest('header')
  if (header !== null && element.closest('nav, [role="navigation"], [aria-label*="breadcrumb" i]') !== null) return 'session-name'
  return null
}

// Upstream builtins were authored against the web build. The desktop build
// uses different CSS module hashes, including several unrelated "root" and
// "trigger" components, so these known seats need an explicit mapping.
const DESKTOP_CLASS_ALIASES: Readonly<Record<string, string>> = {
  pXSMma_previewBadge: 'Hqq-bq_previewBadge',
  pXSMma_workspace: 'Hqq-bq_workspace',
  cubgiG_seat: '_oGoKq_seat',
  Sh0Q9G_trigger: '_2WTFBq_trigger',
  _7KE1Ra_trigger: 'wq12jW_trigger',
  uV2eYG_primary: 'RlGAzG_primary',
  uV2eYG_card: 'RlGAzG_card',
  'hHd-Xa_root': '_2H3hWW_root',
  qDHVXG_sectionLabel: '_9lTDKa_sectionLabel',
  qDHVXG_wide: '_9lTDKa_wide',
}

function matchesClass(element: HTMLElement, name: string): boolean {
  if (element.classList.contains(name)) return true
  const alias = DESKTOP_CLASS_ALIASES[name]
  if (alias !== undefined) return element.classList.contains(alias)
  // Legacy desktop rules sometimes stored only the module's local class.
  return !/^_?[a-z0-9-]{6}_/i.test(name)
    && [...element.classList].some(value => value.replace(/^_?[a-z0-9-]{6}_/i, '') === name)
}

export function matchesComponentTarget(element: Element, target: ComponentTarget): element is HTMLElement {
  return element instanceof HTMLElement
    && element.tagName.toLowerCase() === target.tagName
    && (target.role === null || element.getAttribute('role') === target.role)
    && target.classNames.every(className => matchesClass(element, className))
}

function hostNodes(element: Element): ChildNode[] {
  return [...element.childNodes].filter(node => !(node instanceof Element)
    || !node.matches('[data-dsh-skin-studio-component-layer], [data-dsh-skin-studio-visual-slot]'))
}

function hostChildren(element: Element): Element[] {
  return hostNodes(element).filter((node): node is Element => node instanceof Element)
}

function pathFrom(anchor: HTMLElement, endpoint: HTMLElement): TextTargetPathSegment[] | undefined {
  const elements: HTMLElement[] = []
  for (let current: HTMLElement | null = endpoint; current !== anchor; current = current.parentElement) {
    if (current === null) return undefined
    elements.push(current)
  }
  elements.reverse()
  if (elements.length > MAX_TEXT_OVERRIDE_PATH_DEPTH) return undefined
  const path: TextTargetPathSegment[] = []
  let parent = anchor
  for (const element of elements) {
    const childIndex = hostChildren(parent).indexOf(element)
    if (childIndex < 0 || childIndex > 255) return undefined
    path.push({ ...createComponentTarget(element), childIndex })
    parent = element
  }
  return path
}

function createTarget(element: HTMLElement, property: 'text', textNode: Text, root: HTMLElement): TextOverrideTarget | undefined
function createTarget(element: HTMLElement, property: 'placeholder', textNode: undefined, root: HTMLElement): TextOverrideTarget | undefined
function createTarget(element: HTMLElement, property: 'text' | 'placeholder', textNode: Text | undefined, root: HTMLElement): TextOverrideTarget | undefined {
  let anchor = findPickableComponent(element, root)
  if (anchor === undefined || !anchor.contains(element)) anchor = element
  let path = pathFrom(anchor, element)
  if (path === undefined) {
    anchor = element
    path = []
  }
  const base = { anchor: createComponentTarget(anchor), path }
  if (property === 'placeholder') return { ...base, property }
  const textNodeIndex = hostNodes(element).indexOf(textNode!)
  if (textNodeIndex < 0 || textNodeIndex > 255) return undefined
  return { ...base, property, textNodeIndex }
}

function textNodeAtPoint(origin: Element, x: number, y: number): Text | undefined {
  const doc = origin.ownerDocument
  const pointDocument = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const position = pointDocument.caretPositionFromPoint?.(x, y)
  const range = position === undefined ? pointDocument.caretRangeFromPoint?.(x, y) : undefined
  const node = position?.offsetNode ?? range?.startContainer
  return node?.nodeType === Node.TEXT_NODE && origin.contains(node) ? node as Text : undefined
}

function firstTextNode(origin: Element): Text | undefined {
  const walker = origin.ownerDocument.createTreeWalker(origin, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Text && node.data.trim() !== '' && node.parentElement instanceof HTMLElement) return node
  }
  return undefined
}

function candidateFromTextNode(node: Text, root: HTMLElement): TextPickCandidate | undefined {
  const element = node.parentElement
  if (!(element instanceof HTMLElement) || !root.contains(element) || node.data.trim() === '') return undefined
  if (element.closest(PLUGIN_UI) !== null || element.closest('[contenteditable]:not([contenteditable="false"])') !== null) return undefined
  const target = createTarget(element, 'text', node, root)
  return target === undefined ? undefined : {
    element,
    property: 'text',
    textNode: node,
    sample: node.data.trim(),
    target,
    exclusion: textExclusionReason(element),
  }
}

export function createTextPickCandidate(
  origin: Element | null,
  root: HTMLElement,
  point?: { x: number; y: number },
): TextPickCandidate | undefined {
  let htmlOrigin: Element | null = origin
  while (htmlOrigin !== null && !(htmlOrigin instanceof HTMLElement)) htmlOrigin = htmlOrigin.parentElement
  if (!(htmlOrigin instanceof HTMLElement) || !root.contains(htmlOrigin) || htmlOrigin.closest(PLUGIN_UI) !== null) return undefined
  if ((htmlOrigin instanceof HTMLInputElement || htmlOrigin instanceof HTMLTextAreaElement) && htmlOrigin.placeholder.trim() !== '') {
    const target = createTarget(htmlOrigin, 'placeholder', undefined, root)
    return target === undefined ? undefined : {
      element: htmlOrigin,
      property: 'placeholder',
      sample: htmlOrigin.placeholder.trim(),
      target,
      exclusion: textExclusionReason(htmlOrigin),
    }
  }
  if (htmlOrigin.closest('[contenteditable]:not([contenteditable="false"])') !== null) return undefined
  const node = point === undefined ? firstTextNode(htmlOrigin) : textNodeAtPoint(htmlOrigin, point.x, point.y) ?? firstTextNode(htmlOrigin)
  return node === undefined ? undefined : candidateFromTextNode(node, root)
}

export function listTextPickCandidates(root: HTMLElement): TextPickCandidate[] {
  const candidates: TextPickCandidate[] = []
  for (const input of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder], textarea[placeholder]')) {
    const candidate = createTextPickCandidate(input, root)
    if (candidate !== undefined) candidates.push(candidate)
  }
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node instanceof Text)) continue
    const candidate = candidateFromTextNode(node, root)
    if (candidate !== undefined) candidates.push(candidate)
  }
  return candidates
}

export function textPickCandidateRect(candidate: TextPickCandidate): DOMRect {
  if (candidate.property === 'placeholder' || candidate.textNode === undefined) return candidate.element.getBoundingClientRect()
  const range = candidate.element.ownerDocument.createRange()
  range.selectNodeContents(candidate.textNode)
  const rect = (range as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect?.()
  if (rect === undefined) return candidate.element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? rect : candidate.element.getBoundingClientRect()
}

export function findTextOverrideTargets(target: TextOverrideTarget, root: ParentNode = document): ResolvedTextTarget[] {
  const resolved: ResolvedTextTarget[] = []
  for (const candidate of root.querySelectorAll(target.anchor.tagName)) {
    if (!matchesComponentTarget(candidate, target.anchor) || candidate.closest(PLUGIN_UI) !== null) continue
    let endpoint: HTMLElement = candidate
    let valid = true
    for (const segment of target.path) {
      const child = hostChildren(endpoint)[segment.childIndex]
      if (child === undefined || !matchesComponentTarget(child, segment)) { valid = false; break }
      endpoint = child
    }
    if (!valid || textExclusionReason(endpoint) !== null) continue
    if (target.property === 'placeholder') {
      if (endpoint instanceof HTMLInputElement || endpoint instanceof HTMLTextAreaElement) {
        resolved.push({ element: endpoint, property: 'placeholder' })
      }
      continue
    }
    const node = hostNodes(endpoint)[target.textNodeIndex]
    if (node instanceof Text && endpoint.closest('[contenteditable]:not([contenteditable="false"])') === null) {
      resolved.push({ element: endpoint, property: 'text', textNode: node })
    }
  }
  return resolved
}
