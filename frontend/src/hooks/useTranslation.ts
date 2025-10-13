import { useCallback, useEffect, useState } from 'react'
import en from '../locales/en.json'
import es from '../locales/es.json'
import pl from '../locales/pl.json'
import ru from '../locales/ru.json'

type TranslationPrimitive = string
interface TranslationMap {
  [key: string]: TranslationPrimitive | TranslationMap
}

type Locale = 'en' | 'ru' | 'es' | 'pl'

type TranslateParams = Record<string, string | number | undefined>

type Listener = (locale: Locale) => void

const dictionaries: Record<Locale, TranslationMap> = {
  en: en as TranslationMap,
  ru: ru as TranslationMap,
  es: es as TranslationMap,
  pl: pl as TranslationMap
}

const localeFormats: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  pl: 'pl-PL'
}

const DEFAULT_LOCALE: Locale = 'en'
const LOCALE_STORAGE_KEY = 'snakefans.locale'
let currentLocale: Locale = DEFAULT_LOCALE

if (typeof window !== 'undefined') {
  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null
    if (storedLocale && dictionaries[storedLocale]) {
      currentLocale = storedLocale
    }
  } catch (error) {
    console.warn('Failed to read locale from storage', error)
  }
}
const listeners = new Set<Listener>()

function resolvePath(dictionary: TranslationMap | TranslationPrimitive, path: string[]): TranslationPrimitive | null {
  if (typeof dictionary === 'string') {
    return path.length === 0 ? dictionary : null
  }
  if (path.length === 0) {
    return null
  }
  const [segment, ...rest] = path
  const next = dictionary[segment]
  if (!next) {
    return null
  }
  return resolvePath(next as TranslationMap | TranslationPrimitive, rest)
}

function formatTemplate(template: string, params?: TranslateParams) {
  if (!params) return template
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const value = params[key]
    if (value === null || value === undefined) {
      return ''
    }
    return String(value)
  })
}

function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}

export function translate(key: string, params?: TranslateParams): string {
  const segments = key.split('.')
  const activeDictionary = getDictionary(currentLocale)
  const fallbackDictionary = getDictionary(DEFAULT_LOCALE)
  const fromActive = resolvePath(activeDictionary, segments)
  const fromFallback = resolvePath(fallbackDictionary, segments)
  const template = (fromActive ?? fromFallback)
  if (typeof template === 'string') {
    return formatTemplate(template, params)
  }
  return key
}

export function setLocale(locale: Locale) {
  if (!dictionaries[locale]) {
    return
  }
  if (currentLocale !== locale) {
    currentLocale = locale
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
      } catch (error) {
        console.warn('Failed to persist locale', error)
      }
    }
    listeners.forEach((listener) => listener(currentLocale))
  }
}

export function getLocale(): Locale {
  return currentLocale
}

export function getIntlLocale(locale: Locale = getLocale()): string {
  return localeFormats[locale] ?? localeFormats[DEFAULT_LOCALE]
}

export function subscribeToLocaleChanges(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(getLocale())

  useEffect(() => {
    return subscribeToLocaleChanges(setLocaleState)
  }, [])

  const t = useCallback((key: string, params?: TranslateParams) => translate(key, params), [])

  const changeLocale = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale)
  }, [])

  return { locale, t, setLocale: changeLocale }
}

export type { Locale }
