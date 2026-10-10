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
  it('defaults to dark and restores a saved light preference', () => {
    const storage = createStorage()
    expect(loadThemePreference(storage)).toBe('dark')
    saveThemePreference(storage, 'light')
    expect(loadThemePreference(storage)).toBe('light')
  })

  it('falls back to dark for invalid saved values', () => {
    const storage = createStorage()
    storage.setItem('dexsys-theme', 'sepia')
    expect(loadThemePreference(storage)).toBe('dark')
  })
})
