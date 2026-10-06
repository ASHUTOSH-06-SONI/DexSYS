import { describe, expect, it } from 'vitest'
import { loadThemePreference, saveThemePreference } from './themePreference'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('theme preference', () => {
  it('defaults to light and restores a saved dark preference', () => {
    const storage = createStorage()
    expect(loadThemePreference(storage)).toBe('light')
    saveThemePreference(storage, 'dark')
    expect(loadThemePreference(storage)).toBe('dark')
  })

  it('falls back to light for invalid saved values', () => {
    const storage = createStorage()
    storage.setItem('dexsys-theme', 'sepia')
    expect(loadThemePreference(storage)).toBe('light')
  })
})
