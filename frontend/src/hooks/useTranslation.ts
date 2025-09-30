import { useCallback, useEffect, useState } from 'react'

const TRANSLATIONS = {
  ru: {
    balanceTitle: 'Баланс',
    walletButtonTitle: 'Кошелек',
    walletButtonCaption: 'Управление средствами',
    walletButtonAriaLabel: 'Открыть кошелек',
    walletButtonLabel: 'Кошелек',
    currentBetLabel: 'Текущая ставка',
    skinLabel: 'Скин',
    authPrompt: 'Авторизоваться'
  },
  en: {
    balanceTitle: 'Balance',
    walletButtonTitle: 'Wallet',
    walletButtonCaption: 'Manage funds',
    walletButtonAriaLabel: 'Open wallet',
    walletButtonLabel: 'Wallet',
    currentBetLabel: 'Current bet',
    skinLabel: 'Skin',
    authPrompt: 'Sign in'
  }
} as const

type Locale = keyof typeof TRANSLATIONS

type TranslationKey = keyof (typeof TRANSLATIONS)['ru']

const DEFAULT_LOCALE: Locale = 'ru'

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }
  const language = navigator.language?.toLowerCase() ?? ''
  if (language.startsWith('en')) {
    return 'en'
  }
  return DEFAULT_LOCALE
}

export function useTranslation() {
  const [locale, setLocale] = useState<Locale>(() => detectLocale())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleLanguageChange = () => {
      setLocale(detectLocale())
    }
    window.addEventListener('languagechange', handleLanguageChange)
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange)
    }
  }, [])

  const translate = useCallback(
    (key: TranslationKey) => {
      const dictionary = TRANSLATIONS[locale] ?? TRANSLATIONS[DEFAULT_LOCALE]
      return dictionary[key] ?? TRANSLATIONS[DEFAULT_LOCALE][key]
    },
    [locale]
  )

  return { locale, t: translate }
}
