import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en"
import zhCN from "./locales/zh-CN"

const STORAGE_KEY = "relayorb.language"

type SupportedLanguage = "en" | "zh-CN"

function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en"
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === "en" || saved === "zh-CN") return saved
  const browser = window.navigator.language
  if (browser?.toLowerCase().startsWith("zh")) return "zh-CN"
  return "en"
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export type { SupportedLanguage }
export const languageStorageKey = STORAGE_KEY
export const languageOptions: Array<{ value: SupportedLanguage; label: string; nativeLabel: string }> = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "zh-CN", label: "Mandarin", nativeLabel: "中文" },
]

export function setStoredLanguage(lang: SupportedLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang)
  }
  i18n.changeLanguage(lang)
}

export default i18n
