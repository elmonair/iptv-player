import { create } from 'zustand'
import { type Language, LANGUAGES, translations as allTranslations } from './translations'

interface LanguageStore {
  language: Language
  setLanguage: (lang: Language) => void
  dir: 'ltr' | 'rtl'
}

export const useLanguageStore = create<LanguageStore>((set) => {
  const saved = localStorage.getItem('language') as Language | null
  const lang = saved || 'en'
  const langInfo = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]

  return {
    language: lang,
    dir: langInfo.dir,
    setLanguage: (language) => {
      localStorage.setItem('language', language)
      const langInfo = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]
      set({ language, dir: langInfo.dir })
      document.documentElement.dir = langInfo.dir
      document.documentElement.lang = language
    },
  }
})

export function useTranslation() {
  const language = useLanguageStore((s) => s.language)

  return {
    t: (key: string, params?: Record<string, string | number>) => {
      const dict = (allTranslations as Record<string, Record<string, string>>)[language]
      let text = (dict?.[key] || (allTranslations.en as Record<string, string>)[key] || key) as string
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v))
        }
      }
      return text
    },
    language,
  }
}

export { LANGUAGES, type Language }
export { translations as allTranslations } from './translations'