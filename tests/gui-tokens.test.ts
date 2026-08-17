import { describe, expect, it } from 'vitest'
import { GUI_TOKEN_GROUPS, suggestTokenModes } from '../src/gui-tokens.ts'
import { createBlankSkin } from '../src/presets.ts'

describe('GUI token editor', () => {
  it('covers inputs, buttons, sidebar, conversation, borders, and status UI', () => {
    expect(GUI_TOKEN_GROUPS.map(group => group.id)).toEqual([
      'surfaces', 'inputs', 'buttons', 'sidebar', 'conversation', 'borders', 'status',
    ])
    expect(GUI_TOKEN_GROUPS.flatMap(group => group.tokens).some(token => token.name === '--dsw-alias-border-l4')).toBe(true)
  })

  it('suggests independent light and dark values from the semantic palette', () => {
    const skin = createBlankSkin('Suggested')
    const input = suggestTokenModes('--dsw-specific-input-major', skin)
    const border = suggestTokenModes('--dsw-alias-border-l2', skin)
    expect(input.light).toBe(skin.palettes.light.background)
    expect(input.dark).toBe(skin.palettes.dark.background)
    expect(border.light).toMatch(/^#[0-9a-f]{6}$/)
    expect(border.light).not.toBe(border.dark)
  })
})
