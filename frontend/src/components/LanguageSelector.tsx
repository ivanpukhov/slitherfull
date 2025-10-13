import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Locale, useTranslation } from '../hooks/useTranslation'

interface LanguageOption {
  locale: Locale
  label: string
  emoji: string
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { locale: 'en', label: 'English', emoji: '🇬🇧' },
  { locale: 'ru', label: 'Русский', emoji: '🇷🇺' }
]

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((option) => option.locale === locale) ?? LANGUAGE_OPTIONS[0],
    [locale]
  )

  const availableLanguages = useMemo(
    () => LANGUAGE_OPTIONS.filter((option) => option.locale !== currentLanguage.locale),
    [currentLanguage.locale]
  )

  const closeMenu = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [closeMenu, open])

  const handleSelect = useCallback(
    (nextLocale: Locale) => {
      setLocale(nextLocale)
      closeMenu()
    },
    [closeMenu, setLocale]
  )

  const handleToggle = useCallback(() => {
    setOpen((previous) => !previous)
  }, [])

  return (
    <div
      className={`language-switcher${open ? ' language-switcher--open' : ''}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="language-switcher__toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Current language: ${currentLanguage.label}`}
        onClick={handleToggle}
      >
        <span aria-hidden className="language-switcher__flag">
          {currentLanguage.emoji}
        </span>
        <span className="visually-hidden">{currentLanguage.label}</span>
      </button>
      <div className="language-switcher__dropdown" role="menu">
        {availableLanguages.map((option) => (
          <button
            key={option.locale}
            type="button"
            className="language-switcher__option"
            role="menuitem"
            onClick={() => handleSelect(option.locale)}
            title={option.label}
          >
            <span aria-hidden className="language-switcher__flag">
              {option.emoji}
            </span>
            <span className="visually-hidden">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
