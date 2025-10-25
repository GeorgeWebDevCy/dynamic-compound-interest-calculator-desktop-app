import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import elTranslation from './locales/el/translation.json'
import enTranslation from './locales/en/translation.json'

const LANGUAGE_STORAGE_KEY = 'dynamic-compound-interest.language'

const detectBrowserLanguage = () => {
  if (typeof window === 'undefined') {
    return undefined
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored) {
    return stored
  }

  const browserLanguage = window.navigator?.language || window.navigator?.languages?.[0]
  if (!browserLanguage) {
    return undefined
  }

  return browserLanguage.toLowerCase().startsWith('el') ? 'el' : 'en'
}

const initialLanguage = detectBrowserLanguage()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    el: { translation: elTranslation },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (language) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
})

export const LANGUAGE_KEY = LANGUAGE_STORAGE_KEY

export default i18n
