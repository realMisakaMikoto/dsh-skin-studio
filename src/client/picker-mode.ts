export type PickerMode = 'select' | 'interact'

export interface PickerOverlayCopy {
  initialHint: string
  modeLabel: string
  selectMode: string
  interactMode: string
  shortcut: string
}

export interface PickerOverlay {
  element: HTMLDivElement
  status: HTMLDivElement
  mode: () => PickerMode
  modeFromTarget: (target: EventTarget | null) => PickerMode | undefined
  setMode: (mode: PickerMode) => void
  toggleMode: () => PickerMode
}

export function createPickerOverlay(copy: PickerOverlayCopy): PickerOverlay {
  const element = document.createElement('div')
  element.dataset.dshSkinStudioUi = ''
  Object.assign(element.style, {
    position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: '2147483647',
    boxSizing: 'border-box', width: 'max-content', maxWidth: 'min(720px, calc(100vw - 24px))', padding: '10px 12px',
    border: '1px solid rgba(255,255,255,.18)', borderRadius: '12px', background: '#111827', color: '#ffffff',
    font: '600 14px/1.4 system-ui, sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,.28)',
  })
  const status = document.createElement('div')
  status.textContent = copy.initialHint
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.setAttribute('aria-atomic', 'true')
  status.style.overflowWrap = 'anywhere'
  const controls = document.createElement('div')
  controls.setAttribute('role', 'toolbar')
  controls.setAttribute('aria-label', copy.modeLabel)
  Object.assign(controls.style, { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '8px' })
  const buttons = new Map<PickerMode, HTMLButtonElement>()
  for (const [mode, label] of [['select', copy.selectMode], ['interact', copy.interactMode]] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.dshSkinStudioPickerMode = mode
    button.textContent = label
    button.setAttribute('aria-pressed', String(mode === 'select'))
    Object.assign(button.style, {
      minHeight: '32px', padding: '5px 10px', border: '1px solid rgba(255,255,255,.34)', borderRadius: '8px',
      background: mode === 'select' ? '#ffffff' : 'transparent', color: mode === 'select' ? '#111827' : '#ffffff',
      font: '600 13px/1.2 system-ui, sans-serif', cursor: 'pointer',
    })
    buttons.set(mode, button)
    controls.append(button)
  }
  const shortcut = document.createElement('span')
  shortcut.textContent = copy.shortcut
  Object.assign(shortcut.style, { marginInlineStart: '2px', color: '#cbd5e1', font: '500 12px/1.3 system-ui, sans-serif' })
  controls.append(shortcut)
  element.append(status, controls)
  let current: PickerMode = 'select'
  const setMode = (mode: PickerMode): void => {
    current = mode
    for (const [candidate, button] of buttons) {
      const active = candidate === mode
      button.setAttribute('aria-pressed', String(active))
      button.style.background = active ? '#ffffff' : 'transparent'
      button.style.color = active ? '#111827' : '#ffffff'
    }
  }
  return {
    element,
    status,
    mode: () => current,
    modeFromTarget: target => target instanceof Element
      ? target.closest<HTMLElement>('[data-dsh-skin-studio-picker-mode]')?.dataset.dshSkinStudioPickerMode as PickerMode | undefined
      : undefined,
    setMode,
    toggleMode: () => {
      const next = current === 'select' ? 'interact' : 'select'
      setMode(next)
      return next
    },
  }
}
