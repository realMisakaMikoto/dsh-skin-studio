import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { SkinManifestV1 } from '../model.ts'

export interface SkinStudioState {
  skins: SkinManifestV1[]
  activeId: string | null
  ready: boolean
  persistent: boolean
  revision: number
}

type Actions = {
  sync: (draft: SkinStudioState, state: Omit<SkinStudioState, 'revision'>) => void
}

export function createSkinStudioStore(): EngineStoreHandle<SkinStudioState, Actions> {
  return defineStore({
    init: () => ({ skins: [], activeId: null, ready: false, persistent: true, revision: 0 }),
    actions: {
      sync: (draft, state) => {
        draft.skins = state.skins
        draft.activeId = state.activeId
        draft.ready = state.ready
        draft.persistent = state.persistent
        draft.revision += 1
      },
    },
  })
}
