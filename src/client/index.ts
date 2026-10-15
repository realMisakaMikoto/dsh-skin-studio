import React, { useCallback, useSyncExternalStore } from 'react'
import type { DesktopContext } from './desktop-context.ts'
import { SkinStudioOverlay, SkinStudioRow } from './SkinStudioRow.tsx'
import { createSkinStudioStore } from './store.ts'
import { createController } from './controller.ts'
import { en, NS, zh, type SkinStudioKey } from './locales.ts'
import { getMigrationReport } from '../storage.ts'
import { installStyles } from './studio.module.css'

const PACKAGE_ID = '@local/dsh-desktop-skin-studio'

function report(extra: Record<string, unknown>): void {
  if (typeof fetch !== 'function') return
  try {
    void fetch('/dsh-desktop-skin-studio/status', {
      method: 'POST', keepalive: true,
      body: JSON.stringify({ packageId: PACKAGE_ID, at: new Date().toISOString(), ...extra }),
    }).catch(() => {})
  } catch { /* Diagnostics must not prevent activation. */ }
}

// Required services belong to the inner scope; missing services cannot park boot.
export const inject: string[] = []

export function apply(ctx: DesktopContext): void {
  report({ state: 'waiting-for-client-services' })
  if (typeof ctx.inject !== 'function') {
    report({ state: 'client-scope-unavailable' })
    return
  }
  ctx.inject(['slots', 'theme', 'locale'], scope => {
    try {
      installStyles(scope)
      scope.effect(() => scope.locale.register(NS, { zh, en }), 'desktop skin studio dictionaries')
      const store = createSkinStudioStore()
      let live = true
      const { controller, dispose, ready } = createController(scope, store)
      controller.connectActions(store.actions)
      scope.effect(() => dispose, 'desktop skin studio controller')
      let language = scope.locale.getLocale().active === 'zh' ? 'zh' : 'en'
      const listeners = new Set<() => void>()
      const subscribe = (listener: () => void): (() => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      }
      scope.on('locale/change', snapshot => {
        language = snapshot.active === 'zh' ? 'zh' : 'en'
        for (const listener of listeners) listener()
      })
      function useTranslation(): (key: SkinStudioKey) => string {
        const current = useSyncExternalStore(subscribe, () => language, () => language)
        return useCallback((key: SkinStudioKey) => (current === 'zh' ? zh : en)[key], [current])
      }
      function Row() {
        const t = useTranslation()
        return React.createElement(SkinStudioRow, { t, controller, store, useStore: store.useStore })
      }
      function Overlay() {
        const t = useTranslation()
        return React.createElement(SkinStudioOverlay, { t, controller, store, useStore: store.useStore })
      }
      scope.slots.inject('settings.general.item', () => {
        report({ state: 'row-live', slotKey: 'settings.general.item', rowId: 'desktop-skin-studio' })
        return scope.slots.register({ name: 'settings.general.item', id: 'desktop-skin-studio', order: 30 }, Row)
      })
      scope.slots.inject('shell.overlay', () => {
        report({ state: 'overlay-live', overlayId: 'desktop-skin-studio-dialog' })
        return scope.slots.register({ name: 'shell.overlay', id: 'desktop-skin-studio-dialog', order: 100 }, Overlay)
      })
      void ready.then(() => {
        if (!live) return
        const state = store.getSnapshot()
        report({ state: 'ready', ready: state.ready, persistent: state.persistent, activeId: state.activeId, skinCount: state.skins.length, initializationError: controller.initializationError?.() ?? null, migration: getMigrationReport() })
      }).catch(error => { report({ state: 'library-failed', error: String(error) }) })
      return () => { live = false; store.actions.close(); listeners.clear() }
    } catch (error) {
      report({ state: 'activation-failed', error: String(error) })
      return undefined
    }
  })
}
