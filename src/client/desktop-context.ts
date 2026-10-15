import type { ComponentType } from 'react'
import type { SkinMode, ThemeTokenModes } from '../model.ts'

export interface DesktopTheme {
  getTheme(): { active: { colorScheme: SkinMode } }
  overrideTokens(source: string, tokens: Record<string, ThemeTokenModes>): () => void
  exportInspectTokens(): { name: string; valueType: string }[]
}

export interface DesktopLocale {
  getLocale(): { active: string }
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
  translate?(namespace: string, key: string): string
}

export interface DesktopSlots {
  inject(key: string, callback: () => (() => void) | void): () => void
  register(options: { name: string; id: string; order?: number; priority?: number }, component: ComponentType): () => void
}

export interface DesktopContext {
  theme: DesktopTheme
  locale: DesktopLocale
  slots: DesktopSlots
  effect(callback: () => (() => void) | void, label?: string): () => void
  inject(keys: string[], callback: (scope: DesktopContext) => (() => void) | void): () => void
  on(event: 'theme/change', listener: (snapshot: { active: { colorScheme: SkinMode } }) => void): () => void
  on(event: 'locale/change', listener: (snapshot: { active: string }) => void): () => void
  get?(name: string): unknown
}
