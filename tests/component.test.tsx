import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { createBlankSkin } from '../src/presets.ts'
import { en, type SkinStudioKey } from '../src/client/locales.ts'
import { SkinStudioRow, type SkinStudioRowProps } from '../src/client/SkinStudioRow.tsx'
import type { SkinStudioController } from '../src/client/controller.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, variant: _variant, size: _size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => <button type="button" {...props}>{children}</button>,
  DisclosureRow: ({ title, collapsedContent }: { title: string; collapsedContent?: ReactNode }) => <div><span>{title}</span>{collapsedContent}</div>,
  IconPersonalizationOutline16: () => <span />,
  Modal: ({ open, title, closeLabel, onClose, children, footer }: { open: boolean; title: string; closeLabel: string; onClose: () => void; children?: ReactNode; footer?: ReactNode }) => open ? <div role="dialog" aria-label={title}><button type="button" aria-label={closeLabel} onClick={onClose}>×</button>{children}{footer}</div> : null,
}))

function controller(): SkinStudioController {
  return {
    create: () => createBlankSkin('Untitled skin'),
    duplicate: vi.fn(), remove: vi.fn(), preview: vi.fn(), cancelPreview: vi.fn(),
    saveAndActivate: vi.fn(), activate: vi.fn(), assets: vi.fn(async () => new Map()),
    importPackage: vi.fn(async (): Promise<'imported'> => 'imported'), exportPackage: vi.fn(),
    tokenNames: [
      '--dsw-alias-bg-base', '--dsw-specific-input-major', '--dsw-alias-button-primary-fill',
      '--dsw-specific-sidebar-fill', '--dsw-specific-bubble', '--dsw-alias-border-l2',
      '--dsw-alias-state-success-primary',
    ], activeLocale: () => 'en', connectActions: vi.fn(),
  }
}

describe('SkinStudioRow', () => {
  it('opens the studio and starts a new editable skin', async () => {
    const skin = createBlankSkin('Active skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    expect(screen.getByText('Active skin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    expect(screen.getByRole('dialog', { name: 'Skin Studio' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New skin' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Untitled skin')
    expect(screen.getByText('Semantic colors')).toBeInTheDocument()
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Basic editor' })).toHaveFocus() })
  })

  it('restores DSH defaults from the library', () => {
    const api = controller()
    const state = { skins: [], activeId: null, ready: true, persistent: true, revision: 1 }
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore DSH defaults' }))
    expect(api.activate).toHaveBeenCalledWith(null)
  })

  it('keeps editor tabs unavailable until a draft is selected', () => {
    const state = { skins: [], activeId: null, ready: true, persistent: true, revision: 1 }
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    expect(screen.getByRole('tab', { name: 'Basic editor' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'GUI components' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Visual assets' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Copy' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Import & export' })).toBeEnabled()
  })

  it('keeps visual asset and copy overrides in dedicated editor pages', async () => {
    const skin = createBlankSkin('Semantic skin')
    const api = controller()
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Visual assets' }))
    expect(screen.getByRole('heading', { name: 'Built-in visual assets' })).toBeInTheDocument()
    expect(screen.getByText('Empty-state whale mark')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Single logo' })).toBeDisabled()
    expect(screen.getAllByText('Unavailable in this DSH view').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: 'Copy' }))
    expect(screen.getByRole('heading', { name: 'Interface copy' })).toBeInTheDocument()
    expect(screen.getByText('Welcome title')).toBeInTheDocument()
    expect(screen.queryByText('Settings title')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Free text' })).toBeInTheDocument()
    const english = screen.getByLabelText('Welcome title English override')
    fireEvent.change(english, { target: { value: 'Build with Miku today' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(api.saveAndActivate).toHaveBeenCalledOnce() })
    expect(vi.mocked(api.saveAndActivate).mock.calls[0]?.[0].copyOverrides['welcome.title']?.en).toBe('Build with Miku today')
  })

  it('creates one bilingual free-text rule with keyboard picking and focuses duplicates', async () => {
    const skin = createBlankSkin('Text picker skin')
    const api = controller()
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const root = document.createElement('div')
    root.id = 'root'
    const target = document.createElement('button')
    target.className = 'abc_text_action'
    target.textContent = 'Outside label'
    target.getBoundingClientRect = () => ({ x: 20, y: 20, width: 120, height: 28, top: 20, left: 20, right: 140, bottom: 48, toJSON: () => ({}) }) as DOMRect
    const mount = document.createElement('div')
    root.append(target, mount)
    document.body.append(root)
    try {
      render(<SkinStudioRow {...({
        t: (key: SkinStudioKey) => en[key],
        useStore: (select: (value: typeof state) => unknown) => select(state),
        controller: api,
      } as unknown as SkinStudioRowProps)} />, { container: mount })
      fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Copy' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pick interface text' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      fireEvent.keyDown(target, { key: 'ArrowRight' })
      fireEvent.keyDown(target, { key: 'Enter' })
      const chinese = await screen.findByLabelText('Outside label Chinese override')
      await waitFor(() => { expect(chinese).toHaveFocus() })
      fireEvent.change(chinese, { target: { value: '外部操作' } })
      fireEvent.change(screen.getByLabelText('Outside label English override'), { target: { value: 'Outside action' } })
      await waitFor(() => {
        expect(vi.mocked(api.preview).mock.calls.some(call => call[0].textOverrides[0]?.replacements.en === 'Outside action')).toBe(true)
      })

      fireEvent.click(screen.getByRole('button', { name: 'Pick interface text' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      fireEvent.keyDown(target, { key: ' ' })
      await waitFor(() => { expect(screen.getByLabelText('Outside label Chinese override')).toHaveFocus() })
      expect(screen.getAllByRole('button', { name: 'Delete rule' })).toHaveLength(1)

      fireEvent.click(screen.getByRole('button', { name: 'Pick interface text' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      fireEvent.keyDown(target, { key: 'Escape' })
      await waitFor(() => { expect(screen.getByRole('button', { name: 'Pick interface text' })).toHaveFocus() })

      fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
      await waitFor(() => { expect(api.saveAndActivate).toHaveBeenCalledOnce() })
      const saved = vi.mocked(api.saveAndActivate).mock.calls[0]?.[0]
      expect(saved?.textOverrides).toHaveLength(1)
      expect(saved?.textOverrides[0]?.replacements).toEqual({ zh: '外部操作', en: 'Outside action' })
    } finally {
      root.remove()
    }
  })

  it('routes a picked stable Copy Slot back to its fixed editor without creating a free rule', async () => {
    const skin = createBlankSkin('Fixed copy picker skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const root = document.createElement('div')
    root.id = 'root'
    const target = document.createElement('button')
    target.setAttribute('aria-label', 'New session')
    target.innerHTML = '<svg></svg><span>New Session</span>'
    target.getBoundingClientRect = () => ({ x: 20, y: 20, width: 140, height: 32, top: 20, left: 20, right: 160, bottom: 52, toJSON: () => ({}) }) as DOMRect
    target.querySelector<HTMLElement>('span')!.getBoundingClientRect = target.getBoundingClientRect
    const mount = document.createElement('div')
    root.append(target, mount)
    document.body.append(root)
    try {
      render(<SkinStudioRow {...({
        t: (key: SkinStudioKey) => en[key],
        useStore: (select: (value: typeof state) => unknown) => select(state),
        controller: controller(),
      } as unknown as SkinStudioRowProps)} />, { container: mount })
      fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Copy' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pick interface text' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      fireEvent.keyDown(target, { key: 'Enter' })
      await waitFor(() => { expect(screen.getByLabelText('Sidebar new-session label Chinese override')).toHaveFocus() })
      expect(screen.queryByRole('button', { name: 'Delete rule' })).not.toBeInTheDocument()
    } finally {
      root.remove()
    }
  })

  it('keeps the text picker open with a reason when chat copy is selected', async () => {
    const skin = createBlankSkin('Blocked picker skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const root = document.createElement('div')
    root.id = 'root'
    const chat = document.createElement('div')
    chat.dataset.chatFlowKind = 'assistant'
    const target = document.createElement('button')
    target.textContent = 'Model retry'
    target.getBoundingClientRect = () => ({ x: 20, y: 20, width: 120, height: 32, top: 20, left: 20, right: 140, bottom: 52, toJSON: () => ({}) }) as DOMRect
    const mount = document.createElement('div')
    chat.append(target); root.append(chat, mount); document.body.append(root)
    try {
      render(<SkinStudioRow {...({
        t: (key: SkinStudioKey) => en[key],
        useStore: (select: (value: typeof state) => unknown) => select(state),
        controller: controller(),
      } as unknown as SkinStudioRowProps)} />, { container: mount })
      fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Copy' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pick interface text' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      expect(screen.getByRole('status')).toHaveTextContent('Chat history is not skin copy')
      fireEvent.keyDown(target, { key: 'Enter' })
      expect(screen.queryByRole('dialog', { name: 'Skin Studio' })).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Chat history is not skin copy')
      fireEvent.keyDown(target, { key: 'Escape' })
      await waitFor(() => { expect(screen.getByRole('dialog', { name: 'Skin Studio' })).toBeInTheDocument() })
    } finally {
      root.remove()
    }
  })

  it('reveals transient text in interaction mode before selecting it', async () => {
    const skin = createBlankSkin('Interactive text picker skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const root = document.createElement('div')
    root.id = 'root'
    const opener = document.createElement('button')
    opener.textContent = 'Open actions'
    opener.getBoundingClientRect = () => ({ x: 20, y: 20, width: 120, height: 32, top: 20, left: 20, right: 140, bottom: 52, toJSON: () => ({}) }) as DOMRect
    let revealed: HTMLButtonElement | undefined
    opener.addEventListener('click', () => {
      revealed = document.createElement('button')
      revealed.className = 'abc_revealed_text'
      revealed.textContent = 'Revealed action'
      revealed.getBoundingClientRect = () => ({ x: 20, y: 60, width: 140, height: 32, top: 60, left: 20, right: 160, bottom: 92, toJSON: () => ({}) }) as DOMRect
      document.body.append(revealed)
    })
    const mount = document.createElement('div')
    root.append(opener, mount); document.body.append(root)
    try {
      render(<SkinStudioRow {...({
        t: (key: SkinStudioKey) => en[key],
        useStore: (select: (value: typeof state) => unknown) => select(state),
        controller: controller(),
      } as unknown as SkinStudioRowProps)} />, { container: mount })
      fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Copy' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pick interface text' }))
      fireEvent.click(screen.getByRole('button', { name: 'Interact with interface' }))
      expect(screen.getByRole('button', { name: 'Interact with interface' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('status')).toHaveTextContent('Interact mode')
      fireEvent.click(opener)
      expect(revealed).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'Skin Studio' })).not.toBeInTheDocument()
      fireEvent.keyDown(opener, { key: 'F2' })
      expect(screen.getByRole('button', { name: 'Select target' })).toHaveAttribute('aria-pressed', 'true')
      expect(revealed).toBeInTheDocument()
      fireEvent.click(revealed!)
      await waitFor(() => { expect(screen.getByLabelText('Revealed action Chinese override')).toHaveFocus() })
    } finally {
      revealed?.remove()
      root.remove()
    }
  })

  it('saves the single-logo sidebar brand layout when a wordmark is configured', async () => {
    const skin = createBlankSkin('Single logo skin')
    skin.assets = [{ id: 'wordmark', path: 'assets/wordmark.png', kind: 'visual-asset', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.visualAssetOverrides['sidebar-brand-wordmark'] = 'wordmark'
    const api = controller()
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Visual assets' }))
    const single = screen.getByRole('button', { name: 'Single logo' })
    expect(single).toBeEnabled()
    fireEvent.click(single)
    expect(single).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(api.saveAndActivate).toHaveBeenCalledOnce() })
    expect(vi.mocked(api.saveAndActivate).mock.calls[0]?.[0].sidebarBrandLayout).toBe('single')
  })

  it('uploads a safe raster image into a visual asset slot', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:visual-upload')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer)
    const skin = createBlankSkin('Visual upload skin')
    const api = controller()
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Visual assets' }))
    const input = document.querySelector<HTMLInputElement>('input[data-visual-slot-upload="hero-whale-logo"]')!
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const png = new File([bytes], 'hero.png', { type: 'image/png' })
    Object.defineProperty(png, 'arrayBuffer', { value: async () => bytes.slice().buffer })
    fireEvent.change(input, { target: { files: [png] } })
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Restore this asset' })).toBeInTheDocument() })
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(api.saveAndActivate).toHaveBeenCalledOnce() })
    const saved = vi.mocked(api.saveAndActivate).mock.calls[0]?.[0]
    expect(saved?.visualAssetOverrides['hero-whale-logo']).toMatch(/^asset-/)
    expect(saved?.assets[0]?.kind).toBe('visual-asset')
  })

  it('asks before closing an unsaved new skin and restores focus after discarding', async () => {
    const api = controller()
    const state = { skins: [], activeId: null, ready: true, persistent: true, revision: 1 }
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    const opener = screen.getByRole('button', { name: 'Open Skin Studio' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name: 'New skin' }))
    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    fireEvent.click(close)
    expect(screen.getByRole('alert')).toHaveTextContent('You have unsaved changes')
    expect(screen.getByRole('dialog', { name: 'Skin Studio' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => { expect(close).toHaveFocus() })
    fireEvent.click(close)
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Skin Studio' })).not.toBeInTheDocument() })
    expect(api.cancelPreview).toHaveBeenCalled()
    await waitFor(() => { expect(opener).toHaveFocus() })
  })

  it('contains focus across package navigation and outside Tab attempts', async () => {
    const skin = createBlankSkin('Portable skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Package' }))
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Import & export' })).toHaveFocus() })
    document.body.tabIndex = -1
    document.body.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    document.body.removeAttribute('tabindex')
  })

  it('edits common GUI tokens, including inputs and borders', async () => {
    const skin = createBlankSkin('GUI skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'GUI components' }))
    expect(screen.getByRole('heading', { name: 'Inputs & interaction' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Borders & dividers' })).toBeInTheDocument()
    const inputRow = screen.getByText('Main input').closest('[class*="tokenRow"]')
    expect(inputRow).not.toBeNull()
    fireEvent.click(within(inputRow as HTMLElement).getByRole('button', { name: 'Customize' }))
    const hex = screen.getByLabelText('Main input Light hex value')
    fireEvent.change(hex, { target: { value: '#fefefe' } })
    fireEvent.blur(hex)
    expect(hex).toHaveValue('#fefefe')
  })

  it('offers image and video backgrounds with an interface veil control', async () => {
    const skin = createBlankSkin('Media skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(await screen.findByRole('button', { name: 'Choose image or video' })).toBeInTheDocument()
    expect(screen.getByLabelText('Interface veil')).toHaveValue('0.52')
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="video/mp4"]')
    expect(input?.accept).toContain('video/webm')
  })

  it('offers media backgrounds for an arbitrary picked component type', async () => {
    const skin = createBlankSkin('Component skin')
    skin.appearance.componentMedia.push({
      id: 'component-composer', name: 'composer',
      target: { tagName: 'div', role: null, classNames: ['abc_composer'] },
      assetId: null, blurPx: 0,
      light: { opacity: 1, scrimOpacity: 0.08 }, dark: { opacity: 0.9, scrimOpacity: 0.16 },
    })
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'GUI components' }))
    expect(screen.getByRole('heading', { name: 'Component media backgrounds' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick main interface' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick settings window' })).toBeInTheDocument()
    expect(screen.getByText('div.abc_composer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose image or video' })).toBeInTheDocument()
    expect(screen.getByText('Next: upload an image or video')).toBeInTheDocument()
    expect(screen.queryByLabelText('composer Media opacity')).not.toBeInTheDocument()
  })

  it('supports keyboard component picking and moves focus to the next upload action', async () => {
    const skin = createBlankSkin('Keyboard picker skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const root = document.createElement('div')
    root.id = 'root'
    const target = document.createElement('button')
    target.className = 'abc_target'
    target.textContent = 'Outside target'
    target.getBoundingClientRect = () => ({ x: 20, y: 20, width: 160, height: 48, top: 20, left: 20, right: 180, bottom: 68, toJSON: () => ({}) }) as DOMRect
    const mount = document.createElement('div')
    root.append(target, mount)
    document.body.append(root)
    try {
      render(<SkinStudioRow {...({
        t: (key: SkinStudioKey) => en[key],
        useStore: (select: (value: typeof state) => unknown) => select(state),
        controller: controller(),
      } as unknown as SkinStudioRowProps)} />, { container: mount })
      fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(await screen.findByRole('tab', { name: 'GUI components' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pick main interface' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      expect(screen.getByRole('status')).toHaveTextContent('target')
      fireEvent.keyDown(document, { key: 'Enter' })
      await waitFor(() => { expect(screen.getByRole('dialog', { name: 'Skin Studio' })).toBeInTheDocument() })
      expect(screen.getByText('button.abc_target')).toBeInTheDocument()
      expect(screen.getByText('Next: upload an image or video')).toBeInTheDocument()
      await waitFor(() => { expect(screen.getByRole('button', { name: 'Choose image or video' })).toHaveFocus() })
      fireEvent.click(screen.getByRole('button', { name: 'Pick main interface' }))
      await waitFor(() => { expect(target).toHaveFocus() })
      let escapedToHost = false
      const hostEscapeHandler = (): void => { escapedToHost = true }
      document.addEventListener('keydown', hostEscapeHandler)
      fireEvent.keyDown(target, { key: 'Escape' })
      document.removeEventListener('keydown', hostEscapeHandler)
      expect(escapedToHost).toBe(false)
      await waitFor(() => { expect(screen.getByRole('dialog', { name: 'Skin Studio' })).toBeInTheDocument() })
      await waitFor(() => { expect(screen.getByRole('button', { name: 'Pick main interface' })).toHaveFocus() })
    } finally {
      root.remove()
    }
  })

  it('reveals transient components in interaction mode before selecting them', async () => {
    const skin = createBlankSkin('Interactive component picker skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const root = document.createElement('div')
    root.id = 'root'
    const opener = document.createElement('button')
    opener.className = 'abc_opener'
    opener.textContent = 'Open component menu'
    opener.getBoundingClientRect = () => ({ x: 20, y: 20, width: 160, height: 40, top: 20, left: 20, right: 180, bottom: 60, toJSON: () => ({}) }) as DOMRect
    let revealed: HTMLButtonElement | undefined
    opener.addEventListener('click', () => {
      revealed = document.createElement('button')
      revealed.className = 'abc_revealed_component'
      revealed.textContent = 'Revealed component'
      revealed.getBoundingClientRect = () => ({ x: 20, y: 70, width: 180, height: 40, top: 70, left: 20, right: 200, bottom: 110, toJSON: () => ({}) }) as DOMRect
      document.body.append(revealed)
    })
    const mount = document.createElement('div')
    root.append(opener, mount); document.body.append(root)
    try {
      render(<SkinStudioRow {...({
        t: (key: SkinStudioKey) => en[key],
        useStore: (select: (value: typeof state) => unknown) => select(state),
        controller: controller(),
      } as unknown as SkinStudioRowProps)} />, { container: mount })
      fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('tab', { name: 'GUI components' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pick main interface' }))
      fireEvent.click(screen.getByRole('button', { name: 'Interact with interface' }))
      fireEvent.click(opener)
      expect(revealed).toBeInTheDocument()
      fireEvent.keyDown(opener, { key: 'F2' })
      expect(screen.getByRole('button', { name: 'Select target' })).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(revealed!)
      await waitFor(() => { expect(screen.getByText('button.abc_revealed_component')).toBeInTheDocument() })
      expect(screen.getByText('Next: upload an image or video')).toBeInTheDocument()
    } finally {
      revealed?.remove()
      root.remove()
    }
  })

  it('requires confirmation before applying a weak component-media scrim', async () => {
    const skin = createBlankSkin('Readable component skin')
    skin.assets = [{ id: 'shared-media', path: 'assets/shared-media.png', kind: 'component-media', mimeType: 'image/png', size: 8, sha256: '0'.repeat(64) }]
    skin.appearance.componentMedia = [{
      id: 'component-risk', name: 'risky card', target: { tagName: 'section', role: null, classNames: ['abc_card'] },
      assetId: 'shared-media', blurPx: 0,
      light: { opacity: 1, scrimOpacity: 0.1 }, dark: { opacity: 0.9, scrimOpacity: 0.1 },
    }]
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: controller(),
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'GUI components' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Component background readability warning')
    expect(screen.getByRole('button', { name: 'Apply & save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'I checked and still want to apply these component backgrounds' }))
    expect(screen.getByRole('button', { name: 'Apply & save' })).toBeEnabled()
  })

  it('keeps a shared component asset when one of its rules is deleted', async () => {
    const skin = createBlankSkin('Shared component skin')
    const descriptor = { id: 'shared-media', path: 'assets/shared-media.png', kind: 'component-media' as const, mimeType: 'image/png' as const, size: 8, sha256: '0'.repeat(64) }
    skin.assets = [descriptor]
    skin.appearance.componentMedia = ['first', 'second'].map(id => ({
      id: `component-${id}`, name: `${id} card`, target: { tagName: 'section', role: null, classNames: [`abc_${id}`] },
      assetId: descriptor.id, blurPx: 0,
      light: { opacity: 0.8, scrimOpacity: 0.5 }, dark: { opacity: 0.8, scrimOpacity: 0.5 },
    }))
    const api = controller()
    vi.mocked(api.assets).mockResolvedValue(new Map([[descriptor.id, new Blob(['image'], { type: 'image/png' })]]))
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    render(<SkinStudioRow {...({
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    } as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'GUI components' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete rule' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(api.saveAndActivate).toHaveBeenCalledOnce() })
    const [saved, savedAssets] = vi.mocked(api.saveAndActivate).mock.calls[0]!
    expect(saved.appearance.componentMedia).toHaveLength(1)
    expect(saved.assets).toContainEqual(descriptor)
    expect(savedAssets.has(descriptor.id)).toBe(true)
  })

  it('does not mutate a token until a color is chosen and warns about unsafe overrides', async () => {
    const skin = createBlankSkin('Safe GUI skin')
    const state = { skins: [skin], activeId: skin.id, ready: true, persistent: true, revision: 1 }
    const api = controller()
    const props = {
      t: (key: SkinStudioKey) => en[key],
      useStore: (select: (value: typeof state) => unknown) => select(state),
      controller: api,
    }
    render(<SkinStudioRow {...(props as unknown as SkinStudioRowProps)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'GUI components' }))
    let inputRow = screen.getByText('Main input').closest('[class*="tokenRow"]') as HTMLElement
    fireEvent.click(within(inputRow).getByRole('button', { name: 'Customize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Skin Studio' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Studio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'GUI components' }))
    inputRow = screen.getByText('Main input').closest('[class*="tokenRow"]') as HTMLElement
    fireEvent.click(within(inputRow).getByRole('button', { name: 'Customize' }))
    const hex = screen.getByLabelText('Main input Light hex value')
    fireEvent.change(hex, { target: { value: skin.palettes.light.foreground } })
    fireEvent.blur(hex)
    expect(screen.getByRole('alert')).toHaveTextContent('Readability warning')
    expect(screen.getByRole('button', { name: 'Apply & save' })).toBeDisabled()
  })
})
