import { useCallback, useEffect, useState } from 'react'
import en from '../locales/en.json'

type TranslationPrimitive = string
interface TranslationMap {
  [key: string]: TranslationPrimitive | TranslationMap
}

type Locale = 'en'

type TranslateParams = Record<string, string | number | undefined>

type Listener = (locale: Locale) => void

const dictionaries: Record<Locale, TranslationMap> = {
  en: en as TranslationMap
}

const DEFAULT_LOCALE: Locale = 'en'
let currentLocale: Locale = DEFAULT_LOCALE
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
    listeners.forEach((listener) => listener(currentLocale))
  }
}

export function getLocale(): Locale {
  return currentLocale
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

  return { locale, t }
}

export type { Locale }
