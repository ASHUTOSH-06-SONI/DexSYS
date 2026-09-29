export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'dexsys-theme'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadThemePreference(storage: ThemeStorage): ThemeMode {
  return storage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function saveThemePreference(storage: ThemeStorage, theme: ThemeMode) {
  storage.setItem(THEME_STORAGE_KEY, theme)
}
