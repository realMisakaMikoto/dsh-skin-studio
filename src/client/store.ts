import { useSyncExternalStore } from 'react'
import type { SkinManifestV1 } from '../model.ts'

export interface SkinStudioState {
  skins: SkinManifestV1[]
  activeId: string | null
  ready: boolean
  persistent: boolean
  revision: number
  open: boolean
  openRevision: number
}

export interface SkinStudioActions {
  sync: (state: Pick<SkinStudioState, 'skins' | 'activeId' | 'ready' | 'persistent'>) => void
  open: () => void
  close: () => void
}

export interface SkinStudioStore {
  getSnapshot: () => SkinStudioState
  subscribe: (listener: () => void) => () => void
  useStore: <T>(select: (state: SkinStudioState) => T) => T
  actions: SkinStudioActions
}

export function createSkinStudioStore(): SkinStudioStore {
  let snapshot: SkinStudioState = {
    skins: [], activeId: null, ready: false, persistent: true,
    revision: 0, open: false, openRevision: 0,
  }
  const listeners = new Set<() => void>()
  const getSnapshot = (): SkinStudioState => snapshot
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const update = (state: Partial<SkinStudioState>): void => {
    snapshot = { ...snapshot, ...state, revision: snapshot.revision + 1 }
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot, subscribe,
    useStore: <T,>(select: (state: SkinStudioState) => T): T => {
      const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      return select(state)
    },
    actions: {
      sync: state => { update(state) },
      open: () => { update({ open: true, openRevision: snapshot.openRevision + 1 }) },
      close: () => { if (snapshot.open) update({ open: false }) },
    },
  }
}
