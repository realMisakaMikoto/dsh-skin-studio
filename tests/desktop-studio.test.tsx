import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { BUNDLED_SKIN_PACKAGES } from '../src/builtin-skins.ts'
import { createBlankSkin } from '../src/presets.ts'
import { decodeSkinManifest, type SkinManifestV1 } from '../src/model.ts'
import { SkinStudioOverlay, SkinStudioRow } from '../src/client/SkinStudioRow.tsx'
import { createSkinStudioStore } from '../src/client/store.ts'
import { en, type SkinStudioKey } from '../src/client/locales.ts'
import type { SkinStudioController } from '../src/client/controller.ts'

function mountStudio(skin: SkinManifestV1 = createBlankSkin('Desktop skin')) {
  const store = createSkinStudioStore()
  store.actions.sync({ skins: [skin], activeId: skin.id, ready: true, persistent: true })
  const controller: SkinStudioController = {
    create: () => createBlankSkin('Untitled skin'),
    duplicate: vi.fn(), remove: vi.fn(),
    preview: vi.fn(async () => {}), cancelPreview: vi.fn(async () => {}),
    saveAndActivate: vi.fn(async next => {
      store.actions.sync({ skins: [next], activeId: next.id, ready: true, persistent: true })
    }),
    activate: vi.fn(async id => {
      store.actions.sync({ skins: [skin], activeId: id, ready: true, persistent: true })
    }),
    assets: vi.fn(async () => new Map()),
    importPackage: vi.fn(async () => 'imported' as const),
    exportPackage: vi.fn(async () => new Blob()),
    tokenNames: ['--dsw-alias-bg-base', '--dsw-specific-input-major'],
    activeLocale: () => 'en', initializationError: () => null, connectActions: vi.fn(),
  }
  const props = { t: (key: SkinStudioKey) => en[key], controller, store, useStore: store.useStore }
  // The two slot contributions have separate render positions and share only the store.
  const row = render(<SkinStudioRow {...props} />)
  const overlay = render(<SkinStudioOverlay {...props} />)
  const opener = screen.getByRole('button', { name: 'Open Skin Studio' })
  opener.focus()
  fireEvent.click(opener)
  return { store, controller, opener, row, overlay }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(complete => { resolve = complete })
  return { promise, resolve }
}

describe('native desktop studio', () => {
  it('pauses preview and freezes editing and dismissal while a fast apply is still saving', async () => {
    const { controller } = mountStudio()
    const save = deferred<void>()
    vi.mocked(controller.saveAndActivate).mockImplementation(() => save.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await act(async () => { await Promise.resolve() })
    const name = screen.getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Saved after waiting' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    expect(name).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel preview' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    for (const tab of screen.getAllByRole('tab')) expect(tab).toBeDisabled()
    const dialog = screen.getByRole('dialog', { name: 'Skin Studio' })
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument()
    fireEvent.change(name, { target: { value: 'A change during the save' } })
    await act(async () => { await new Promise(resolve => { window.setTimeout(resolve, 100) }) })
    expect(controller.preview).not.toHaveBeenCalled()
    expect(controller.cancelPreview).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved and activated')).not.toBeInTheDocument()
    await act(async () => { save.resolve(undefined); await save.promise })
    expect(name).toBeEnabled()
    expect(name).toHaveValue('Saved after waiting')
    expect(screen.getByRole('button', { name: 'Apply & save' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
    expect(screen.getByText('Saved and activated')).toBeInTheDocument()
    expect(vi.mocked(controller.saveAndActivate).mock.calls[0]?.[0].name).toBe('Saved after waiting')
  })

  it('ignores a previous skins late asset result after another skin is selected', async () => {
    const skinA = createBlankSkin('Skin A')
    const skinB = createBlankSkin('Skin B')
    const { controller, store } = mountStudio(skinA)
    act(() => { store.actions.sync({ skins: [skinA, skinB], activeId: skinA.id, ready: true, persistent: true }) })
    const loadA = deferred<Map<string, Blob>>()
    const loadB = deferred<Map<string, Blob>>()
    vi.mocked(controller.assets).mockImplementation(id => id === skinA.id ? loadA.promise : loadB.promise)
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    fireEvent.click(screen.getByRole('tab', { name: 'Library' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]!)
    const blobB = new Blob(['B'])
    await act(async () => { loadB.resolve(new Map([['asset-b', blobB]])); await loadB.promise })
    await act(async () => { loadA.resolve(new Map([['asset-a', new Blob(['A'])]])); await loadA.promise })
    expect(screen.getByLabelText('Name')).toHaveValue('Skin B')
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(controller.saveAndActivate).toHaveBeenCalledOnce() })
    const [saved, assets] = vi.mocked(controller.saveAndActivate).mock.calls[0]!
    expect(saved.id).toBe(skinB.id)
    expect(assets.get('asset-b')).toBe(blobB)
    expect(assets.has('asset-a')).toBe(false)
  })

  it('shows the character media blocker and confirmation on every editing page', async () => {
    const entry = BUNDLED_SKIN_PACKAGES[0]!
    const zip = unzipSync(Uint8Array.from(atob(entry.base64), value => value.charCodeAt(0)))
    const skin = decodeSkinManifest(JSON.parse(new TextDecoder().decode(zip['manifest.json']!)))!
    expect(skin.appearance.componentMedia).toHaveLength(8)
    const { controller } = mountStudio(skin)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    for (const title of ['Basic editor', 'GUI components', 'Visual assets', 'Copy']) {
      fireEvent.click(screen.getByRole('tab', { name: title }))
      expect(screen.getByRole('alert')).toHaveTextContent('Component background readability warning')
      expect(screen.getByRole('alert')).toHaveTextContent('Check both light and dark modes first')
      expect(screen.getAllByRole('checkbox', { name: 'I checked and still want to apply these component backgrounds' })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Apply & save' })).toBeDisabled()
    }
    fireEvent.click(screen.getByRole('tab', { name: 'Basic editor' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'I checked and still want to apply these component backgrounds' }))
    expect(screen.getByRole('button', { name: 'Apply & save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(controller.saveAndActivate).toHaveBeenCalledOnce() })
    expect(vi.mocked(controller.saveAndActivate).mock.calls[0]?.[0].appearance.componentMedia).toHaveLength(8)
  })

  it('provides a visible path to contrast confirmation from assets and copy', async () => {
    const skin = createBlankSkin('Low contrast skin')
    skin.palettes.light.foreground = skin.palettes.light.background
    mountStudio(skin)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    for (const title of ['Visual assets', 'Copy']) {
      fireEvent.click(screen.getByRole('tab', { name: title }))
      expect(screen.getByRole('alert')).toHaveTextContent('Readability warning')
      expect(screen.getByRole('button', { name: 'Apply & save' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Review colors' }))
      expect(screen.getByRole('tab', { name: 'Basic editor' })).toHaveAttribute('aria-selected', 'true')
      await waitFor(() => { expect(screen.getByRole('checkbox', { name: 'I checked it and still want to apply' })).toHaveFocus() })
    }
    fireEvent.click(screen.getByRole('checkbox', { name: 'I checked it and still want to apply' }))
    expect(screen.getByRole('button', { name: 'Apply & save' })).toBeEnabled()
  })

  it('opens the real native dialog from a separate settings row and renders all six pages', async () => {
    mountStudio()
    const dialog = screen.getByRole('dialog', { name: 'Skin Studio' })
    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveAttribute('open')
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    for (const title of ['Library', 'Basic editor', 'GUI components', 'Visual assets', 'Copy', 'Import & export']) {
      const tab = screen.getByRole('tab', { name: title })
      fireEvent.click(tab)
      expect(tab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tabpanel', { name: title })).toBeInTheDocument()
    }
    await waitFor(() => { expect(screen.getByRole('tab', { name: 'Import & export' })).toHaveFocus() })
  })

  it('guards native cancellation, keeps a dirty draft, and restores the active skin when discarded', async () => {
    const { controller, store, opener } = mountStudio()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const name = screen.getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Unsaved desktop draft' } })
    name.focus()
    const dialog = screen.getByRole('dialog', { name: 'Skin Studio' })
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent('You have unsaved changes')
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(name).toHaveValue('Unsaved desktop draft')
    await waitFor(() => { expect(name).toHaveFocus() })
    fireEvent.keyDown(name, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.queryByRole('dialog', { name: 'Skin Studio' })).not.toBeInTheDocument()
    expect(store.getSnapshot().open).toBe(false)
    expect(controller.cancelPreview).toHaveBeenCalled()
    await waitFor(() => { expect(opener).toHaveFocus() })
  })

  it('saves through the controller and synchronizes the active name back to the settings row', async () => {
    const { controller } = mountStudio()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Saved desktop skin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply & save' }))
    await waitFor(() => { expect(controller.saveAndActivate).toHaveBeenCalledOnce() })
    expect(vi.mocked(controller.saveAndActivate).mock.calls[0]?.[0].name).toBe('Saved desktop skin')
    expect(screen.getByText('Saved and activated')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Skin Studio' })).not.toBeInTheDocument()
    expect(screen.getByText('Saved desktop skin')).toBeInTheDocument()
  })

  it('uses immutable snapshots and keeps editor open requests separate from library synchronization', () => {
    const store = createSkinStudioStore()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    const initial = store.getSnapshot()
    expect(store.getSnapshot()).toBe(initial)
    act(() => { store.actions.open() })
    const opened = store.getSnapshot()
    expect(opened).not.toBe(initial)
    expect(initial.open).toBe(false)
    act(() => { store.actions.sync({ skins: [], activeId: null, ready: true, persistent: false }) })
    expect(store.getSnapshot().openRevision).toBe(opened.openRevision)
    expect(store.getSnapshot().open).toBe(true)
    off()
    const calls = listener.mock.calls.length
    act(() => { store.actions.close() })
    expect(listener).toHaveBeenCalledTimes(calls)
  })
})
