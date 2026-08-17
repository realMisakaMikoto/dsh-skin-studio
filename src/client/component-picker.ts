import type { ComponentTarget } from '../model.ts'

const NON_CONTAINER_TAGS = new Set([
  'area', 'base', 'br', 'canvas', 'embed', 'hr', 'iframe', 'img', 'input', 'link', 'meta',
  'object', 'option', 'path', 'select', 'source', 'svg', 'textarea', 'track', 'video', 'wbr',
])
const INTERACTIVE_SELECTOR = 'button, a, [role="button"], [role="tab"], [role="treeitem"], [role="menuitem"], [role="option"]'
const STATE_CLASS = /(?:^|[_-])(active|checked|collapsed|disabled|expanded|focus|hover|loading|open|pressed|selected)(?:$|[_-])/i
const SAFE_CLASS = /^[a-z0-9_-]{1,96}$/i
const COMPONENT_BOUNDARY_CLASS = /(?:^|_)(card|composer|container|input|panel|root|shell|surface|wrapper)$/i

function stableClasses(element: HTMLElement): string[] {
  return [...element.classList]
    .filter(name => SAFE_CLASS.test(name) && !STATE_CLASS.test(name) && !name.startsWith('dsh-skin-studio'))
    .slice(0, 4)
}

function targetFor(element: HTMLElement): ComponentTarget {
  const role = element.getAttribute('role')
  return {
    tagName: element.tagName.toLowerCase(),
    role: role !== null && /^[a-z][a-z0-9-]{0,31}$/.test(role) ? role : null,
    classNames: stableClasses(element),
  }
}

function canIdentify(element: HTMLElement): boolean {
  const target = targetFor(element)
  return target.classNames.length > 0 || target.role !== null || ['button', 'a', 'nav', 'aside', 'main', 'section', 'article', 'header', 'footer', 'form', 'pre', 'code'].includes(target.tagName)
}

export function findPickableComponent(origin: Element | null, root: HTMLElement): HTMLElement | undefined {
  if (!(origin instanceof HTMLElement) || !root.contains(origin)) return undefined
  const interactive = origin.closest<HTMLElement>(INTERACTIVE_SELECTOR)
  if (interactive !== null && root.contains(interactive) && !NON_CONTAINER_TAGS.has(interactive.tagName.toLowerCase())) return interactive
  const originCannotHost = NON_CONTAINER_TAGS.has(origin.tagName.toLowerCase())
  const originRect = origin.getBoundingClientRect()
  let fallback: HTMLElement | undefined
  for (let element: HTMLElement | null = origin; element !== null && element !== root; element = element.parentElement) {
    if (NON_CONTAINER_TAGS.has(element.tagName.toLowerCase()) || !canIdentify(element)) continue
    if (!originCannotHost) return element
    fallback ??= element
    const rect = element.getBoundingClientRect()
    const isBoundary = stableClasses(element).some(name => COMPONENT_BOUNDARY_CLASS.test(name.slice(name.lastIndexOf('_'))))
    const expandsControl = rect.width > originRect.width + 8 || rect.height > originRect.height + 8
    if (isBoundary || expandsControl) return element
  }
  return fallback
}

export function createComponentTarget(element: HTMLElement): ComponentTarget {
  return targetFor(element)
}

export function describeComponentTarget(target: ComponentTarget): string {
  const className = target.classNames[0]
  const raw = className?.includes('_') === true ? className.slice(className.lastIndexOf('_') + 1) : className
  const words = raw?.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('-', ' ').trim()
  return words === undefined || words === '' ? target.role ?? target.tagName : words
}
