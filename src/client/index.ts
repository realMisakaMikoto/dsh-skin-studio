import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SkinStudioInjected } from './SkinStudioRow.tsx'
import { SkinStudioRow } from './SkinStudioRow.tsx'
import { createSkinStudioStore } from './store.ts'
import { createController } from './controller.ts'
import { en, NS, zh, type SkinStudioKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'dsh.skinStudio': SkinStudioKey }
}

export const inject = ['slots', 'locale', 'theme']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-skin-studio: dictionaries')
  const store = createSkinStudioStore()
  const { controller, dispose } = createController(ctx, store)
  ctx.effect(() => dispose, 'dsh-skin-studio: controller')
  const injected = (actions: Parameters<typeof controller.connectActions>[0]): SkinStudioInjected => {
    controller.connectActions(actions)
    return { controller }
  }
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: 'skin-studio', order: 30, store, locale: NS, inject: injected,
  }, SkinStudioRow))
}
